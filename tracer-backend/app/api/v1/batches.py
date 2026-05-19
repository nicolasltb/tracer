import logging
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.batch import Batch
from app.models.property import Property
from app.models.user import User, UserRole
from app.schemas.batch import (
    BatchChainData,
    BatchCreate,
    BatchCreateResponse,
    BatchDetail,
    BatchPublic,
    BatchStatusUpdate,
    EventChainData,
)
from app.services.blockchain_service import (
    get_batch_from_chain,
    get_events_from_chain,
    register_batch_on_chain,
)
from app.services.qr_service import create_chain_qr

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batches", tags=["Lotes de Café"])


def _generate_code() -> str:
    """Gera um código legível para o lote: CAFE-AAAA-XXXX."""
    suffix = str(uuid.uuid4()).upper()[:6]
    return f"CAFE-{date.today().year}-{suffix}"


@router.post("/", response_model=BatchCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    payload: BatchCreate,
    current_user: User = Depends(require_roles(UserRole.FARMER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    [Fazendeiro] Registra um novo lote de café.

    1. Cria um índice mínimo no banco (id, code, status, owner)
    2. Envia TODOS os dados do lote para a blockchain
    3. Gera QR code para o próximo ator da cadeia
    """
    result = await db.execute(select(Property).where(Property.id == payload.property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Propriedade não encontrada."
        )
    if current_user.role == UserRole.FARMER and prop.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Não é possível criar lote em propriedade de outro usuário.",
        )

    batch = Batch(
        code=_generate_code(),
        owner_id=current_user.id,
        property_id=prop.id,
    )
    db.add(batch)
    await db.flush()

    # Envia campos tipados ao contrato (conversões float→inteiro são feitas no service).
    if current_user.wallet_encrypted_key:
        tx_hash = await register_batch_on_chain(
            batch_id=str(batch.id),
            batch_code=batch.code,
            coffee_type=payload.coffee_type.value,
            weight_kg=payload.weight_kg,
            origin_farm=prop.name,
            origin_city=prop.municipality,
            origin_state=prop.state,
            harvest_date=payload.harvest_date,
            description=payload.description,
            owner_encrypted_key=current_user.wallet_encrypted_key,
        )
        if tx_hash:
            batch.tx_hash = tx_hash

    # Gera QR code para o processador
    qr_token: str | None = None
    try:
        qr = await create_chain_qr(db, batch)
        if qr:
            qr_token = qr.token
    except Exception as exc:
        logger.error("Falha ao gerar QR code para lote %s: %s", batch.code, exc)

    await db.refresh(batch)

    return BatchCreateResponse(
        id=batch.id,
        code=batch.code,
        status=batch.status,
        owner_id=batch.owner_id,
        property_id=batch.property_id,
        tx_hash=batch.tx_hash,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        qr_token=qr_token,
    )


@router.get("/", response_model=list[BatchPublic])
async def list_batches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lista lotes (índice do DB para performance).
    - Fazendeiro / Processador / Transportador: apenas seus próprios lotes.
    - Auditor / Admin: todos os lotes.
    """
    q = select(Batch)
    if current_user.role not in (UserRole.AUDITOR, UserRole.ADMIN):
        q = q.where(Batch.owner_id == current_user.id)
    result = await db.execute(q.order_by(Batch.created_at.desc()))
    return result.scalars().all()


@router.get("/{batch_id}", response_model=BatchDetail)
async def get_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna dados completos de um lote lidos da blockchain,
    combinados com o índice do DB.
    """
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote não encontrado.")

    if current_user.role not in (UserRole.AUDITOR, UserRole.ADMIN):
        if batch.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado.")

    # Lê dados da blockchain
    chain_data = None
    chain_batch = get_batch_from_chain(str(batch.id))
    if chain_batch:
        chain_data = BatchChainData(**chain_batch["data"])

    # Lê eventos da blockchain. Cada `data` traz os campos da struct tipada
    # correspondente; extraímos location/notes e o resto vira `metadata`.
    chain_events_raw = get_events_from_chain(str(batch.id))
    chain_events = []
    for ev in chain_events_raw:
        ev_data = dict(ev.get("data", {}))
        location = ev_data.pop("location", None) or ev_data.pop("from_location", None)
        notes = ev_data.pop("notes", None)
        chain_events.append(EventChainData(
            event_type=ev["event_type"],
            location=location,
            notes=notes,
            metadata=ev_data or None,
            actor_address=ev["actor_address"],
            timestamp=ev["timestamp"],
            block_number=ev["block_number"],
        ))

    return BatchDetail(
        id=batch.id,
        code=batch.code,
        status=batch.status,
        owner_id=batch.owner_id,
        property_id=batch.property_id,
        tx_hash=batch.tx_hash,
        created_at=batch.created_at,
        chain=chain_data,
        events=chain_events,
    )


@router.patch("/{batch_id}/status", response_model=BatchPublic)
async def update_batch_status(
    batch_id: uuid.UUID,
    payload: BatchStatusUpdate,
    current_user: User = Depends(require_roles(UserRole.FARMER, UserRole.PROCESSOR, UserRole.TRANSPORTER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Atualiza o status de um lote (ex: in_transit → delivered)."""
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote não encontrado.")

    batch.status = payload.status
    return batch

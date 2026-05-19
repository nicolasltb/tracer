import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.batch import Batch, BatchStatus
from app.models.user import User, UserRole
from app.models.property import Property
from app.schemas.qr import (
    METADATA_SCHEMA_BY_STATUS,
    QRScanRequest,
    QRScanResponse,
    QRTokenInfo,
    TraceCertification,
    TraceEvent,
    TracePropertySummary,
    TraceResponse,
)
from app.services.blockchain_service import (
    add_certification_audit_event_on_chain,
    add_delivery_event_on_chain,
    add_processing_event_on_chain,
    add_roasting_event_on_chain,
    add_transport_event_on_chain,
    get_batch_from_chain,
    get_events_from_chain,
)
from app.services.certification_service import get_active_certification
from app.services.qr_service import (
    generate_qr_image,
    get_active_qr_for_batch,
    get_qr_token,
    process_scan,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["QR Code"])


async def _dispatch_chain_event(
    origin_status: BatchStatus,
    batch_id: str,
    scan_payload: QRScanRequest,
    metadata,
    actor_encrypted_key: str,
) -> tuple[str | None, int | None]:
    """Roteia para a função tipada do contrato com base no status que estava sendo deixado."""
    if origin_status == BatchStatus.HARVESTED:
        return await add_processing_event_on_chain(
            batch_id=batch_id,
            location=scan_payload.location,
            latitude=scan_payload.latitude,
            longitude=scan_payload.longitude,
            method=metadata.processing_method,
            notes=scan_payload.notes,
            actor_encrypted_key=actor_encrypted_key,
        )
    if origin_status == BatchStatus.PROCESSING:
        return await add_roasting_event_on_chain(
            batch_id=batch_id,
            location=scan_payload.location,
            latitude=scan_payload.latitude,
            longitude=scan_payload.longitude,
            temperature_c=metadata.temperature_c,
            humidity_pct=metadata.humidity_pct,
            duration_min=metadata.duration_min,
            level=metadata.roast_level,
            notes=scan_payload.notes,
            actor_encrypted_key=actor_encrypted_key,
        )
    if origin_status == BatchStatus.ROASTING:
        return await add_transport_event_on_chain(
            batch_id=batch_id,
            from_location=scan_payload.location,
            latitude=scan_payload.latitude,
            longitude=scan_payload.longitude,
            transport_type=metadata.transport_type,
            vehicle_id=metadata.vehicle_id,
            notes=scan_payload.notes,
            actor_encrypted_key=actor_encrypted_key,
        )
    if origin_status == BatchStatus.IN_TRANSIT:
        return await add_delivery_event_on_chain(
            batch_id=batch_id,
            location=scan_payload.location,
            latitude=scan_payload.latitude,
            longitude=scan_payload.longitude,
            condition=metadata.delivery_condition,
            recipient_name=metadata.recipient_name,
            notes=scan_payload.notes,
            actor_encrypted_key=actor_encrypted_key,
        )
    if origin_status == BatchStatus.DELIVERED:
        return await add_certification_audit_event_on_chain(
            batch_id=batch_id,
            location=scan_payload.location,
            latitude=scan_payload.latitude,
            longitude=scan_payload.longitude,
            certificate_number=metadata.certificate_number,
            standard=metadata.certification_standard,
            notes=scan_payload.notes,
            actor_encrypted_key=actor_encrypted_key,
        )
    return None, None


# ---------- info ----------

@router.get("/qr/{token}", response_model=QRTokenInfo)
async def qr_info(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna informações sobre um QR code (público).
    Qualquer pessoa com o token pode consultar.
    """
    qr = await get_qr_token(db, token)
    if not qr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code não encontrado.")

    batch = qr.batch
    return QRTokenInfo(
        token=qr.token,
        batch_id=batch.id,
        batch_code=batch.code,
        batch_status=batch.status,
        next_status=qr.next_status,
        expected_role=qr.expected_role,
        is_consumer=qr.is_consumer,
        is_active=qr.is_active,
    )


# ---------- scan ----------

@router.post("/qr/{token}/scan", response_model=QRScanResponse)
async def scan_qr(
    token: str,
    payload: QRScanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Escaneia um QR code para avançar o lote na cadeia.

    1. Valida o papel do usuário
    2. Atualiza status e cria índice do evento no DB
    3. Envia TODOS os dados do evento para a blockchain
    4. Gera o próximo QR code
    """
    qr = await get_qr_token(db, token)
    if not qr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code não encontrado.")
    if not qr.is_active:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="QR code já foi utilizado.")
    if qr.is_consumer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este QR é somente para consulta do consumidor.")

    # Valida papel (ADMIN pode sempre avançar)
    if current_user.role != UserRole.ADMIN and current_user.role != qr.expected_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Apenas usuários com papel '{qr.expected_role.value}' podem processar esta etapa.",
        )

    # Bloqueia transição para CERTIFIED se a propriedade não tem cert ativa
    if qr.next_status == BatchStatus.CERTIFIED:
        cert = await get_active_certification(db, qr.batch.property_id)
        if cert is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Propriedade não possui certificação Certifica Minas ativa. "
                    "Realize uma auditoria com todos os requisitos conformes antes "
                    "de certificar este lote."
                ),
            )

    # Status de origem determina qual função tipada do contrato será chamada.
    origin_status = qr.batch.status

    # Valida metadata específico da etapa antes de avançar (Pydantic levanta 422 automaticamente).
    metadata_schema = METADATA_SCHEMA_BY_STATUS.get(origin_status)
    parsed_metadata = (
        metadata_schema(**(payload.metadata_json or {})) if metadata_schema else None
    )

    event, next_qr = await process_scan(
        db=db,
        qr=qr,
        user=current_user,
    )

    # Despacha pra função tipada do contrato.
    if current_user.wallet_encrypted_key and parsed_metadata is not None:
        tx_hash, block_number = await _dispatch_chain_event(
            origin_status=origin_status,
            batch_id=str(qr.batch_id),
            scan_payload=payload,
            metadata=parsed_metadata,
            actor_encrypted_key=current_user.wallet_encrypted_key,
        )
        if tx_hash:
            event.tx_hash = tx_hash
            event.block_number = block_number

    return QRScanResponse(
        batch_id=qr.batch_id,
        batch_code=qr.batch.code,
        new_status=qr.batch.status,
        event=event,
        next_qr_token=next_qr.token if next_qr else None,
        is_final=qr.batch.status == BatchStatus.CERTIFIED,
    )


# ---------- imagem ----------

@router.get("/qr/{token}/image")
async def qr_image(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Retorna a imagem PNG do QR code."""
    qr = await get_qr_token(db, token)
    if not qr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code não encontrado.")

    png = generate_qr_image(token)
    return Response(content=png, media_type="image/png")


# ---------- QR ativo do lote ----------

@router.get("/batches/{batch_id}/qr", response_model=QRTokenInfo)
async def batch_active_qr(
    batch_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna o QR code ativo de um lote."""
    qr = await get_active_qr_for_batch(db, batch_id)
    if not qr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhum QR ativo para este lote.")

    batch = await db.get(Batch, qr.batch_id)
    return QRTokenInfo(
        token=qr.token,
        batch_id=batch.id,
        batch_code=batch.code,
        batch_status=batch.status,
        next_status=qr.next_status,
        expected_role=qr.expected_role,
        is_consumer=qr.is_consumer,
        is_active=qr.is_active,
    )


# ---------- rastreio público (consumidor) ----------

@router.get("/trace/{token}", response_model=TraceResponse)
async def public_trace(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Visão pública de rastreio — consumidor escaneia o QR e vê todo
    o histórico do lote. Dados lidos diretamente da blockchain.
    """
    qr = await get_qr_token(db, token)
    if not qr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR code não encontrado.")
    if not qr.is_consumer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este QR não é um código de rastreio público.")

    batch = qr.batch

    # Lê dados do lote da blockchain
    chain_batch = get_batch_from_chain(str(batch.id))
    batch_data = chain_batch["data"] if chain_batch else {}

    # Lê eventos da blockchain
    chain_events = get_events_from_chain(str(batch.id))
    trace_events = []
    for ev in chain_events:
        ev_data = dict(ev.get("data", {}))
        # `from_location` é o equivalente de `location` para eventos de transporte.
        location = ev_data.pop("location", None) or ev_data.pop("from_location", None)
        notes = ev_data.pop("notes", None)
        trace_events.append(TraceEvent(
            event_type=ev["event_type"],
            actor_address=ev["actor_address"],
            location=location,
            notes=notes,
            metadata=ev_data or None,
            timestamp=ev["timestamp"],
            block_number=ev["block_number"],
        ))

    # Resumo da propriedade e certificação Certifica Minas
    prop_summary: TracePropertySummary | None = None
    trace_cert: TraceCertification | None = None
    result = await db.execute(select(Property).where(Property.id == batch.property_id))
    prop = result.scalar_one_or_none()
    if prop:
        prop_summary = TracePropertySummary(
            id=prop.id,
            name=prop.name,
            municipality=prop.municipality,
            state=prop.state,
        )
        cert = await get_active_certification(db, prop.id)
        if cert:
            trace_cert = TraceCertification(
                id=cert.id,
                issued_at=cert.issued_at,
                valid_until=cert.valid_until,
                is_active=cert.is_active,
                on_chain_hash=cert.on_chain_hash,
                tx_hash=cert.tx_hash,
                block_number=cert.block_number,
            )

    return TraceResponse(
        code=batch.code,
        status=batch.status,
        tx_hash=batch.tx_hash,
        created_at=batch.created_at,
        coffee_type=batch_data.get("coffee_type"),
        weight_kg=batch_data.get("weight_kg"),
        origin_farm=batch_data.get("origin_farm"),
        origin_city=batch_data.get("origin_city"),
        origin_state=batch_data.get("origin_state"),
        harvest_date=batch_data.get("harvest_date"),
        owner_address=chain_batch["owner_address"] if chain_batch else None,
        property_=prop_summary,
        certification=trace_cert,
        events=trace_events,
    )

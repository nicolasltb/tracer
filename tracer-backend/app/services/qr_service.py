"""
Serviço de QR Code — geração de tokens, validação e imagens.

Define o fluxo da cadeia:
  HARVESTED  → PROCESSING   (PROCESSOR)
  PROCESSING → ROASTING     (PROCESSOR)
  ROASTING   → IN_TRANSIT   (TRANSPORTER)
  IN_TRANSIT → DELIVERED     (TRANSPORTER)
  DELIVERED  → CERTIFIED    (AUDITOR)
  CERTIFIED  → consumidor   (QR público, somente leitura)
"""

import io
import logging
import secrets
from datetime import datetime, timezone

import segno
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models.batch import Batch, BatchStatus
from app.models.event import BatchEvent, EventType
from app.models.qr_token import QRToken
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

# ---------- fluxo de status ----------

STATUS_FLOW: dict[BatchStatus, tuple[BatchStatus, UserRole, EventType]] = {
    BatchStatus.HARVESTED: (BatchStatus.PROCESSING, UserRole.PROCESSOR, EventType.PROCESSING_START),
    BatchStatus.PROCESSING: (BatchStatus.ROASTING, UserRole.PROCESSOR, EventType.ROASTING_START),
    BatchStatus.ROASTING: (BatchStatus.IN_TRANSIT, UserRole.TRANSPORTER, EventType.PICKUP),
    BatchStatus.IN_TRANSIT: (BatchStatus.DELIVERED, UserRole.TRANSPORTER, EventType.DELIVERY),
    BatchStatus.DELIVERED: (BatchStatus.CERTIFIED, UserRole.AUDITOR, EventType.CERTIFICATION),
}


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


# ---------- criação de tokens ----------

async def create_chain_qr(
    db: AsyncSession,
    batch: Batch,
) -> QRToken | None:
    """
    Cria um QR token para a próxima etapa da cadeia.
    Desativa qualquer QR ativo anterior do mesmo lote.
    Retorna None se o lote já está no estado final (CERTIFIED).
    """
    flow = STATUS_FLOW.get(batch.status)
    if flow is None:
        return None

    next_status, expected_role, _ = flow

    await _deactivate_active_tokens(db, batch.id)

    qr = QRToken(
        batch_id=batch.id,
        token=_generate_token(),
        next_status=next_status,
        expected_role=expected_role,
        is_active=True,
        is_consumer=False,
    )
    db.add(qr)
    await db.flush()
    logger.info("QR chain criado: batch=%s next=%s role=%s", batch.code, next_status.value, expected_role.value)
    return qr


async def create_consumer_qr(
    db: AsyncSession,
    batch: Batch,
) -> QRToken:
    """Cria o QR público do consumidor para um lote certificado."""
    qr = QRToken(
        batch_id=batch.id,
        token=_generate_token(),
        next_status=None,
        expected_role=None,
        is_active=True,
        is_consumer=True,
    )
    db.add(qr)
    await db.flush()
    logger.info("QR consumidor criado: batch=%s", batch.code)
    return qr


# ---------- validação ----------

async def get_qr_token(db: AsyncSession, token: str) -> QRToken | None:
    result = await db.execute(
        select(QRToken)
        .where(QRToken.token == token)
        .options(selectinload(QRToken.batch))
    )
    return result.scalar_one_or_none()


async def get_active_qr_for_batch(db: AsyncSession, batch_id) -> QRToken | None:
    result = await db.execute(
        select(QRToken)
        .where(QRToken.batch_id == batch_id, QRToken.is_active == True)  # noqa: E712
        .order_by(QRToken.created_at.desc())
    )
    return result.scalar_one_or_none()


# ---------- processamento do scan ----------

async def process_scan(
    db: AsyncSession,
    qr: QRToken,
    user: User,
) -> tuple[BatchEvent, QRToken | None]:
    """
    Processa o escaneamento de um QR code:
    1. Atualiza status do lote
    2. Cria índice do evento no DB (dados vão para a blockchain no endpoint)
    3. Desativa QR atual
    4. Gera próximo QR (ou QR do consumidor se final)

    Retorna (evento_criado, próximo_qr_ou_None).
    """
    batch = qr.batch
    flow = STATUS_FLOW.get(batch.status)
    if flow is None:
        raise ValueError("Lote já está no estado final.")

    next_status, _, event_type = flow

    # Atualiza status do lote
    batch.status = next_status

    # Cria índice do evento no DB (sem dados — eles vão para a chain)
    event = BatchEvent(
        batch_id=batch.id,
        actor_id=user.id,
        event_type=event_type,
    )
    db.add(event)
    await db.flush()

    # Desativa QR atual
    qr.is_active = False
    qr.used_at = datetime.now(timezone.utc)
    qr.used_by_id = user.id

    # Gera próximo QR
    if next_status == BatchStatus.CERTIFIED:
        next_qr = await create_consumer_qr(db, batch)
    else:
        next_qr = await create_chain_qr(db, batch)

    return event, next_qr


# ---------- imagem QR ----------

def generate_qr_image(data: str, scale: int = 8) -> bytes:
    """Gera imagem PNG do QR code."""
    qr = segno.make(data, error="m")
    buf = io.BytesIO()
    qr.save(buf, kind="png", scale=scale, border=2)
    return buf.getvalue()


# ---------- helpers ----------

async def _deactivate_active_tokens(db: AsyncSession, batch_id) -> None:
    result = await db.execute(
        select(QRToken).where(QRToken.batch_id == batch_id, QRToken.is_active == True)  # noqa: E712
    )
    for token in result.scalars().all():
        token.is_active = False

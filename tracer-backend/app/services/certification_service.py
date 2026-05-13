"""
Emissão e consulta de certificações Certifica Minas.

A emissão é desencadeada quando uma Audit é submetida com todos os 14
ComplianceCheck em CONFORME ou NAO_APLICAVEL. A certificação calcula o
SHA-256 canônico do payload + hashes dos documentos referenciados na
auditoria, persiste o registro e tenta gravar o hash on-chain.

A integração on-chain é implementada na próxima etapa.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import Audit
from app.models.certification import Certification

logger = logging.getLogger(__name__)


async def get_active_certification(
    db: AsyncSession, property_id
) -> Certification | None:
    """Retorna a certificação ativa e válida da propriedade, se houver."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Certification)
        .where(
            Certification.property_id == property_id,
            Certification.is_active.is_(True),
            Certification.valid_until > now,
        )
        .order_by(Certification.issued_at.desc())
    )
    return result.scalars().first()


async def try_issue(
    db: AsyncSession, audit: Audit
) -> tuple[Certification | None, str]:
    """
    Tenta emitir certificação para a auditoria submetida.

    Retorna (certificação_ou_None, motivo).
    A implementação completa (hash + blockchain) será adicionada na
    próxima etapa.
    """
    logger.info(
        "Solicitação de emissão para audit=%s — implementação completa em etapa #5.",
        audit.id,
    )
    return None, "Emissão de certificação ainda não implementada."

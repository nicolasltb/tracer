"""
Emissão e consulta de certificações Certifica Minas.

A emissão é desencadeada quando uma Audit é submetida com todos os 14
ComplianceCheck em CONFORME ou NAO_APLICAVEL. O serviço calcula o
SHA-256 canônico do payload da auditoria + hashes dos documentos
referenciados como evidência, persiste a Certification e tenta gravar
o hash on-chain via BlockchainService.
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import Audit, ComplianceCheckEvidence
from app.models.certification import Certification
from app.models.document import Document
from app.models.user import User
from app.services.audit_service import is_eligible_for_certification
from app.services.blockchain_service import record_certification_on_chain

logger = logging.getLogger(__name__)

CERTIFICATION_VALIDITY_DAYS = 365


async def get_active_certification(
    db: AsyncSession, property_id: uuid.UUID
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


async def _gather_evidence_hashes(
    db: AsyncSession, audit: Audit
) -> list[str]:
    """Retorna os SHA-256 ordenados de todos os documentos anexados como evidência."""
    check_ids = [c.id for c in audit.checks]
    if not check_ids:
        return []
    result = await db.execute(
        select(Document.sha256)
        .join(
            ComplianceCheckEvidence,
            ComplianceCheckEvidence.document_id == Document.id,
        )
        .where(ComplianceCheckEvidence.check_id.in_(check_ids))
    )
    hashes = [row[0] for row in result.all()]
    return sorted(set(hashes))


def _hash_notes(notes: str | None) -> str | None:
    if not notes:
        return None
    return hashlib.sha256(notes.encode("utf-8")).hexdigest()


def _build_payload(
    audit: Audit,
    issued_at: datetime,
    valid_until: datetime,
    doc_hashes: list[str],
) -> dict:
    """Monta o payload canônico (JSON com chaves ordenadas) que será hasheado."""
    checks_payload = sorted(
        [
            {
                "code": c.requirement_code.value,
                "status": c.status.value,
                "notes_sha256": _hash_notes(c.notes),
            }
            for c in audit.checks
        ],
        key=lambda c: c["code"],
    )
    return {
        "property_id": str(audit.property_id),
        "audit_id": str(audit.id),
        "auditor_id": str(audit.auditor_id),
        "issued_at": issued_at.isoformat(),
        "valid_until": valid_until.isoformat(),
        "audit_latitude": str(audit.latitude) if audit.latitude is not None else None,
        "audit_longitude": str(audit.longitude) if audit.longitude is not None else None,
        "checks": checks_payload,
        "doc_hashes": doc_hashes,
    }


def _hash_payload(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def _deactivate_existing(db: AsyncSession, property_id: uuid.UUID) -> None:
    """Marca certificações ativas anteriores como inativas (renovação)."""
    await db.execute(
        update(Certification)
        .where(
            Certification.property_id == property_id,
            Certification.is_active.is_(True),
        )
        .values(is_active=False)
    )


async def try_issue(
    db: AsyncSession, audit: Audit
) -> tuple[Certification | None, str]:
    """
    Tenta emitir certificação para a auditoria submetida.

    Retorna (cert, motivo). `motivo` traz a explicação quando a emissão
    é negada por requisitos pendentes.
    """
    eligible, reason = is_eligible_for_certification(audit)
    if not eligible:
        logger.info(
            "Audit %s submetida sem elegibilidade para cert: %s", audit.id, reason
        )
        return None, reason

    issued_at = datetime.now(timezone.utc)
    valid_until = issued_at + timedelta(days=CERTIFICATION_VALIDITY_DAYS)
    doc_hashes = await _gather_evidence_hashes(db, audit)
    payload = _build_payload(audit, issued_at, valid_until, doc_hashes)
    on_chain_hash = _hash_payload(payload)

    await _deactivate_existing(db, audit.property_id)

    cert = Certification(
        property_id=audit.property_id,
        audit_id=audit.id,
        issued_at=issued_at,
        valid_until=valid_until,
        is_active=True,
        on_chain_hash=on_chain_hash,
    )
    db.add(cert)
    await db.flush()

    auditor = await db.get(User, audit.auditor_id)
    if auditor and auditor.wallet_encrypted_key:
        tx_hash, block_number = await record_certification_on_chain(
            cert_id=str(cert.id),
            property_id=str(cert.property_id),
            on_chain_hash=on_chain_hash,
            valid_until_unix=int(valid_until.timestamp()),
            actor_encrypted_key=auditor.wallet_encrypted_key,
        )
        cert.tx_hash = tx_hash
        cert.block_number = block_number
        await db.flush()

    logger.info(
        "Certificação %s emitida para property=%s (hash=%s tx=%s)",
        cert.id,
        cert.property_id,
        on_chain_hash[:12],
        cert.tx_hash,
    )
    return cert, "Certificação emitida."

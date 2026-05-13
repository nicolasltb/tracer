"""
Serviço de auditoria: gestão de Audit, ComplianceCheck e evidências.

Regras-chave:
 - Audit em DRAFT pode ser editada apenas pelo auditor dono ou ADMIN.
 - Audit em SUBMITTED é imutável.
 - Cada (audit_id, requirement_code) tem no máximo um ComplianceCheck —
   gravações repetidas atualizam o check existente (upsert).
 - Para emitir certificação, a audit precisa ter os 14 checks e todos
   devem estar em CONFORME ou NAO_APLICAVEL.
"""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import (
    ALL_REQUIREMENTS,
    Audit,
    AuditStatus,
    ComplianceCheck,
    ComplianceCheckEvidence,
    ComplianceStatus,
    RequirementCode,
)
from app.models.document import Document
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────
# Lookups
# ─────────────────────────────────────────────────────────────────

async def get_audit_or_404(db: AsyncSession, audit_id: uuid.UUID) -> Audit:
    result = await db.execute(
        select(Audit)
        .where(Audit.id == audit_id)
        .options(
            selectinload(Audit.checks).selectinload(ComplianceCheck.evidence),
            selectinload(Audit.certification),
        )
    )
    audit = result.scalar_one_or_none()
    if not audit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Auditoria não encontrada."
        )
    return audit


def assert_can_read(user: User, audit: Audit, property_owner_id: uuid.UUID) -> None:
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.AUDITOR and audit.auditor_id == user.id:
        return
    if user.role == UserRole.FARMER and property_owner_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado a esta auditoria."
    )


def assert_can_edit_draft(user: User, audit: Audit) -> None:
    if audit.status != AuditStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Auditoria já foi submetida e está imutável.",
        )
    if user.role == UserRole.ADMIN:
        return
    if user.role == UserRole.AUDITOR and audit.auditor_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Apenas o auditor responsável pode editar esta auditoria.",
    )


# ─────────────────────────────────────────────────────────────────
# Compliance checks
# ─────────────────────────────────────────────────────────────────

async def upsert_check(
    db: AsyncSession,
    *,
    audit: Audit,
    requirement_code: RequirementCode,
    check_status: ComplianceStatus,
    notes: str | None,
    evidence_doc_ids: list[uuid.UUID],
) -> ComplianceCheck:
    """Cria ou atualiza o check daquele requirement_code na auditoria."""
    existing = next(
        (c for c in audit.checks if c.requirement_code == requirement_code), None
    )

    if existing is None:
        check = ComplianceCheck(
            audit_id=audit.id,
            requirement_code=requirement_code,
            status=check_status,
            notes=notes,
        )
        db.add(check)
        await db.flush()
        audit.checks.append(check)
    else:
        check = existing
        check.status = check_status
        check.notes = notes
        # remove evidências antigas; serão recriadas abaixo
        for ev in list(check.evidence):
            await db.delete(ev)
        await db.flush()

    if evidence_doc_ids:
        # valida que todos os documentos existem
        result = await db.execute(
            select(Document.id).where(Document.id.in_(evidence_doc_ids))
        )
        found = {row[0] for row in result.all()}
        missing = set(evidence_doc_ids) - found
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Documentos não encontrados: {[str(m) for m in missing]}",
            )
        for doc_id in evidence_doc_ids:
            db.add(ComplianceCheckEvidence(check_id=check.id, document_id=doc_id))
        await db.flush()

    return check


def is_eligible_for_certification(audit: Audit) -> tuple[bool, str]:
    """
    Verifica se a auditoria submetida pode emitir certificação.

    Retorna (elegível, motivo). Quando inelegível, `motivo` descreve a falha.
    """
    by_code = {c.requirement_code: c for c in audit.checks}
    missing = [r for r in ALL_REQUIREMENTS if r not in by_code]
    if missing:
        return False, f"Faltam checks para: {', '.join(m.value for m in missing)}."

    nao_conformes = [
        c.requirement_code.value
        for c in audit.checks
        if c.status == ComplianceStatus.NAO_CONFORME
    ]
    if nao_conformes:
        return False, f"Requisitos não conformes: {', '.join(nao_conformes)}."
    return True, ""


def evidence_doc_ids(check: ComplianceCheck) -> list[uuid.UUID]:
    """Lista os document_ids anexados a um check (na ordem de criação)."""
    return [ev.document_id for ev in check.evidence]

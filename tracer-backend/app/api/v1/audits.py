import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.audit import (
    Audit,
    AuditStatus,
    ComplianceCheck,
)
from app.models.property import Property
from app.models.user import User, UserRole
from app.schemas.audit import (
    AuditCreate,
    AuditDetail,
    AuditPatch,
    AuditPublic,
    AuditSubmit,
    AuditSubmitResponse,
    ComplianceCheckPublic,
    ComplianceCheckUpsert,
)
from app.services.audit_service import (
    assert_can_edit_draft,
    assert_can_read,
    evidence_doc_ids,
    get_audit_or_404,
    upsert_check,
)
from app.services.certification_service import try_issue
from app.services.property_service import get_property_or_404

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audits", tags=["Auditorias"])


def _to_public_check(check: ComplianceCheck) -> ComplianceCheckPublic:
    return ComplianceCheckPublic(
        id=check.id,
        audit_id=check.audit_id,
        requirement_code=check.requirement_code,
        status=check.status,
        notes=check.notes,
        evidence_doc_ids=evidence_doc_ids(check),
        created_at=check.created_at,
        updated_at=check.updated_at,
    )


def _to_detail(audit: Audit) -> AuditDetail:
    return AuditDetail(
        id=audit.id,
        property_id=audit.property_id,
        auditor_id=audit.auditor_id,
        status=audit.status,
        visit_date=audit.visit_date,
        latitude=audit.latitude,
        longitude=audit.longitude,
        notes=audit.notes,
        submitted_at=audit.submitted_at,
        created_at=audit.created_at,
        updated_at=audit.updated_at,
        checks=[_to_public_check(c) for c in audit.checks],
        certification_id=audit.certification.id if audit.certification else None,
    )


# ─────────────────────────────────────────────────────────────────
# Audits
# ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=AuditPublic, status_code=status.HTTP_201_CREATED)
async def create_audit(
    payload: AuditCreate,
    current_user: User = Depends(require_roles(UserRole.AUDITOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Auditor cria uma nova auditoria em DRAFT para uma propriedade existente."""
    await get_property_or_404(db, payload.property_id)

    audit = Audit(
        property_id=payload.property_id,
        auditor_id=current_user.id,
        status=AuditStatus.DRAFT,
        visit_date=payload.visit_date,
        notes=payload.notes,
    )
    db.add(audit)
    await db.flush()
    return audit


@router.get("/", response_model=list[AuditPublic])
async def list_audits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lista auditorias conforme o papel:
    - AUDITOR: as próprias
    - FARMER: das próprias propriedades
    - ADMIN: todas
    - Demais papéis: vazio
    """
    q = select(Audit)
    if current_user.role == UserRole.AUDITOR:
        q = q.where(Audit.auditor_id == current_user.id)
    elif current_user.role == UserRole.FARMER:
        q = q.join(Property, Property.id == Audit.property_id).where(
            Property.owner_id == current_user.id
        )
    elif current_user.role != UserRole.ADMIN:
        return []

    result = await db.execute(q.order_by(Audit.created_at.desc()))
    return result.scalars().all()


@router.get("/{audit_id}", response_model=AuditDetail)
async def get_audit(
    audit_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    audit = await get_audit_or_404(db, audit_id)

    # Carrega owner_id da propriedade para checagem de acesso do FARMER
    result = await db.execute(
        select(Property.owner_id).where(Property.id == audit.property_id)
    )
    owner_id = result.scalar_one()
    assert_can_read(current_user, audit, owner_id)

    return _to_detail(audit)


@router.patch("/{audit_id}", response_model=AuditPublic)
async def patch_audit(
    audit_id: uuid.UUID,
    payload: AuditPatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Atualiza visit_date e notes enquanto a auditoria está em DRAFT."""
    audit = await get_audit_or_404(db, audit_id)
    assert_can_edit_draft(current_user, audit)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(audit, key, value)
    await db.flush()
    return audit


# ─────────────────────────────────────────────────────────────────
# Checks
# ─────────────────────────────────────────────────────────────────

@router.post(
    "/{audit_id}/checks",
    response_model=ComplianceCheckPublic,
    status_code=status.HTTP_200_OK,
)
async def upsert_audit_check(
    audit_id: uuid.UUID,
    payload: ComplianceCheckUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cria ou atualiza um check da auditoria.

    Apenas o auditor dono (ou ADMIN) pode escrever, e apenas enquanto a
    auditoria está em DRAFT. A lista de evidências sobrescreve a anterior.
    """
    audit = await get_audit_or_404(db, audit_id)
    assert_can_edit_draft(current_user, audit)

    check = await upsert_check(
        db,
        audit=audit,
        requirement_code=payload.requirement_code,
        check_status=payload.status,
        notes=payload.notes,
        evidence_doc_ids=payload.evidence_doc_ids,
    )

    # Recarrega com evidências para serialização consistente
    result = await db.execute(
        select(ComplianceCheck)
        .where(ComplianceCheck.id == check.id)
        .options(selectinload(ComplianceCheck.evidence))
    )
    fresh = result.scalar_one()
    return _to_public_check(fresh)


@router.get(
    "/{audit_id}/checks", response_model=list[ComplianceCheckPublic]
)
async def list_audit_checks(
    audit_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    audit = await get_audit_or_404(db, audit_id)
    result = await db.execute(
        select(Property.owner_id).where(Property.id == audit.property_id)
    )
    owner_id = result.scalar_one()
    assert_can_read(current_user, audit, owner_id)
    return [_to_public_check(c) for c in audit.checks]


@router.delete(
    "/{audit_id}/checks/{check_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_audit_check(
    audit_id: uuid.UUID,
    check_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    audit = await get_audit_or_404(db, audit_id)
    assert_can_edit_draft(current_user, audit)

    check = next((c for c in audit.checks if c.id == check_id), None)
    if not check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Check não encontrado."
        )
    await db.delete(check)


# ─────────────────────────────────────────────────────────────────
# Submit
# ─────────────────────────────────────────────────────────────────

@router.post("/{audit_id}/submit", response_model=AuditSubmitResponse)
async def submit_audit(
    audit_id: uuid.UUID,
    payload: AuditSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submete a auditoria. Captura lat/long da posição do auditor no campo,
    marca a auditoria como SUBMITTED (imutável) e tenta emitir a certificação.
    """
    audit = await get_audit_or_404(db, audit_id)
    assert_can_edit_draft(current_user, audit)

    audit.latitude = payload.latitude
    audit.longitude = payload.longitude
    if payload.visit_date is not None:
        audit.visit_date = payload.visit_date
    if payload.notes is not None:
        audit.notes = payload.notes
    audit.submitted_at = datetime.now(timezone.utc)
    audit.status = AuditStatus.SUBMITTED
    await db.flush()

    certification, reason = await try_issue(db, audit)

    # Reconstrói a resposta a partir do estado atual; a certificação vem
    # diretamente do retorno de try_issue para evitar relação em cache.
    audit = await get_audit_or_404(db, audit_id)
    detail_dict = _to_detail(audit).model_dump()
    detail_dict["certification_id"] = certification.id if certification else None
    return AuditSubmitResponse(
        **detail_dict,
        certification_issued=certification is not None,
        certification_reason=reason or None,
    )

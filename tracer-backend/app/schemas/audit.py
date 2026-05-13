import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.audit import AuditStatus, ComplianceStatus, RequirementCode


# ---------- ComplianceCheck ----------

class ComplianceCheckUpsert(BaseModel):
    requirement_code: RequirementCode
    status: ComplianceStatus
    notes: str | None = None
    evidence_doc_ids: list[uuid.UUID] = []


class ComplianceCheckPublic(BaseModel):
    id: uuid.UUID
    audit_id: uuid.UUID
    requirement_code: RequirementCode
    status: ComplianceStatus
    notes: str | None
    evidence_doc_ids: list[uuid.UUID] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Audit ----------

class AuditCreate(BaseModel):
    property_id: uuid.UUID
    visit_date: datetime | None = None
    notes: str | None = None


class AuditPatch(BaseModel):
    visit_date: datetime | None = None
    notes: str | None = None


class AuditSubmit(BaseModel):
    latitude: Decimal = Field(..., ge=-90, le=90)
    longitude: Decimal = Field(..., ge=-180, le=180)
    visit_date: datetime | None = None
    notes: str | None = None


class AuditPublic(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    auditor_id: uuid.UUID
    status: AuditStatus
    visit_date: datetime | None
    latitude: Decimal | None
    longitude: Decimal | None
    notes: str | None
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AuditDetail(AuditPublic):
    checks: list[ComplianceCheckPublic] = []
    certification_id: uuid.UUID | None = None


class AuditSubmitResponse(AuditDetail):
    certification_issued: bool = False
    certification_reason: str | None = None

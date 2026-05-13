import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AuditStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


class ComplianceStatus(str, enum.Enum):
    CONFORME = "conforme"
    NAO_CONFORME = "nao_conforme"
    NAO_APLICAVEL = "nao_aplicavel"


class RequirementCode(str, enum.Enum):
    """Catálogo fixo dos 14 requisitos do Certifica Minas tratados pelo sistema."""

    REQ_4_1 = "4.1"
    REQ_B_3 = "B.3"
    REQ_C_3_1 = "C.3.1"
    REQ_C_3_2 = "C.3.2"
    REQ_C_3_6 = "C.3.6"
    REQ_C_4_1 = "C.4.1"
    REQ_C_5_1 = "C.5.1"
    REQ_C_6_3 = "C.6.3"
    REQ_D_1 = "D.1"
    REQ_D_2 = "D.2"
    REQ_D_3 = "D.3"
    REQ_D_4 = "D.4"
    REQ_D_5 = "D.5"
    REQ_D_6 = "D.6"


ALL_REQUIREMENTS: tuple[RequirementCode, ...] = tuple(RequirementCode)


class Audit(Base):
    """
    Auditoria presencial realizada por um AUDITOR em uma Property.

    Enquanto em DRAFT, os checks podem ser editados pelo auditor dono.
    Quando SUBMITTED, torna-se imutável e (se todos os 14 checks forem
    CONFORME ou NAO_APLICAVEL) emite a Certification correspondente.
    """

    __tablename__ = "audits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    auditor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    status: Mapped[AuditStatus] = mapped_column(
        Enum(AuditStatus, name="audit_status"),
        nullable=False,
        default=AuditStatus.DRAFT,
    )

    visit_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    notes: Mapped[str | None] = mapped_column(Text)

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    property_: Mapped["Property"] = relationship("Property", back_populates="audits")  # noqa: F821
    auditor: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="audits_performed", foreign_keys=[auditor_id]
    )
    checks: Mapped[list["ComplianceCheck"]] = relationship(
        "ComplianceCheck", back_populates="audit", cascade="all, delete-orphan"
    )
    certification: Mapped["Certification | None"] = relationship(  # noqa: F821
        "Certification", back_populates="audit", uselist=False
    )

    def __repr__(self) -> str:
        return f"<Audit property={self.property_id} [{self.status}]>"


class ComplianceCheck(Base):
    """Verificação de conformidade para um requisito específico em uma Audit."""

    __tablename__ = "compliance_checks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("audits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requirement_code: Mapped[RequirementCode] = mapped_column(
        Enum(RequirementCode, name="requirement_code"), nullable=False
    )
    status: Mapped[ComplianceStatus] = mapped_column(
        Enum(ComplianceStatus, name="compliance_status"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    audit: Mapped["Audit"] = relationship("Audit", back_populates="checks")
    evidence: Mapped[list["ComplianceCheckEvidence"]] = relationship(
        "ComplianceCheckEvidence", back_populates="check", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ComplianceCheck {self.requirement_code} [{self.status}]>"


class ComplianceCheckEvidence(Base):
    """Documento anexado como evidência a um ComplianceCheck."""

    __tablename__ = "compliance_check_evidence"

    check_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("compliance_checks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), primary_key=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    check: Mapped["ComplianceCheck"] = relationship("ComplianceCheck", back_populates="evidence")
    document: Mapped["Document"] = relationship("Document")  # noqa: F821

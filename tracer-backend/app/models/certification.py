import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Certification(Base):
    """
    Certificação Certifica Minas emitida para uma Property como resultado
    de uma Audit submetida com todos os requisitos CONFORME ou NAO_APLICAVEL.

    Validade de 12 meses a partir de issued_at. Pode ser revogada pelo ADMIN
    via is_active=False. O hash on-chain cobre o payload da cert + os SHA-256
    de todos os documentos referenciados na auditoria.
    """

    __tablename__ = "certifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("audits.id"), nullable=False, unique=True
    )

    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    on_chain_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    tx_hash: Mapped[str | None] = mapped_column(String(66))
    block_number: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    property_: Mapped["Property"] = relationship(  # noqa: F821
        "Property", back_populates="certifications"
    )
    audit: Mapped["Audit"] = relationship("Audit", back_populates="certification")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Certification property={self.property_id} active={self.is_active}>"

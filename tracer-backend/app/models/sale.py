import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SaleRecord(Base):
    """Registro de comercialização de café (requisito B.3)."""

    __tablename__ = "sale_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True, index=True
    )

    sale_date: Mapped[date] = mapped_column(Date, nullable=False)
    buyer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    buyer_document: Mapped[str | None] = mapped_column(String(32))
    quantity_kg: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    total_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    notes: Mapped[str | None] = mapped_column(Text)

    invoice_doc_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    property_: Mapped["Property"] = relationship("Property", back_populates="sales")  # noqa: F821
    batch: Mapped["Batch | None"] = relationship("Batch")  # noqa: F821
    invoice_doc: Mapped["Document | None"] = relationship(  # noqa: F821
        "Document", foreign_keys=[invoice_doc_id]
    )

    def __repr__(self) -> str:
        return f"<SaleRecord {self.buyer_name} {self.quantity_kg}kg @ {self.sale_date}>"

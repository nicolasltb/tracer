import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BatchStatus(str, enum.Enum):
    HARVESTED = "harvested"
    PROCESSING = "processing"
    ROASTING = "roasting"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CERTIFIED = "certified"


class CoffeeType(str, enum.Enum):
    ARABICA = "arabica"
    ROBUSTA = "robusta"
    BLEND = "blend"


class Batch(Base):
    """
    Índice local de um lote de café.

    Os dados completos (coffee_type, weight, origin, etc.) vivem na blockchain.
    O banco mantém apenas o necessário para controle de acesso, fluxo de QR
    e listagem rápida.
    """

    __tablename__ = "batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)

    status: Mapped[BatchStatus] = mapped_column(
        Enum(BatchStatus, name="batch_status"),
        nullable=False,
        default=BatchStatus.HARVESTED,
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    tx_hash: Mapped[str | None] = mapped_column(String(66))
    token_id: Mapped[str | None] = mapped_column(String(78))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="batches")  # noqa: F821
    events: Mapped[list["BatchEvent"]] = relationship(  # noqa: F821
        "BatchEvent", back_populates="batch", order_by="BatchEvent.created_at", lazy="select"
    )
    qr_tokens: Mapped[list["QRToken"]] = relationship(  # noqa: F821
        "QRToken", back_populates="batch", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Batch {self.code} [{self.status}]>"

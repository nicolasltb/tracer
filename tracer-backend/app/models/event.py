import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EventType(str, enum.Enum):
    HARVEST = "harvest"
    PROCESSING_START = "processing_start"
    PROCESSING_END = "processing_end"

    PICKUP = "pickup"
    IN_TRANSIT = "in_transit"
    DELIVERY = "delivery"

    ROASTING_START = "roasting_start"
    ROASTING_END = "roasting_end"
    PACKAGING = "packaging"

    INSPECTION = "inspection"
    CERTIFICATION = "certification"

    NOTE = "note"


class BatchEvent(Base):
    """
    Índice local de um evento de rastreabilidade.

    Os dados completos (location, metadata, notes) vivem na blockchain.
    O banco mantém apenas a referência para indexação e joins.
    """

    __tablename__ = "batch_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="event_type"), nullable=False
    )

    tx_hash: Mapped[str | None] = mapped_column(String(66), unique=True)
    block_number: Mapped[int | None] = mapped_column()

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    batch: Mapped["Batch"] = relationship("Batch", back_populates="events")  # noqa: F821
    actor: Mapped["User"] = relationship("User", back_populates="events")    # noqa: F821

    def __repr__(self) -> str:
        return f"<BatchEvent {self.event_type} on batch {self.batch_id}>"

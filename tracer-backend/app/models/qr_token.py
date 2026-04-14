import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.batch import BatchStatus
from app.models.user import UserRole


class QRToken(Base):
    """
    Token QR que vincula um lote à próxima etapa da cadeia.
    Cada QR ativo aponta para o próximo status esperado e o papel
    do ator que deve escaneá-lo.
    """

    __tablename__ = "qr_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )

    next_status: Mapped[BatchStatus | None] = mapped_column(
        Enum(BatchStatus, name="batch_status", create_type=False),
        nullable=True,
    )
    expected_role: Mapped[UserRole | None] = mapped_column(
        Enum(UserRole, name="user_role", create_type=False),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_consumer: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    used_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    batch: Mapped["Batch"] = relationship("Batch", back_populates="qr_tokens")  # noqa: F821
    used_by: Mapped["User | None"] = relationship("User")  # noqa: F821

    def __repr__(self) -> str:
        return f"<QRToken {self.token[:8]}… batch={self.batch_id} active={self.is_active}>"

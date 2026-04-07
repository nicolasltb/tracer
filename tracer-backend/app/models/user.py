import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    FARMER = "farmer"
    PROCESSOR = "processor"
    TRANSPORTER = "transporter"
    AUDITOR = "auditor"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False, default=UserRole.FARMER
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    wallet_address: Mapped[str | None] = mapped_column(String(42), unique=True)
    wallet_encrypted_key: Mapped[str | None] = mapped_column(String(1024))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    batches: Mapped[list["Batch"]] = relationship(  # noqa: F821
        "Batch", back_populates="owner", lazy="select"
    )
    events: Mapped[list["BatchEvent"]] = relationship(  # noqa: F821
        "BatchEvent", back_populates="actor", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<User {self.email} [{self.role}]>"

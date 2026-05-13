import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PropertyAreaType(str, enum.Enum):
    COFFEE = "coffee"
    NATIVE_FOREST = "native_forest"
    APP = "app"
    BUILDINGS = "buildings"
    WATER_BODIES = "water_bodies"
    OTHER = "other"


class WaterSourceType(str, enum.Enum):
    NASCENTE = "nascente"
    CURSO_AGUA = "curso_agua"
    POCO = "poco"
    OTHER = "other"


class Property(Base):
    """
    Propriedade rural certificável segundo o Certifica Minas.

    Pertence a um usuário com papel FARMER. Agrupa áreas de uso do solo,
    fontes de água, registros de venda, auditorias e certificações.
    """

    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    municipality: Mapped[str] = mapped_column(String(120), nullable=False)
    state: Mapped[str] = mapped_column(String(2), nullable=False, default="MG")
    total_area_ha: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    employees_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    map_doc_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="properties", foreign_keys=[owner_id]
    )
    map_doc: Mapped["Document | None"] = relationship(  # noqa: F821
        "Document", foreign_keys=[map_doc_id]
    )
    areas: Mapped[list["PropertyArea"]] = relationship(
        "PropertyArea", back_populates="property_", cascade="all, delete-orphan"
    )
    water_sources: Mapped[list["WaterSource"]] = relationship(
        "WaterSource", back_populates="property_", cascade="all, delete-orphan"
    )
    sales: Mapped[list["SaleRecord"]] = relationship(  # noqa: F821
        "SaleRecord", back_populates="property_", cascade="all, delete-orphan"
    )
    audits: Mapped[list["Audit"]] = relationship(  # noqa: F821
        "Audit", back_populates="property_", cascade="all, delete-orphan"
    )
    certifications: Mapped[list["Certification"]] = relationship(  # noqa: F821
        "Certification", back_populates="property_", cascade="all, delete-orphan"
    )
    batches: Mapped[list["Batch"]] = relationship(  # noqa: F821
        "Batch", back_populates="property_"
    )

    def __repr__(self) -> str:
        return f"<Property {self.name} owner={self.owner_id}>"


class PropertyArea(Base):
    """Área da propriedade segmentada por tipo de uso do solo (requisito 4.1)."""

    __tablename__ = "property_areas"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    area_type: Mapped[PropertyAreaType] = mapped_column(
        Enum(PropertyAreaType, name="property_area_type"), nullable=False
    )
    area_ha: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    property_: Mapped["Property"] = relationship("Property", back_populates="areas")

    def __repr__(self) -> str:
        return f"<PropertyArea {self.area_type} {self.area_ha}ha>"


class WaterSource(Base):
    """Fonte de água da propriedade (requisitos C.3.1, C.3.2, C.3.6)."""

    __tablename__ = "water_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[WaterSourceType] = mapped_column(
        Enum(WaterSourceType, name="water_source_type"), nullable=False
    )
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    description: Mapped[str | None] = mapped_column(Text)
    is_protected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    protection_notes: Mapped[str | None] = mapped_column(Text)

    photo_doc_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    property_: Mapped["Property"] = relationship("Property", back_populates="water_sources")
    photo_doc: Mapped["Document | None"] = relationship(  # noqa: F821
        "Document", foreign_keys=[photo_doc_id]
    )

    def __repr__(self) -> str:
        return f"<WaterSource {self.name} [{self.source_type}]>"

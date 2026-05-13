import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.property import PropertyAreaType, WaterSourceType


# ---------- Property ----------

class PropertyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    address: str = Field(..., min_length=3)
    municipality: str = Field(..., min_length=2, max_length=120)
    state: str = Field("MG", min_length=2, max_length=2)
    total_area_ha: Decimal = Field(..., gt=0)
    employees_count: int = Field(0, ge=0)
    map_doc_id: uuid.UUID | None = None


class PropertyUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    address: str | None = Field(None, min_length=3)
    municipality: str | None = Field(None, min_length=2, max_length=120)
    state: str | None = Field(None, min_length=2, max_length=2)
    total_area_ha: Decimal | None = Field(None, gt=0)
    employees_count: int | None = Field(None, ge=0)
    map_doc_id: uuid.UUID | None = None


class PropertyPublic(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    address: str
    municipality: str
    state: str
    total_area_ha: Decimal
    employees_count: int
    map_doc_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- PropertyArea ----------

class PropertyAreaCreate(BaseModel):
    area_type: PropertyAreaType
    area_ha: Decimal = Field(..., gt=0)
    description: str | None = None


class PropertyAreaUpdate(BaseModel):
    area_type: PropertyAreaType | None = None
    area_ha: Decimal | None = Field(None, gt=0)
    description: str | None = None


class PropertyAreaPublic(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    area_type: PropertyAreaType
    area_ha: Decimal
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- WaterSource ----------

class WaterSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    source_type: WaterSourceType
    latitude: Decimal | None = Field(None, ge=-90, le=90)
    longitude: Decimal | None = Field(None, ge=-180, le=180)
    description: str | None = None
    is_protected: bool = False
    protection_notes: str | None = None
    photo_doc_id: uuid.UUID | None = None


class WaterSourceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    source_type: WaterSourceType | None = None
    latitude: Decimal | None = Field(None, ge=-90, le=90)
    longitude: Decimal | None = Field(None, ge=-180, le=180)
    description: str | None = None
    is_protected: bool | None = None
    protection_notes: str | None = None
    photo_doc_id: uuid.UUID | None = None


class WaterSourcePublic(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    name: str
    source_type: WaterSourceType
    latitude: Decimal | None
    longitude: Decimal | None
    description: str | None
    is_protected: bool
    protection_notes: str | None
    photo_doc_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Property detail ----------

class PropertyDetail(PropertyPublic):
    areas: list[PropertyAreaPublic] = []
    water_sources: list[WaterSourcePublic] = []

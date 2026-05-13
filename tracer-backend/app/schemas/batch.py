import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.batch import BatchStatus, CoffeeType


# ---------- Request ----------

class BatchCreate(BaseModel):
    property_id: uuid.UUID
    coffee_type: CoffeeType
    weight_kg: float = Field(..., gt=0)
    harvest_date: datetime
    description: str | None = None


class BatchStatusUpdate(BaseModel):
    status: BatchStatus


# ---------- Response: DB index (list view) ----------

class BatchPublic(BaseModel):
    """Dados mínimos do DB — usados para listagem rápida."""

    id: uuid.UUID
    code: str
    status: BatchStatus
    owner_id: uuid.UUID
    property_id: uuid.UUID
    tx_hash: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BatchCreateResponse(BatchPublic):
    """Resposta da criação de lote — inclui o token QR para a próxima etapa."""

    qr_token: str | None = None


# ---------- Response: Chain data (detail view) ----------

class BatchChainData(BaseModel):
    """Dados completos do lote lidos da blockchain."""

    coffee_type: str | None = None
    weight_kg: float | None = None
    origin_farm: str | None = None
    origin_city: str | None = None
    origin_state: str | None = None
    harvest_date: str | None = None
    description: str | None = None


class EventChainData(BaseModel):
    """Dados completos de um evento lidos da blockchain."""

    event_type: str
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    metadata: dict[str, Any] | None = None
    notes: str | None = None
    actor_address: str
    timestamp: datetime
    block_number: int
    tx_hash: str | None = None


class BatchDetail(BaseModel):
    """Lote completo: índice do DB + dados da blockchain."""

    # DB index
    id: uuid.UUID
    code: str
    status: BatchStatus
    owner_id: uuid.UUID
    property_id: uuid.UUID
    tx_hash: str | None
    created_at: datetime

    # Chain data
    chain: BatchChainData | None = None

    # Events from chain
    events: list[EventChainData] = []


class BatchWithEvents(BatchPublic):
    """Fallback — quando chain não disponível, retorna apenas DB index + event refs."""

    events: list[dict] = []

    model_config = {"from_attributes": True}

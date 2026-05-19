import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.event import EventType


# ---------- DB index (minimal) ----------

class EventIndex(BaseModel):
    """Referência mínima do DB — o conteúdo vem da blockchain."""

    id: uuid.UUID
    batch_id: uuid.UUID
    actor_id: uuid.UUID
    event_type: EventType
    tx_hash: str | None
    block_number: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Alias for backwards compat ----------

EventPublic = EventIndex


# ---------- Chain-sourced event (full data) ----------

class EventChainData(BaseModel):
    """
    Evento lido da blockchain.

    `event_type` reflete o EventKind do contrato. Campos específicos da etapa
    (method, roast_level, vehicle_id, etc.) ficam em `metadata`.
    """

    event_type: str
    location: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None
    actor_address: str
    timestamp: datetime
    block_number: int

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.models.batch import BatchStatus
from app.models.event import EventType
from app.models.user import UserRole
from app.schemas.event import EventIndex


class QRTokenInfo(BaseModel):
    """Informações sobre um QR code escaneado."""

    token: str
    batch_id: uuid.UUID
    batch_code: str
    batch_status: BatchStatus
    next_status: BatchStatus | None
    expected_role: UserRole | None
    is_consumer: bool
    is_active: bool

    model_config = {"from_attributes": True}


# ---------- Metadata schemas por etapa ----------

class ProcessingMetadata(BaseModel):
    """Metadados da etapa de processamento (batch HARVESTED → PROCESSING)."""

    processing_method: Literal["washed", "natural", "honey", "pulped_natural"] | None = None


class RoastingMetadata(BaseModel):
    """Metadados da etapa de torra (batch PROCESSING → ROASTING)."""

    temperature_c: float | None = None
    humidity_pct: float | None = None
    duration_min: float | None = None
    roast_level: Literal["light", "medium", "dark"] | None = None


class TransportMetadata(BaseModel):
    """Metadados da etapa de coleta/transporte (batch ROASTING → IN_TRANSIT)."""

    transport_type: Literal["road", "sea", "rail"] | None = None
    vehicle_id: str | None = None


class DeliveryMetadata(BaseModel):
    """Metadados da etapa de entrega (batch IN_TRANSIT → DELIVERED)."""

    delivery_condition: Literal["good", "partial", "damaged"] | None = None
    recipient_name: str | None = None


class CertificationMetadata(BaseModel):
    """Metadados da etapa de certificação (batch DELIVERED → CERTIFIED)."""

    certificate_number: str | None = None
    certification_standard: Literal["organic", "fair_trade", "rainforest_alliance", "other"] | None = None


# Mapa de status → schema de metadados esperado
METADATA_SCHEMA_BY_STATUS: dict[BatchStatus, type[BaseModel]] = {
    BatchStatus.HARVESTED: ProcessingMetadata,
    BatchStatus.PROCESSING: RoastingMetadata,
    BatchStatus.ROASTING: TransportMetadata,
    BatchStatus.IN_TRANSIT: DeliveryMetadata,
    BatchStatus.DELIVERED: CertificationMetadata,
}


class QRScanRequest(BaseModel):
    """Dados enviados ao escanear um QR code para avançar a etapa."""

    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    metadata_json: dict[str, Any] | None = None
    notes: str | None = None


class QRScanResponse(BaseModel):
    """Resposta após escanear e processar um QR code."""

    batch_id: uuid.UUID
    batch_code: str
    new_status: BatchStatus
    event: EventIndex
    next_qr_token: str | None = None
    is_final: bool = False


class TraceEvent(BaseModel):
    """Evento na visão pública (consumidor) — dados da blockchain."""

    event_type: str
    actor_address: str
    location: str | None = None
    notes: str | None = None
    metadata: dict[str, Any] | None = None
    timestamp: datetime
    block_number: int


class TraceResponse(BaseModel):
    """Rastreio completo de um lote — dados da blockchain."""

    code: str
    status: BatchStatus
    tx_hash: str | None
    created_at: datetime
    # Dados do lote lidos da chain
    coffee_type: str | None = None
    weight_kg: float | None = None
    origin_farm: str | None = None
    origin_city: str | None = None
    origin_state: str | None = None
    harvest_date: str | None = None
    owner_address: str | None = None
    events: list[TraceEvent]

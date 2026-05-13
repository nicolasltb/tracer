import uuid
from datetime import datetime

from pydantic import BaseModel


class CertificationPublic(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    audit_id: uuid.UUID
    issued_at: datetime
    valid_until: datetime
    is_active: bool
    on_chain_hash: str
    tx_hash: str | None
    block_number: int | None
    created_at: datetime

    model_config = {"from_attributes": True}

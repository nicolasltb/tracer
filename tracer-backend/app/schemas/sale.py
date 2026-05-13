import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class SaleRecordCreate(BaseModel):
    batch_id: uuid.UUID | None = None
    sale_date: date
    buyer_name: str = Field(..., min_length=1, max_length=255)
    buyer_document: str | None = Field(None, max_length=32)
    quantity_kg: Decimal = Field(..., gt=0)
    unit_price: Decimal | None = Field(None, gt=0)
    total_value: Decimal | None = Field(None, gt=0)
    notes: str | None = None
    invoice_doc_id: uuid.UUID | None = None


class SaleRecordPublic(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    batch_id: uuid.UUID | None
    sale_date: date
    buyer_name: str
    buyer_document: str | None
    quantity_kg: Decimal
    unit_price: Decimal | None
    total_value: Decimal | None
    notes: str | None
    invoice_doc_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

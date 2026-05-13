import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.document import DocumentType


class DocumentPublic(BaseModel):
    id: uuid.UUID
    uploaded_by_id: uuid.UUID
    doc_type: DocumentType
    filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    created_at: datetime

    model_config = {"from_attributes": True}

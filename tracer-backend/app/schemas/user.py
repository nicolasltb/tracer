import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserPublic(BaseModel):
    """Dados públicos do usuário — nunca expõe a chave privada."""

    id: uuid.UUID
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    wallet_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None

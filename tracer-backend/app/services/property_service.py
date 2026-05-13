"""
Lookups e regras de acesso comuns a Property e seus filhos.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.property import Property
from app.models.user import User, UserRole


async def get_property_or_404(db: AsyncSession, property_id: uuid.UUID) -> Property:
    result = await db.execute(
        select(Property)
        .where(Property.id == property_id)
        .options(
            selectinload(Property.areas),
            selectinload(Property.water_sources),
        )
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Propriedade não encontrada."
        )
    return prop


def assert_can_read(user: User, prop: Property) -> None:
    """Owner, AUDITOR e ADMIN podem ler. Demais papéis: 403."""
    if user.role in (UserRole.AUDITOR, UserRole.ADMIN):
        return
    if prop.owner_id == user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Acesso negado a esta propriedade.",
    )


def assert_can_write(user: User, prop: Property) -> None:
    """Apenas owner e ADMIN podem alterar dados estruturais da propriedade."""
    if user.role == UserRole.ADMIN:
        return
    if prop.owner_id == user.id and user.role == UserRole.FARMER:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Apenas o proprietário ou ADMIN pode modificar esta propriedade.",
    )

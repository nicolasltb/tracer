import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.property import Property, PropertyArea, WaterSource
from app.models.sale import SaleRecord
from app.models.user import User, UserRole
from app.schemas.property import (
    PropertyAreaCreate,
    PropertyAreaPublic,
    PropertyAreaUpdate,
    PropertyCreate,
    PropertyDetail,
    PropertyPublic,
    PropertyUpdate,
    WaterSourceCreate,
    WaterSourcePublic,
    WaterSourceUpdate,
)
from app.schemas.sale import SaleRecordCreate, SaleRecordPublic
from app.services.property_service import (
    assert_can_read,
    assert_can_write,
    get_property_or_404,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/properties", tags=["Propriedades"])


# ─────────────────────────────────────────────────────────────────
# Properties
# ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=PropertyPublic, status_code=status.HTTP_201_CREATED)
async def create_property(
    payload: PropertyCreate,
    current_user: User = Depends(require_roles(UserRole.FARMER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Cria uma propriedade rural sob o usuário autenticado."""
    prop = Property(
        owner_id=current_user.id,
        name=payload.name,
        address=payload.address,
        municipality=payload.municipality,
        state=payload.state.upper(),
        total_area_ha=payload.total_area_ha,
        employees_count=payload.employees_count,
        map_doc_id=payload.map_doc_id,
    )
    db.add(prop)
    await db.flush()
    return prop


@router.get("/", response_model=list[PropertyPublic])
async def list_properties(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lista propriedades.
    - FARMER: apenas as próprias
    - AUDITOR / ADMIN: todas
    - Demais papéis: vazio (sem acesso)
    """
    q = select(Property)
    if current_user.role == UserRole.FARMER:
        q = q.where(Property.owner_id == current_user.id)
    elif current_user.role not in (UserRole.AUDITOR, UserRole.ADMIN):
        return []
    result = await db.execute(q.order_by(Property.created_at.desc()))
    return result.scalars().all()


@router.get("/{property_id}", response_model=PropertyDetail)
async def get_property(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_read(current_user, prop)
    return prop


@router.patch("/{property_id}", response_model=PropertyPublic)
async def update_property(
    property_id: uuid.UUID,
    payload: PropertyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_write(current_user, prop)

    data = payload.model_dump(exclude_unset=True)
    if "state" in data and data["state"]:
        data["state"] = data["state"].upper()
    for key, value in data.items():
        setattr(prop, key, value)

    await db.flush()
    return prop


# ─────────────────────────────────────────────────────────────────
# Property areas
# ─────────────────────────────────────────────────────────────────

@router.post(
    "/{property_id}/areas",
    response_model=PropertyAreaPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_area(
    property_id: uuid.UUID,
    payload: PropertyAreaCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_write(current_user, prop)

    area = PropertyArea(
        property_id=prop.id,
        area_type=payload.area_type,
        area_ha=payload.area_ha,
        description=payload.description,
    )
    db.add(area)
    await db.flush()
    return area


@router.get("/{property_id}/areas", response_model=list[PropertyAreaPublic])
async def list_areas(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_read(current_user, prop)
    return prop.areas


@router.patch(
    "/{property_id}/areas/{area_id}",
    response_model=PropertyAreaPublic,
)
async def update_area(
    property_id: uuid.UUID,
    area_id: uuid.UUID,
    payload: PropertyAreaUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_write(current_user, prop)

    result = await db.execute(
        select(PropertyArea).where(
            PropertyArea.id == area_id, PropertyArea.property_id == prop.id
        )
    )
    area = result.scalar_one_or_none()
    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Área não encontrada."
        )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(area, key, value)
    await db.flush()
    return area


@router.delete(
    "/{property_id}/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_area(
    property_id: uuid.UUID,
    area_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_write(current_user, prop)

    result = await db.execute(
        select(PropertyArea).where(
            PropertyArea.id == area_id, PropertyArea.property_id == prop.id
        )
    )
    area = result.scalar_one_or_none()
    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Área não encontrada."
        )
    await db.delete(area)


# ─────────────────────────────────────────────────────────────────
# Water sources
# ─────────────────────────────────────────────────────────────────

@router.post(
    "/{property_id}/water-sources",
    response_model=WaterSourcePublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_water_source(
    property_id: uuid.UUID,
    payload: WaterSourceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_write(current_user, prop)

    ws = WaterSource(
        property_id=prop.id,
        name=payload.name,
        source_type=payload.source_type,
        latitude=payload.latitude,
        longitude=payload.longitude,
        description=payload.description,
        is_protected=payload.is_protected,
        protection_notes=payload.protection_notes,
        photo_doc_id=payload.photo_doc_id,
    )
    db.add(ws)
    await db.flush()
    return ws


@router.get(
    "/{property_id}/water-sources", response_model=list[WaterSourcePublic]
)
async def list_water_sources(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_read(current_user, prop)
    return prop.water_sources


@router.patch(
    "/{property_id}/water-sources/{ws_id}",
    response_model=WaterSourcePublic,
)
async def update_water_source(
    property_id: uuid.UUID,
    ws_id: uuid.UUID,
    payload: WaterSourceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_write(current_user, prop)

    result = await db.execute(
        select(WaterSource).where(
            WaterSource.id == ws_id, WaterSource.property_id == prop.id
        )
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Fonte de água não encontrada."
        )

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ws, key, value)
    await db.flush()
    return ws


@router.delete(
    "/{property_id}/water-sources/{ws_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_water_source(
    property_id: uuid.UUID,
    ws_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_write(current_user, prop)

    result = await db.execute(
        select(WaterSource).where(
            WaterSource.id == ws_id, WaterSource.property_id == prop.id
        )
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Fonte de água não encontrada."
        )
    await db.delete(ws)


# ─────────────────────────────────────────────────────────────────
# Sales (B.3)
# ─────────────────────────────────────────────────────────────────

@router.post(
    "/{property_id}/sales",
    response_model=SaleRecordPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_sale(
    property_id: uuid.UUID,
    payload: SaleRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_write(current_user, prop)

    sale = SaleRecord(
        property_id=prop.id,
        batch_id=payload.batch_id,
        sale_date=payload.sale_date,
        buyer_name=payload.buyer_name,
        buyer_document=payload.buyer_document,
        quantity_kg=payload.quantity_kg,
        unit_price=payload.unit_price,
        total_value=payload.total_value,
        notes=payload.notes,
        invoice_doc_id=payload.invoice_doc_id,
    )
    db.add(sale)
    await db.flush()
    return sale


@router.get(
    "/{property_id}/sales", response_model=list[SaleRecordPublic]
)
async def list_sales(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prop = await get_property_or_404(db, property_id)
    assert_can_read(current_user, prop)

    result = await db.execute(
        select(SaleRecord)
        .where(SaleRecord.property_id == prop.id)
        .order_by(SaleRecord.sale_date.desc())
    )
    return result.scalars().all()

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.event import EventChainData
from app.services.blockchain_service import get_events_from_chain

router = APIRouter(prefix="/batches/{batch_id}/events", tags=["Eventos de Rastreabilidade"])


@router.get("/", response_model=list[EventChainData])
async def list_events(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lista todos os eventos de um lote lidos diretamente da blockchain.
    A blockchain é a fonte de verdade para dados de rastreabilidade.
    """
    chain_events_raw = get_events_from_chain(str(batch_id))
    events = []
    for ev in chain_events_raw:
        ev_data = dict(ev.get("data", {}))
        location = ev_data.pop("location", None) or ev_data.pop("from_location", None)
        notes = ev_data.pop("notes", None)
        events.append(EventChainData(
            event_type=ev["event_type"],
            location=location,
            notes=notes,
            metadata=ev_data or None,
            actor_address=ev["actor_address"],
            timestamp=ev["timestamp"],
            block_number=ev["block_number"],
        ))
    return events

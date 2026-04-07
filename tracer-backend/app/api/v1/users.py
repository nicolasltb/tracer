from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserPublic, UserUpdate

router = APIRouter(prefix="/users", tags=["Usuários"])


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)):
    """Retorna o perfil do usuário autenticado."""
    return current_user


@router.patch("/me", response_model=UserPublic)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Atualiza nome e/ou e-mail do usuário autenticado."""
    if payload.name is not None:
        current_user.name = payload.name
    if payload.email is not None:
        current_user.email = payload.email
    db.add(current_user)
    return current_user


@router.get("/me/wallet", response_model=dict)
async def get_my_wallet(current_user: User = Depends(get_current_user)):
    """Retorna o endereço da wallet do usuário (nunca a chave privada)."""
    return {
        "wallet_address": current_user.wallet_address,
        "role": current_user.role,
    }


@router.get(
    "/",
    response_model=list[UserPublic],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def list_users(db: AsyncSession = Depends(get_db)):
    """[Admin] Lista todos os usuários."""
    from sqlalchemy import select  # noqa: PLC0415
    from app.models.user import User as UserModel  # noqa: PLC0415
    result = await db.execute(select(UserModel))
    return result.scalars().all()

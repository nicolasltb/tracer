import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.blockchain_service import fund_wallet
from app.services.wallet_service import create_wallet

logger = logging.getLogger(__name__)


async def register_user(payload: RegisterRequest, db: AsyncSession) -> User:
    """
    Cadastra um novo usuário e cria uma wallet Ethereum automaticamente.
    """
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        logger.info("Cadastro rejeitado — e-mail já existente: %s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail já cadastrado.",
        )

    try:
        wallet_address, encrypted_key = create_wallet()
    except Exception:
        logger.exception("Falha ao criar wallet para novo usuário: %s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível criar a carteira. Tente novamente.",
        )

    try:
        fund_wallet(wallet_address)
    except Exception:
        logger.exception("Falha ao pré-financiar wallet %s para %s", wallet_address, payload.email)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível inicializar a carteira na blockchain. Tente novamente.",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        wallet_address=wallet_address,
        wallet_encrypted_key=encrypted_key,
    )
    db.add(user)
    await db.flush()
    logger.info("Usuário cadastrado: id=%s role=%s", user.id, user.role)
    return user


async def login_user(payload: LoginRequest, db: AsyncSession) -> TokenResponse:
    """
    Autentica o usuário e retorna access + refresh tokens.
    """
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        logger.warning("Credenciais inválidas para: %s", payload.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos.",
        )

    if not user.is_active:
        logger.warning("Login bloqueado — conta desativada: id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada.",
        )

    logger.info("Login bem-sucedido: id=%s role=%s", user.id, user.role)
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role),
        refresh_token=create_refresh_token(str(user.id)),
    )

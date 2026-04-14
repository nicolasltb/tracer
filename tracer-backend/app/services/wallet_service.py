"""
Serviço de carteiras Ethereum.

Fluxo no cadastro:
  1. Gera um novo par de chaves Ethereum via eth_account.
  2. Criptografa a chave privada com Fernet (chave do servidor).
  3. Armazena o endereço (público) e a chave criptografada no banco.

A chave privada NUNCA é retornada à API — ela é usada pelo servidor
apenas para assinar transações em nome do usuário (custódia gerenciada).
"""

import base64

from cryptography.fernet import Fernet
from eth_account import Account
from eth_account.signers.local import LocalAccount

from app.config import settings


def _get_fernet() -> Fernet:
    key = settings.WALLET_ENCRYPTION_KEY
    if not key:
        key = Fernet.generate_key().decode()
    return Fernet(key.encode())


def create_wallet() -> tuple[str, str]:
    """
    Cria uma nova carteira Ethereum.

    Retorna:
        (wallet_address, encrypted_private_key)
    """
    account: LocalAccount = Account.create()
    private_key_bytes = account.key

    fernet = _get_fernet()
    encrypted = fernet.encrypt(private_key_bytes)
    encrypted_b64 = base64.urlsafe_b64encode(encrypted).decode()

    return account.address, encrypted_b64


def decrypt_private_key(encrypted_b64: str) -> bytes:
    """
    Descriptografa a chave privada armazenada no banco.
    Usar apenas internamente para assinar transações.
    """
    fernet = _get_fernet()
    encrypted = base64.urlsafe_b64decode(encrypted_b64.encode())
    return fernet.decrypt(encrypted)


def get_account_from_db(encrypted_b64: str) -> LocalAccount:
    """Reconstrói o objeto LocalAccount a partir da chave criptografada."""
    private_key = decrypt_private_key(encrypted_b64)
    return Account.from_key(private_key)

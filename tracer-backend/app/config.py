from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/coffee_trace"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/coffee_trace"

    SECRET_KEY: str = "dev-secret-key-mude-em-producao"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    WALLET_ENCRYPTION_KEY: str = ""

    BESU_RPC_URL: str = "http://localhost:8545"
    BESU_CHAIN_ID: int = 1337
    CONTRACT_ADDRESS: str = "0x0000000000000000000000000000000000000000"

    # Conta com saldo pré-alocado no genesis. Usada para o deploy do contrato e
    # para pré-fundar wallets de novos usuários (rede privada — "ETH" sem valor real).
    FAUCET_PRIVATE_KEY: str = ""
    FAUCET_FUND_WEI: int = 10**18  # 1 ETH por wallet nova

    APP_BASE_URL: str = "http://localhost:8000"

    APP_ENV: str = "development"
    DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    STORAGE_ROOT: str = "/app/uploads"
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024
    ALLOWED_UPLOAD_MIME: list[str] = ["image/jpeg", "image/png", "application/pdf"]


settings = Settings()

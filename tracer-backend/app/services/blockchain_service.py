"""
Blockchain Connector — integração com a rede privada Hyperledger Besu.

A blockchain é a fonte de verdade para dados de lotes e eventos.
O banco de dados mantém apenas metadados operacionais (usuários, QR tokens, índices).

Escrita:
  - register_batch_on_chain  → grava lote com todos os campos (JSON)
  - register_event_on_chain  → grava evento com todos os campos (JSON)

Leitura:
  - get_batch_from_chain     → recupera dados completos de um lote
  - get_events_from_chain    → recupera todos os eventos de um lote
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from app.config import settings
from app.services.wallet_service import get_account_from_db

logger = logging.getLogger(__name__)

_ABI_PATH = Path(__file__).parent.parent / "abi" / "CoffeeTrace.json"


# ──────────────────────────────────────────────────────────────────────────────
# Conexão
# ──────────────────────────────────────────────────────────────────────────────

def get_web3() -> Web3:
    """Retorna uma instância Web3 conectada ao nó Besu."""
    w3 = Web3(Web3.HTTPProvider(settings.BESU_RPC_URL))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    if not w3.is_connected():
        logger.warning("Não foi possível conectar ao nó Besu em %s", settings.BESU_RPC_URL)
    return w3


def get_contract(w3: Web3):
    """Carrega o contrato inteligente a partir do ABI em disco."""
    if not _ABI_PATH.exists():
        raise FileNotFoundError(
            f"ABI não encontrado em {_ABI_PATH}. "
            "Faça o deploy do contrato e salve o ABI em app/abi/CoffeeTrace.json"
        )
    abi = json.loads(_ABI_PATH.read_text())
    return w3.eth.contract(
        address=Web3.to_checksum_address(settings.CONTRACT_ADDRESS),
        abi=abi,
    )


def _build_tx(w3: Web3, account, fn):
    """Monta, assina e envia uma transação; retorna o receipt."""
    tx = fn.build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 3_000_000,
            "gasPrice": 0,
            "chainId": settings.BESU_CHAIN_ID,
        }
    )
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    return w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)


# ──────────────────────────────────────────────────────────────────────────────
# Escrita
# ──────────────────────────────────────────────────────────────────────────────

async def register_batch_on_chain(
    batch_id: str,
    batch_code: str,
    batch_data: dict,
    owner_encrypted_key: str,
) -> str | None:
    """
    Registra um lote na blockchain com todos os seus dados.

    batch_data deve conter: coffee_type, weight_kg, origin_farm,
    origin_city, origin_state, harvest_date, description.

    Retorna o tx_hash ou None em caso de erro.
    """
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(owner_encrypted_key)

        data_json = json.dumps(batch_data, ensure_ascii=False, default=str)
        fn = contract.functions.registerBatch(batch_id, batch_code, data_json)
        receipt = _build_tx(w3, account, fn)

        logger.info("Lote %s registrado on-chain: %s", batch_code, receipt.transactionHash.hex())
        return receipt.transactionHash.hex()

    except Exception as exc:
        logger.error("Erro ao registrar lote na blockchain: %s", exc)
        return None


async def record_certification_on_chain(
    cert_id: str,
    property_id: str,
    on_chain_hash: str,
    valid_until_unix: int,
    actor_encrypted_key: str,
) -> tuple[str | None, int | None]:
    """
    Registra o hash de uma Certification do Certifica Minas na blockchain.

    O contrato é responsável por armazenar (cert_id, property_id, hash, valid_until)
    de forma imutável. Retorna (tx_hash, block_number) ou (None, None) em caso
    de falha — o sistema segue funcionando off-chain quando a rede está indisponível.
    """
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(actor_encrypted_key)

        fn = contract.functions.recordCertification(
            cert_id, property_id, on_chain_hash, valid_until_unix
        )
        receipt = _build_tx(w3, account, fn)

        logger.info(
            "Cert %s registrada on-chain: tx=%s block=%s",
            cert_id,
            receipt.transactionHash.hex(),
            receipt.blockNumber,
        )
        return receipt.transactionHash.hex(), receipt.blockNumber

    except Exception as exc:
        logger.error("Erro ao registrar certificação na blockchain: %s", exc)
        return None, None


async def register_event_on_chain(
    batch_id: str,
    event_type: str,
    event_data: dict,
    actor_encrypted_key: str,
) -> tuple[str | None, int | None]:
    """
    Registra um evento de rastreabilidade na blockchain com todos os dados.

    event_data deve conter: location, latitude, longitude,
    metadata (campos específicos da etapa), notes.

    Retorna (tx_hash, block_number) ou (None, None) em caso de erro.
    """
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(actor_encrypted_key)

        data_json = json.dumps(event_data, ensure_ascii=False, default=str)
        fn = contract.functions.addEvent(batch_id, event_type, data_json)
        receipt = _build_tx(w3, account, fn)

        return receipt.transactionHash.hex(), receipt.blockNumber

    except Exception as exc:
        logger.error("Erro ao registrar evento na blockchain: %s", exc)
        return None, None


# ──────────────────────────────────────────────────────────────────────────────
# Leitura
# ──────────────────────────────────────────────────────────────────────────────

def get_batch_from_chain(batch_id: str) -> dict | None:
    """
    Lê os dados completos de um lote diretamente da blockchain.

    Retorna dict com: batch_code, data (parsed JSON), owner_address,
    registered_at (datetime). Retorna None se o lote não existe on-chain.
    """
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        result = contract.functions.batches(batch_id).call()
        # result = (batchCode, data, owner, registeredAt, exists)
        if not result[4]:
            return None

        data = {}
        if result[1]:
            try:
                data = json.loads(result[1])
            except json.JSONDecodeError:
                data = {"_raw": result[1]}

        return {
            "batch_code": result[0],
            "data": data,
            "owner_address": result[2],
            "registered_at": datetime.fromtimestamp(result[3], tz=timezone.utc),
        }
    except Exception as exc:
        logger.error("Erro ao ler lote da blockchain: %s", exc)
        return None


def get_events_from_chain(batch_id: str) -> list[dict]:
    """
    Lê todos os eventos de um lote diretamente da blockchain.

    Retorna lista de dicts com: event_type, data (parsed JSON),
    actor_address, timestamp (datetime), block_number.
    """
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        count = contract.functions.getBatchEventCount(batch_id).call()

        events = []
        for i in range(count):
            result = contract.functions.getBatchEvent(batch_id, i).call()
            # result = (eventType, data, actor, timestamp, blockNumber)

            data = {}
            if result[1]:
                try:
                    data = json.loads(result[1])
                except json.JSONDecodeError:
                    data = {"_raw": result[1]}

            events.append({
                "event_type": result[0],
                "data": data,
                "actor_address": result[2],
                "timestamp": datetime.fromtimestamp(result[3], tz=timezone.utc),
                "block_number": result[4],
            })
        return events

    except Exception as exc:
        logger.error("Erro ao ler eventos da blockchain: %s", exc)
        return []

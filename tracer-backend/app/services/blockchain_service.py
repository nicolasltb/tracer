"""
Blockchain Connector — integração com a rede privada Hyperledger Besu.

A blockchain é a fonte de verdade. O contrato CoffeeTrace.sol expõe campos
tipados (enums + structs) — todas as conversões de tipo Python→Solidity
(float→inteiro escalado) acontecem aqui no service.

Convenções de escala (Solidity não suporta float):
    weightGrams      = kg * 1000
    latitudeE6       = grau decimal * 1_000_000
    longitudeE6      = grau decimal * 1_000_000
    temperatureCx100 = °C * 100
    humidityPctX100  = % * 100
"""

import json
import logging
from datetime import datetime, timezone
from enum import IntEnum
from pathlib import Path

from eth_account import Account
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from app.config import settings
from app.services.wallet_service import get_account_from_db

logger = logging.getLogger(__name__)

_ABI_PATH = Path(__file__).parent.parent / "abi" / "CoffeeTrace.json"


# ──────────────────────────────────────────────────────────────────────────────
# Enums espelhando o contrato (a ordem dos valores tem que bater com Solidity)
# ──────────────────────────────────────────────────────────────────────────────

class CoffeeTypeEnum(IntEnum):
    ARABICA = 0
    ROBUSTA = 1
    BLEND = 2


class ProcessingMethodEnum(IntEnum):
    WASHED = 0
    NATURAL = 1
    HONEY = 2
    PULPED_NATURAL = 3


class RoastLevelEnum(IntEnum):
    LIGHT = 0
    MEDIUM = 1
    DARK = 2


class TransportTypeEnum(IntEnum):
    ROAD = 0
    SEA = 1
    RAIL = 2


class DeliveryConditionEnum(IntEnum):
    GOOD = 0
    PARTIAL = 1
    DAMAGED = 2


class CertificationStandardEnum(IntEnum):
    ORGANIC = 0
    FAIR_TRADE = 1
    RAINFOREST_ALLIANCE = 2
    OTHER = 3


class EventKindEnum(IntEnum):
    PROCESSING = 0
    ROASTING = 1
    TRANSPORT = 2
    DELIVERY = 3
    CERTIFICATION_AUDIT = 4


# Mapas string→enum aceitando os valores que os schemas Pydantic produzem.
COFFEE_TYPE_MAP = {
    "arabica": CoffeeTypeEnum.ARABICA,
    "robusta": CoffeeTypeEnum.ROBUSTA,
    "blend": CoffeeTypeEnum.BLEND,
}
PROCESSING_METHOD_MAP = {
    "washed": ProcessingMethodEnum.WASHED,
    "natural": ProcessingMethodEnum.NATURAL,
    "honey": ProcessingMethodEnum.HONEY,
    "pulped_natural": ProcessingMethodEnum.PULPED_NATURAL,
}
ROAST_LEVEL_MAP = {
    "light": RoastLevelEnum.LIGHT,
    "medium": RoastLevelEnum.MEDIUM,
    "dark": RoastLevelEnum.DARK,
}
TRANSPORT_TYPE_MAP = {
    "road": TransportTypeEnum.ROAD,
    "sea": TransportTypeEnum.SEA,
    "rail": TransportTypeEnum.RAIL,
}
DELIVERY_CONDITION_MAP = {
    "good": DeliveryConditionEnum.GOOD,
    "partial": DeliveryConditionEnum.PARTIAL,
    "damaged": DeliveryConditionEnum.DAMAGED,
}
CERTIFICATION_STANDARD_MAP = {
    "organic": CertificationStandardEnum.ORGANIC,
    "fair_trade": CertificationStandardEnum.FAIR_TRADE,
    "rainforest_alliance": CertificationStandardEnum.RAINFOREST_ALLIANCE,
    "other": CertificationStandardEnum.OTHER,
}


# ──────────────────────────────────────────────────────────────────────────────
# Conexão
# ──────────────────────────────────────────────────────────────────────────────

def get_web3() -> Web3:
    w3 = Web3(Web3.HTTPProvider(settings.BESU_RPC_URL))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    if not w3.is_connected():
        logger.warning("Não foi possível conectar ao nó Besu em %s", settings.BESU_RPC_URL)
    return w3


def get_contract(w3: Web3):
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


# ──────────────────────────────────────────────────────────────────────────────
# Conversões numéricas (float ↔ inteiro escalado)
# ──────────────────────────────────────────────────────────────────────────────

def _kg_to_grams(kg: float) -> int:
    return int(round(kg * 1000))


def _grams_to_kg(grams: int) -> float:
    return grams / 1000


def _deg_to_e6(deg: float | None) -> int:
    return int(round((deg or 0.0) * 1_000_000))


def _e6_to_deg(e6: int) -> float:
    return e6 / 1_000_000


def _to_x100(value: float | None) -> int:
    return int(round((value or 0.0) * 100))


def _x100_to_float(value: int) -> float:
    return value / 100


def _datetime_to_unix(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


# ──────────────────────────────────────────────────────────────────────────────
# Faucet (pré-financia wallets — ver auth_service.register_user)
# ──────────────────────────────────────────────────────────────────────────────

def fund_wallet(address: str) -> str:
    """
    Pré-financia um endereço a partir da conta-faucet (saldo pré-alocado no genesis).

    Necessário porque o Besu QBFT descarta silenciosamente do tx-pool transações
    de contas que ainda não existem no state trie — mesmo com gasPrice=0.
    """
    if not settings.FAUCET_PRIVATE_KEY:
        raise RuntimeError("FAUCET_PRIVATE_KEY não configurada — wallets não podem ser pré-financiadas.")

    w3 = get_web3()
    faucet = Account.from_key(settings.FAUCET_PRIVATE_KEY)
    tx = {
        "from": faucet.address,
        "to": Web3.to_checksum_address(address),
        "value": settings.FAUCET_FUND_WEI,
        "gas": 21000,
        "gasPrice": 0,
        "nonce": w3.eth.get_transaction_count(faucet.address),
        "chainId": settings.BESU_CHAIN_ID,
    }
    signed = faucet.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
    if receipt.status != 1:
        raise RuntimeError(f"Faucet tx falhou (status={receipt.status}) para {address}")
    logger.info("Wallet %s pré-financiada: tx=%s", address, receipt.transactionHash.hex())
    return receipt.transactionHash.hex()


# ──────────────────────────────────────────────────────────────────────────────
# Helper de envio de tx
# ──────────────────────────────────────────────────────────────────────────────

def _send_tx(w3: Web3, account, fn):
    tx = fn.build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 3_000_000,
        "gasPrice": 0,
        "chainId": settings.BESU_CHAIN_ID,
    })
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    return w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)


# ──────────────────────────────────────────────────────────────────────────────
# Escrita: lote
# ──────────────────────────────────────────────────────────────────────────────

async def register_batch_on_chain(
    batch_id: str,
    batch_code: str,
    coffee_type: str,
    weight_kg: float,
    origin_farm: str,
    origin_city: str,
    origin_state: str,
    harvest_date: datetime,
    description: str | None,
    owner_encrypted_key: str,
) -> str | None:
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(owner_encrypted_key)

        fn = contract.functions.registerBatch(
            batch_id,
            batch_code,
            int(COFFEE_TYPE_MAP[coffee_type]),
            _kg_to_grams(weight_kg),
            origin_farm,
            origin_city,
            origin_state,
            _datetime_to_unix(harvest_date),
            description or "",
        )
        receipt = _send_tx(w3, account, fn)
        logger.info("Lote %s registrado on-chain: %s", batch_code, receipt.transactionHash.hex())
        return receipt.transactionHash.hex()

    except Exception as exc:
        logger.error("Erro ao registrar lote na blockchain: %s", exc)
        return None


# ──────────────────────────────────────────────────────────────────────────────
# Escrita: eventos
# ──────────────────────────────────────────────────────────────────────────────

async def add_processing_event_on_chain(
    batch_id: str,
    location: str | None,
    latitude: float | None,
    longitude: float | None,
    method: str,
    notes: str | None,
    actor_encrypted_key: str,
) -> tuple[str | None, int | None]:
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(actor_encrypted_key)

        fn = contract.functions.addProcessingEvent(
            batch_id,
            location or "",
            _deg_to_e6(latitude),
            _deg_to_e6(longitude),
            int(PROCESSING_METHOD_MAP[method]),
            notes or "",
        )
        receipt = _send_tx(w3, account, fn)
        return receipt.transactionHash.hex(), receipt.blockNumber
    except Exception as exc:
        logger.error("Erro ao adicionar processing event: %s", exc)
        return None, None


async def add_roasting_event_on_chain(
    batch_id: str,
    location: str | None,
    latitude: float | None,
    longitude: float | None,
    temperature_c: float | None,
    humidity_pct: float | None,
    duration_min: float | None,
    level: str,
    notes: str | None,
    actor_encrypted_key: str,
) -> tuple[str | None, int | None]:
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(actor_encrypted_key)

        fn = contract.functions.addRoastingEvent(
            batch_id,
            location or "",
            _deg_to_e6(latitude),
            _deg_to_e6(longitude),
            _to_x100(temperature_c),
            _to_x100(humidity_pct),
            int(round(duration_min or 0)),
            int(ROAST_LEVEL_MAP[level]),
            notes or "",
        )
        receipt = _send_tx(w3, account, fn)
        return receipt.transactionHash.hex(), receipt.blockNumber
    except Exception as exc:
        logger.error("Erro ao adicionar roasting event: %s", exc)
        return None, None


async def add_transport_event_on_chain(
    batch_id: str,
    from_location: str | None,
    latitude: float | None,
    longitude: float | None,
    transport_type: str,
    vehicle_id: str | None,
    notes: str | None,
    actor_encrypted_key: str,
) -> tuple[str | None, int | None]:
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(actor_encrypted_key)

        fn = contract.functions.addTransportEvent(
            batch_id,
            from_location or "",
            _deg_to_e6(latitude),
            _deg_to_e6(longitude),
            int(TRANSPORT_TYPE_MAP[transport_type]),
            vehicle_id or "",
            notes or "",
        )
        receipt = _send_tx(w3, account, fn)
        return receipt.transactionHash.hex(), receipt.blockNumber
    except Exception as exc:
        logger.error("Erro ao adicionar transport event: %s", exc)
        return None, None


async def add_delivery_event_on_chain(
    batch_id: str,
    location: str | None,
    latitude: float | None,
    longitude: float | None,
    condition: str,
    recipient_name: str | None,
    notes: str | None,
    actor_encrypted_key: str,
) -> tuple[str | None, int | None]:
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(actor_encrypted_key)

        fn = contract.functions.addDeliveryEvent(
            batch_id,
            location or "",
            _deg_to_e6(latitude),
            _deg_to_e6(longitude),
            int(DELIVERY_CONDITION_MAP[condition]),
            recipient_name or "",
            notes or "",
        )
        receipt = _send_tx(w3, account, fn)
        return receipt.transactionHash.hex(), receipt.blockNumber
    except Exception as exc:
        logger.error("Erro ao adicionar delivery event: %s", exc)
        return None, None


async def add_certification_audit_event_on_chain(
    batch_id: str,
    location: str | None,
    latitude: float | None,
    longitude: float | None,
    certificate_number: str | None,
    standard: str,
    notes: str | None,
    actor_encrypted_key: str,
) -> tuple[str | None, int | None]:
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(actor_encrypted_key)

        fn = contract.functions.addCertificationAuditEvent(
            batch_id,
            location or "",
            _deg_to_e6(latitude),
            _deg_to_e6(longitude),
            certificate_number or "",
            int(CERTIFICATION_STANDARD_MAP[standard]),
            notes or "",
        )
        receipt = _send_tx(w3, account, fn)
        return receipt.transactionHash.hex(), receipt.blockNumber
    except Exception as exc:
        logger.error("Erro ao adicionar certification audit event: %s", exc)
        return None, None


# ──────────────────────────────────────────────────────────────────────────────
# Escrita: Certifica Minas
# ──────────────────────────────────────────────────────────────────────────────

async def record_certification_on_chain(
    cert_id: str,
    property_id: str,
    on_chain_hash: str,
    valid_until_unix: int,
    actor_encrypted_key: str,
) -> tuple[str | None, int | None]:
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        account = get_account_from_db(actor_encrypted_key)

        fn = contract.functions.recordCertification(
            cert_id, property_id, on_chain_hash, valid_until_unix
        )
        receipt = _send_tx(w3, account, fn)
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


# ──────────────────────────────────────────────────────────────────────────────
# Leitura
# ──────────────────────────────────────────────────────────────────────────────

def get_batch_from_chain(batch_id: str) -> dict | None:
    """
    Lê os dados completos de um lote. Retorna dict no formato:
        {
          "batch_code": str,
          "data": {
              "coffee_type": "arabica"|"robusta"|"blend",
              "weight_kg": float,
              "origin_farm": str,
              "origin_city": str,
              "origin_state": str,
              "harvest_date": str (ISO),
              "description": str,
          },
          "owner_address": str,
          "registered_at": datetime,
        }
    """
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        result = contract.functions.batches(batch_id).call()
        # struct retornado como tupla na ordem da declaração
        # (batchCode, coffeeType, weightGrams, originFarm, originCity, originState,
        #  harvestTimestamp, description, owner, registeredAt, exists)
        (
            batch_code,
            coffee_type_idx,
            weight_grams,
            origin_farm,
            origin_city,
            origin_state,
            harvest_ts,
            description,
            owner,
            registered_at,
            exists,
        ) = result

        if not exists:
            return None

        return {
            "batch_code": batch_code,
            "data": {
                "coffee_type": CoffeeTypeEnum(coffee_type_idx).name.lower(),
                "weight_kg": _grams_to_kg(weight_grams),
                "origin_farm": origin_farm,
                "origin_city": origin_city,
                "origin_state": origin_state,
                "harvest_date": datetime.fromtimestamp(harvest_ts, tz=timezone.utc).isoformat(),
                "description": description,
            },
            "owner_address": owner,
            "registered_at": datetime.fromtimestamp(registered_at, tz=timezone.utc),
        }
    except Exception as exc:
        logger.error("Erro ao ler lote da blockchain: %s", exc)
        return None


def get_events_from_chain(batch_id: str) -> list[dict]:
    """
    Retorna histórico ordenado de eventos. Cada item tem `event_type` (string compatível
    com a EventKind do contrato) e `data` específico do tipo.
    """
    try:
        w3 = get_web3()
        contract = get_contract(w3)
        count = contract.functions.getEventCount(batch_id).call()

        events: list[dict] = []
        for i in range(count):
            ref = contract.functions.getEventRef(batch_id, i).call()
            # (kind, index, actor, timestamp, blockNumber)
            kind_idx, ev_index, actor, ts, block_number = ref
            kind = EventKindEnum(kind_idx)

            data = _fetch_event_payload(contract, batch_id, kind, ev_index)
            events.append({
                "event_type": kind.name.lower(),
                "data": data,
                "actor_address": actor,
                "timestamp": datetime.fromtimestamp(ts, tz=timezone.utc),
                "block_number": block_number,
            })
        return events
    except Exception as exc:
        logger.error("Erro ao ler eventos da blockchain: %s", exc)
        return []


def _fetch_event_payload(contract, batch_id: str, kind: EventKindEnum, index: int) -> dict:
    if kind == EventKindEnum.PROCESSING:
        loc, lat_e6, lng_e6, method_idx, notes = contract.functions.getProcessingEvent(batch_id, index).call()
        return {
            "location": loc,
            "latitude": _e6_to_deg(lat_e6),
            "longitude": _e6_to_deg(lng_e6),
            "method": ProcessingMethodEnum(method_idx).name.lower(),
            "notes": notes,
        }
    if kind == EventKindEnum.ROASTING:
        loc, lat_e6, lng_e6, temp_x100, hum_x100, duration, level_idx, notes = (
            contract.functions.getRoastingEvent(batch_id, index).call()
        )
        return {
            "location": loc,
            "latitude": _e6_to_deg(lat_e6),
            "longitude": _e6_to_deg(lng_e6),
            "temperature_c": _x100_to_float(temp_x100),
            "humidity_pct": _x100_to_float(hum_x100),
            "duration_min": duration,
            "roast_level": RoastLevelEnum(level_idx).name.lower(),
            "notes": notes,
        }
    if kind == EventKindEnum.TRANSPORT:
        from_loc, lat_e6, lng_e6, ttype_idx, vehicle_id, notes = (
            contract.functions.getTransportEvent(batch_id, index).call()
        )
        return {
            "from_location": from_loc,
            "latitude": _e6_to_deg(lat_e6),
            "longitude": _e6_to_deg(lng_e6),
            "transport_type": TransportTypeEnum(ttype_idx).name.lower(),
            "vehicle_id": vehicle_id,
            "notes": notes,
        }
    if kind == EventKindEnum.DELIVERY:
        loc, lat_e6, lng_e6, cond_idx, recipient, notes = (
            contract.functions.getDeliveryEvent(batch_id, index).call()
        )
        return {
            "location": loc,
            "latitude": _e6_to_deg(lat_e6),
            "longitude": _e6_to_deg(lng_e6),
            "delivery_condition": DeliveryConditionEnum(cond_idx).name.lower(),
            "recipient_name": recipient,
            "notes": notes,
        }
    if kind == EventKindEnum.CERTIFICATION_AUDIT:
        loc, lat_e6, lng_e6, cert_num, std_idx, notes = (
            contract.functions.getCertificationAuditEvent(batch_id, index).call()
        )
        return {
            "location": loc,
            "latitude": _e6_to_deg(lat_e6),
            "longitude": _e6_to_deg(lng_e6),
            "certificate_number": cert_num,
            "certification_standard": CertificationStandardEnum(std_idx).name.lower(),
            "notes": notes,
        }
    return {}

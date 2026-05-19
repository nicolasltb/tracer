#!/usr/bin/env python3
"""
Deploy CoffeeTrace smart contract to the local Besu network.

Manual usage (from repo root):
    pip install py-solc-x web3
    python scripts/deploy_contract.py

Automated: the `deployer` service in docker-compose.yml runs this
automatically. The contract address and ABI are shared with the API
via the `contract_data` volume.
"""

import json
import os
import sys
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
# Configurable via env for Docker; defaults work for manual runs from repo root.
ROOT = Path(__file__).parent.parent
CONTRACT_PATH = Path(
    os.environ.get("CONTRACT_SOURCE_PATH", ROOT / "contracts" / "CoffeeTrace.sol")
)
ABI_OUTPUT_PATH = Path(
    os.environ.get(
        "ABI_OUTPUT_PATH",
        ROOT / "tracer-backend" / "app" / "abi" / "CoffeeTrace.json",
    )
)
# When OUTPUT_DIR is set, the address and ABI are written there for other services.
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "")

BESU_RPC_URL = os.environ.get("BESU_RPC_URL", "http://localhost:8545")
# Conta com saldo pré-alocado no genesis (também usada como faucet pelo backend).
DEPLOYER_PRIVATE_KEY = os.environ.get("FAUCET_PRIVATE_KEY", "").strip()
if not DEPLOYER_PRIVATE_KEY:
    print("Error: FAUCET_PRIVATE_KEY env var not set.")
    sys.exit(1)
CHAIN_ID = int(os.environ.get("BESU_CHAIN_ID", "1337"))


def compile_contract():
    try:
        from solcx import compile_source, install_solc
    except ImportError:
        print("Error: py-solc-x not installed. Run: pip install py-solc-x")
        sys.exit(1)

    print("Installing solc 0.8.20...")
    install_solc("0.8.20", show_progress=True)

    source = CONTRACT_PATH.read_text()
    compiled = compile_source(
        source,
        output_values=["abi", "bin"],
        solc_version="0.8.20",
        evm_version="paris",  # Besu genesis only enables Berlin — avoid PUSH0
    )
    contract_interface = compiled["<stdin>:CoffeeTrace"]
    return contract_interface["abi"], contract_interface["bin"]


def deploy():
    # ── Idempotency: skip if already deployed ─────────────────────────────────
    address_file = Path(OUTPUT_DIR) / "contract_address.txt" if OUTPUT_DIR else None
    if address_file and address_file.exists():
        existing = address_file.read_text().strip()
        print(f"Contract already deployed at: {existing}")
        print("Delete the contract_data volume to force re-deploy.")
        return

    try:
        from web3 import Web3
        from web3.middleware import ExtraDataToPOAMiddleware
    except ImportError:
        print("Error: web3 not installed. Run: pip install web3")
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(BESU_RPC_URL))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    if not w3.is_connected():
        print(f"Error: Cannot connect to Besu at {BESU_RPC_URL}")
        print("Make sure the network is running: docker compose up besu-node1")
        sys.exit(1)

    print(f"Connected to Besu. Current block: {w3.eth.block_number}")

    abi, bytecode = compile_contract()

    account = w3.eth.account.from_key(DEPLOYER_PRIVATE_KEY)
    print(f"Deploying from: {account.address}")
    print(f"Balance: {w3.from_wei(w3.eth.get_balance(account.address), 'ether')} ETH")

    contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx = contract.constructor().build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 5_000_000,
            "gasPrice": 0,
            "chainId": CHAIN_ID,
        }
    )
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"Transaction sent: {tx_hash.hex()}")
    print("Waiting for receipt...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    address = receipt.contractAddress
    print(f"\nContract deployed at: {address}")

    # ── Save ABI ──────────────────────────────────────────────────────────────
    ABI_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ABI_OUTPUT_PATH.write_text(json.dumps(abi, indent=2))
    print(f"ABI saved to: {ABI_OUTPUT_PATH}")

    # ── Save outputs for other services (Docker) ─────────────────────────────
    if address_file:
        address_file.parent.mkdir(parents=True, exist_ok=True)
        address_file.write_text(address)
        print(f"Contract address saved to: {address_file}")
    else:
        print(f"\nAdd to your .env:\n  CONTRACT_ADDRESS={address}")


if __name__ == "__main__":
    deploy()

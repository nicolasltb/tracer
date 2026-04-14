#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

# ── Load contract address from deployer output ───────────────────────────────
ADDRESS_FILE="/contract_data/contract_address.txt"
if [ -f "$ADDRESS_FILE" ]; then
    export CONTRACT_ADDRESS=$(cat "$ADDRESS_FILE")
    echo "Contract address loaded: $CONTRACT_ADDRESS"
fi

# ── Copy fresh ABI from deployer output ──────────────────────────────────────
ABI_SOURCE="/contract_data/CoffeeTrace.json"
ABI_DEST="app/abi/CoffeeTrace.json"
if [ -f "$ABI_SOURCE" ]; then
    cp "$ABI_SOURCE" "$ABI_DEST"
    echo "ABI updated from deployer output"
fi

echo "Starting application..."
exec "$@"

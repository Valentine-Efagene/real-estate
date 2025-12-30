#!/bin/bash
# Stop the local development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DEV_DIR="$(dirname "$SCRIPT_DIR")"

echo "🛑 Stopping QShelter local development environment..."

cd "$LOCAL_DEV_DIR"

docker compose down

echo "✅ Local environment stopped"

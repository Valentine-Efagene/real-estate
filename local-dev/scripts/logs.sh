#!/bin/bash
# View logs from local development containers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DEV_DIR="$(dirname "$SCRIPT_DIR")"

cd "$LOCAL_DEV_DIR"

if [ -z "$1" ]; then
  echo "Following all container logs (Ctrl+C to stop)..."
  docker compose logs -f
else
  echo "Following logs for: $1"
  docker compose logs -f "$1"
fi

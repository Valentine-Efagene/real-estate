#!/bin/bash
# Reset the local development environment (removes all data)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DEV_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔄 Resetting QShelter local development environment..."
echo "⚠️  This will delete all local data (MySQL, LocalStack, Redis)"
echo ""

read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled"
  exit 0
fi

cd "$LOCAL_DEV_DIR"

# Stop and remove containers and volumes
docker compose down -v

# Remove LocalStack data
rm -rf localstack-data 2>/dev/null || true

echo "✅ Local environment reset complete"
echo ""
echo "Run 'npm run start' to start fresh"

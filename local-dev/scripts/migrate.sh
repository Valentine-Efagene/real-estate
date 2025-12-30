#!/bin/bash
# Run Prisma migrations against the local test database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
LOCAL_DEV_DIR="$(dirname "$SCRIPT_DIR")"

echo "🗄️  Running Prisma migrations..."

# Load test environment
export $(grep -v '^#' "$LOCAL_DEV_DIR/.env.test" | xargs)

cd "$ROOT_DIR/shared/common"

# Generate Prisma client
echo "  - Generating Prisma client..."
npx prisma generate

# Run migrations
echo "  - Applying migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete"

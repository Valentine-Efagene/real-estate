#!/bin/bash
# Seed the local test database with sample data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
LOCAL_DEV_DIR="$(dirname "$SCRIPT_DIR")"

echo "🌱 Seeding local database..."

# Load test environment
export $(grep -v '^#' "$LOCAL_DEV_DIR/.env.test" | xargs)

cd "$ROOT_DIR/shared/common"

# Run Prisma seed if it exists
if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ]; then
  echo "  - Running Prisma seed..."
  npx prisma db seed
  echo "✅ Database seeded"
else
  echo "ℹ️  No seed file found at shared/common/prisma/seed.ts"
  echo "   Create one to seed your database with test data"
fi

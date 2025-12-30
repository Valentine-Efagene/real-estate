#!/bin/bash
# Start the local development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DEV_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting QShelter local development environment..."

cd "$LOCAL_DEV_DIR"

# Make init scripts executable
chmod +x init-scripts/setup-aws.sh 2>/dev/null || true

# Start containers
docker compose up -d

echo "⏳ Waiting for services to be healthy..."

# Wait for MySQL
echo "  - Waiting for MySQL..."
until docker exec qshelter-mysql mysqladmin ping -h localhost -u root -prootpassword --silent 2>/dev/null; do
  sleep 2
done
echo "  ✓ MySQL is ready"

# Wait for LocalStack
echo "  - Waiting for LocalStack..."
until curl -s http://localhost:4566/_localstack/health | grep -q '"dynamodb": "available"' 2>/dev/null; do
  sleep 2
done
echo "  ✓ LocalStack is ready"

# Wait for Redis
echo "  - Waiting for Redis..."
until docker exec qshelter-redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
echo "  ✓ Redis is ready"

# Run AWS setup script (in case auto-init didn't run)
echo "🔧 Initializing AWS resources..."
bash init-scripts/setup-aws.sh

echo ""
echo "✅ Local environment is ready!"
echo ""
echo "📋 Services:"
echo "  - LocalStack:  http://localhost:4566"
echo "  - MySQL:       localhost:3307 (user: qshelter, pass: qshelter_pass)"
echo "  - Redis:       localhost:6379"
echo "  - Adminer:     http://localhost:8080"
echo ""
echo "🧪 To run migrations and tests:"
echo "  cd shared/common && pnpm prisma migrate deploy"
echo "  cd services/mortgage-service && pnpm test:e2e"
echo ""
echo "🛑 To stop: pnpm local:stop"

#!/bin/bash
# Start the local development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DEV_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$LOCAL_DEV_DIR")"

echo "🚀 Starting QShelter local development environment..."

cd "$LOCAL_DEV_DIR"

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
until curl -s http://localhost:4566/_localstack/health | grep -q '"s3": "available"' 2>/dev/null; do
  sleep 2
done
echo "  ✓ LocalStack is ready"

# Wait for Redis
echo "  - Waiting for Redis..."
until docker exec qshelter-redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
echo "  ✓ Redis is ready"

# Deploy infrastructure using CDK
echo "🔧 Deploying AWS resources via CDK..."
cd "$REPO_ROOT/infrastructure"
npm run localstack:bootstrap 2>/dev/null || true
npm run localstack:deploy

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
echo "  cd shared/common && npx prisma migrate deploy"
echo "  cd services/mortgage-service && npm run test:e2e"
echo ""
echo "🛑 To stop: cd local-dev && npm run stop"

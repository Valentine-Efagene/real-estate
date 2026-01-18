#!/bin/bash
#
# Run full E2E tests against AWS Staging
#
# This script sets up the environment variables for AWS staging endpoints
# and runs the full mortgage flow tests via HTTP APIs only.
#
# Prerequisites:
# - All services deployed to AWS staging
# - Database accessible (for cleanup only)
#
# Usage:
#   ./scripts/run-full-e2e-staging.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=============================================="
echo " Running E2E Tests Against AWS Staging"
echo "=============================================="

# AWS Staging endpoints (discovered via serverless info)
export USER_SERVICE_URL="https://c6vzj3886d.execute-api.us-east-1.amazonaws.com"
export PROPERTY_SERVICE_URL="https://31ak21t760.execute-api.us-east-1.amazonaws.com"
export MORTGAGE_SERVICE_URL="https://laqdfff9h8.execute-api.us-east-1.amazonaws.com"
export DOCUMENTS_SERVICE_URL="https://kukogghqcf.execute-api.us-east-1.amazonaws.com"
export PAYMENT_SERVICE_URL="https://eevej2uri9.execute-api.us-east-1.amazonaws.com"
export NOTIFICATION_SERVICE_URL="https://vx2oxgm2ih.execute-api.us-east-1.amazonaws.com"
export POLICY_SYNC_SERVICE_URL="https://nwqf11e6ta.execute-api.us-east-1.amazonaws.com"

# Get database credentials from AWS Secrets Manager
echo "Fetching database credentials from Secrets Manager..."
DB_SECRET_ARN=$(aws ssm get-parameter --name /qshelter/staging/database-secret-arn --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -n "$DB_SECRET_ARN" ]; then
    DB_SECRET=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ARN" --query 'SecretString' --output text)
    export DB_HOST=$(echo "$DB_SECRET" | jq -r '.host')
    export DB_PORT=$(echo "$DB_SECRET" | jq -r '.port // "3306"')
    export DB_USER=$(echo "$DB_SECRET" | jq -r '.username')
    export DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password')
    export DB_NAME=$(echo "$DB_SECRET" | jq -r '.dbname // "qshelter"')
    echo "Database credentials loaded from Secrets Manager"
else
    echo "Warning: Could not fetch database secret. Database cleanup may fail."
    # Fallback to environment or defaults
    export DB_HOST=${DB_HOST:-"localhost"}
    export DB_PORT=${DB_PORT:-"3306"}
    export DB_USER=${DB_USER:-"admin"}
    export DB_PASSWORD=${DB_PASSWORD:-""}
    export DB_NAME=${DB_NAME:-"qshelter"}
fi

# Bootstrap secret for tenant creation
export BOOTSTRAP_SECRET="${BOOTSTRAP_SECRET:-staging-bootstrap-secret}"

echo ""
echo "Service URLs:"
echo "  USER_SERVICE_URL:         $USER_SERVICE_URL"
echo "  PROPERTY_SERVICE_URL:     $PROPERTY_SERVICE_URL"
echo "  MORTGAGE_SERVICE_URL:     $MORTGAGE_SERVICE_URL"
echo "  DOCUMENTS_SERVICE_URL:    $DOCUMENTS_SERVICE_URL"
echo "  PAYMENT_SERVICE_URL:      $PAYMENT_SERVICE_URL"
echo ""
echo "Database:"
echo "  DB_HOST:                  $DB_HOST"
echo "  DB_PORT:                  $DB_PORT"
echo "  DB_NAME:                  $DB_NAME"
echo ""

# Check that services are healthy
echo "Checking service health..."
services_healthy=true

check_health() {
    local name="$1"
    local url="$2"
    local response
    response=$(curl -s --max-time 10 "$url/health" 2>/dev/null)
    if echo "$response" | grep -q "healthy"; then
        echo "  ✅ $name is healthy"
        return 0
    else
        echo "  ❌ $name health check failed"
        services_healthy=false
        return 1
    fi
}

check_health "user-service" "$USER_SERVICE_URL"
check_health "property-service" "$PROPERTY_SERVICE_URL"
check_health "mortgage-service" "$MORTGAGE_SERVICE_URL"

if [ "$services_healthy" = false ]; then
    echo ""
    echo "Some services are not healthy. Aborting tests."
    exit 1
fi
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run the tests
echo "Running full mortgage flow E2E test..."
echo ""

npm run test:full-mortgage -- --verbose

echo ""
echo "=============================================="
echo " E2E Tests Complete!"
echo "=============================================="

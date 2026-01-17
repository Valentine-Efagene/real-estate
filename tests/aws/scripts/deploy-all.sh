#!/bin/bash
#
# Deploy All Services to LocalStack
#
# This script deploys all QShelter services to LocalStack for integration testing.
#
# Prerequisites:
# - LocalStack running (cd local-dev && ./scripts/start.sh)
# - Dependencies installed in each service
#
# Usage:
#   ./scripts/deploy-all.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "=========================================="
echo "Deploying All Services to LocalStack"
echo "=========================================="
echo ""
echo "Project root: $PROJECT_ROOT"
echo ""

# Services to deploy (in order - authorizer first)
SERVICES=(
    "authorizer-service"
    "user-service"
    "property-service"
    "documents-service"
    "mortgage-service"
    "notification-service"
)

# Track failed deployments
FAILED_SERVICES=""

deploy_service() {
    local service=$1
    local service_dir="$PROJECT_ROOT/services/$service"
    
    if [ ! -d "$service_dir" ]; then
        echo "⚠️  Service directory not found: $service_dir"
        FAILED_SERVICES="$FAILED_SERVICES $service"
        return 1
    fi
    
    echo "----------------------------------------"
    echo "Deploying $service..."
    echo "----------------------------------------"
    
    cd "$service_dir"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Deploy to LocalStack
    if npm run deploy:localstack; then
        echo "✅ $service deployed successfully"
        return 0
    else
        echo "❌ $service deployment failed"
        FAILED_SERVICES="$FAILED_SERVICES $service"
        return 1
    fi
}

# Deploy each service
for service in "${SERVICES[@]}"; do
    deploy_service "$service" || true
done

echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="

if [ -z "$FAILED_SERVICES" ]; then
    echo "✅ All services deployed successfully!"
else
    echo "❌ Failed services:$FAILED_SERVICES"
    echo ""
    echo "Check the logs above for details."
    exit 1
fi

echo ""
echo "You can now run the integration tests:"
echo "  npm run run:full-e2e"

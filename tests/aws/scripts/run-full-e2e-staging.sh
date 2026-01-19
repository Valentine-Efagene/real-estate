#!/bin/bash
#
# Run full E2E tests against AWS Staging
#
# This script sets up the environment variables for AWS staging endpoints
# and runs the full mortgage flow tests via HTTP APIs only.
# NO DATABASE ACCESS - purely API-driven tests.
#
# Prerequisites:
# - All services deployed to AWS staging
# - Bootstrap secret configured in SSM
#
# Usage:
#   ./scripts/run-full-e2e-staging.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=============================================="
echo " Running E2E Tests Against AWS Staging"
echo "=============================================="

# Dynamically discover AWS Staging endpoints
echo "Discovering service endpoints from CloudFormation..."

get_api_url() {
    local stack_name="$1"
    # Get all API Gateway resources from the stack - use awk to get first value
    local api_id=$(aws cloudformation describe-stack-resources --stack-name "$stack_name" \
        --query "StackResources[?ResourceType=='AWS::ApiGatewayV2::Api'].PhysicalResourceId | [0]" \
        --output text 2>/dev/null | awk '{print $1}')
    if [ -n "$api_id" ] && [ "$api_id" != "None" ]; then
        echo "https://${api_id}.execute-api.us-east-1.amazonaws.com"
    fi
}

echo "Fetching API Gateway endpoints..."
export USER_SERVICE_URL=$(get_api_url "qshelter-user-service-staging")
export PROPERTY_SERVICE_URL=$(get_api_url "qshelter-property-service-staging")
export MORTGAGE_SERVICE_URL=$(get_api_url "qshelter-mortgage-service-staging")
export DOCUMENTS_SERVICE_URL=$(get_api_url "qshelter-documents-service-staging")
export PAYMENT_SERVICE_URL=$(get_api_url "qshelter-payment-service-staging")
export NOTIFICATION_SERVICE_URL=$(get_api_url "qshelter-notifications-staging")

# Validate we got the URLs
if [ -z "$USER_SERVICE_URL" ]; then
    echo "ERROR: Could not discover user-service URL. Is the stack deployed?"
    exit 1
fi

# DynamoDB table name for role policies (for sync verification)
export ROLE_POLICIES_TABLE="qshelter-staging-role-policies"

# Get bootstrap secret from SSM (required for tenant creation)
echo "Fetching bootstrap secret from SSM..."
BOOTSTRAP_SECRET_FROM_SSM=$(aws ssm get-parameter --name /qshelter/staging/bootstrap-secret --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -n "$BOOTSTRAP_SECRET_FROM_SSM" ]; then
    export BOOTSTRAP_SECRET="$BOOTSTRAP_SECRET_FROM_SSM"
    echo "Bootstrap secret loaded from SSM"
else
    echo "Warning: Could not fetch bootstrap secret from SSM. Using default."
    export BOOTSTRAP_SECRET="${BOOTSTRAP_SECRET:-staging-bootstrap-secret}"
fi

echo ""
echo "Service URLs:"
echo "  USER_SERVICE_URL:         $USER_SERVICE_URL"
echo "  PROPERTY_SERVICE_URL:     $PROPERTY_SERVICE_URL"
echo "  MORTGAGE_SERVICE_URL:     $MORTGAGE_SERVICE_URL"
echo "  DOCUMENTS_SERVICE_URL:    $DOCUMENTS_SERVICE_URL"
echo "  PAYMENT_SERVICE_URL:      $PAYMENT_SERVICE_URL"
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

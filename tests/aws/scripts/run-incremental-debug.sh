#!/bin/bash
#
# Run incremental debug tests against AWS Staging
#
# This script mirrors the Postman collection flow step-by-step.
# Use it to debug API flow issues before running in Postman.
#
# Prerequisites:
# - All services deployed to AWS staging
# - Bootstrap secret configured in SSM
#
# Usage:
#   ./scripts/run-incremental-debug.sh                    # Run all steps
#   ./scripts/run-incremental-debug.sh "Step 1"           # Run only Step 1 tests
#   ./scripts/run-incremental-debug.sh "Step 1.1"         # Run only reset test
#   ./scripts/run-incremental-debug.sh "Step 3"           # Run only organization tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

TEST_PATTERN="${1:-}"

echo "=============================================="
echo " Incremental Debug Test - AWS Staging"
echo "=============================================="

if [ -n "$TEST_PATTERN" ]; then
    echo " Test Pattern: $TEST_PATTERN"
fi
echo ""

# Dynamically discover AWS Staging endpoints
echo "Discovering service endpoints from CloudFormation..."

get_api_url() {
    local stack_name="$1"
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

if [ -z "$PROPERTY_SERVICE_URL" ]; then
    echo "ERROR: Could not discover property-service URL. Is the stack deployed?"
    exit 1
fi

if [ -z "$MORTGAGE_SERVICE_URL" ]; then
    echo "ERROR: Could not discover mortgage-service URL. Is the stack deployed?"
    exit 1
fi

# DynamoDB table name for role policies
export ROLE_POLICIES_TABLE="qshelter-staging-role-policies"

# Get bootstrap secret from SSM
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
echo "Running incremental debug tests..."
echo ""

if [ -n "$TEST_PATTERN" ]; then
    npm run test:incremental -- --verbose --testNamePattern="$TEST_PATTERN"
else
    npm run test:incremental -- --verbose
fi

echo ""
echo "=============================================="
echo " Incremental Debug Test Complete!"
echo "=============================================="

#!/bin/bash
#
# Full E2E Mortgage Flow Test Runner (LocalStack)
#
# This script fetches all API Gateway URLs from LocalStack and runs the
# full-mortgage-flow E2E test against the deployed services.
#
# Prerequisites:
# - LocalStack running with all services deployed
# - AWS CLI configured for LocalStack (uses --endpoint-url)
#
# Usage:
#   ./scripts/run-full-e2e-localstack.sh
#

set -e

LOCALSTACK_ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"

echo "=========================================="
echo "Full E2E Mortgage Flow Test"
echo "=========================================="
echo ""
echo "Fetching API Gateway URLs from LocalStack..."
echo ""

# Function to get API Gateway URL for a service
get_api_url() {
    local service_name=$1
    local api_id=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis \
        --query "items[?name=='$service_name'].id" \
        --output text 2>/dev/null)
    
    if [ -z "$api_id" ] || [ "$api_id" == "None" ]; then
        echo ""
        return 1
    fi
    
    echo "http://${api_id}.execute-api.localhost.localstack.cloud:4566/localstack"
}

# Fetch all service URLs
echo "Looking up service endpoints..."

USER_SERVICE_URL=$(get_api_url "qshelter-user-service-localstack")
PROPERTY_SERVICE_URL=$(get_api_url "qshelter-property-service-localstack")
MORTGAGE_SERVICE_URL=$(get_api_url "qshelter-mortgage-service-localstack")
DOCUMENTS_SERVICE_URL=$(get_api_url "qshelter-documents-service-localstack")
NOTIFICATION_SERVICE_URL=$(get_api_url "qshelter-notifications-localstack")

# Validate required services are available
MISSING_SERVICES=""

if [ -z "$USER_SERVICE_URL" ]; then
    MISSING_SERVICES="$MISSING_SERVICES user-service"
fi

if [ -z "$PROPERTY_SERVICE_URL" ]; then
    MISSING_SERVICES="$MISSING_SERVICES property-service"
fi

if [ -z "$MORTGAGE_SERVICE_URL" ]; then
    MISSING_SERVICES="$MISSING_SERVICES mortgage-service"
fi

if [ -n "$MISSING_SERVICES" ]; then
    echo ""
    echo "❌ ERROR: Required services not deployed:$MISSING_SERVICES"
    echo ""
    echo "Please deploy the missing services first:"
    echo "  cd services/<service-name> && npm run deploy:localstack"
    echo ""
    exit 1
fi

echo ""
echo "Service URLs:"
echo "  USER_SERVICE_URL:     $USER_SERVICE_URL"
echo "  PROPERTY_SERVICE_URL: $PROPERTY_SERVICE_URL"
echo "  MORTGAGE_SERVICE_URL: $MORTGAGE_SERVICE_URL"
if [ -n "$DOCUMENTS_SERVICE_URL" ]; then
    echo "  DOCUMENTS_SERVICE_URL: $DOCUMENTS_SERVICE_URL"
fi
if [ -n "$NOTIFICATION_SERVICE_URL" ]; then
    echo "  NOTIFICATION_SERVICE_URL: $NOTIFICATION_SERVICE_URL"
fi
echo ""

# Health check (optional - comment out if endpoints don't exist)
echo "Verifying service connectivity..."

check_service() {
    local name=$1
    local url=$2
    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url/health" 2>/dev/null || echo "000")
    if [ "$status" == "200" ] || [ "$status" == "404" ]; then
        echo "  ✓ $name reachable"
        return 0
    else
        echo "  ⚠ $name returned HTTP $status (may still work)"
        return 0
    fi
}

check_service "user-service" "$USER_SERVICE_URL"
check_service "property-service" "$PROPERTY_SERVICE_URL"
check_service "mortgage-service" "$MORTGAGE_SERVICE_URL"

echo ""
echo "=========================================="
echo "Running Full E2E Test..."
echo "=========================================="
echo ""

# Export environment variables and run the test
export USER_SERVICE_URL
export PROPERTY_SERVICE_URL
export MORTGAGE_SERVICE_URL
export API_BASE_URL="$MORTGAGE_SERVICE_URL"
export DOCUMENTS_SERVICE_URL
export NOTIFICATION_SERVICE_URL
export BOOTSTRAP_SECRET="${BOOTSTRAP_SECRET:-local-bootstrap-secret}"
export NODE_ENV=localstack

# Run the test
NODE_OPTIONS='--experimental-vm-modules --no-warnings=ExperimentalWarning' \
    npx jest --config jest.e2e.config.js --testNamePattern="Full E2E Mortgage Flow" "$@"

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "=========================================="
    echo "✅ Full E2E Test PASSED"
    echo "=========================================="
else
    echo "=========================================="
    echo "❌ Full E2E Test FAILED (exit code: $TEST_EXIT_CODE)"
    echo "=========================================="
fi

exit $TEST_EXIT_CODE

#!/bin/bash
#
# Run Demo Bootstrap against AWS Staging
#
# Sets up the complete demo environment:
# - Adaeze (admin), Yinka (mortgage_ops), Nneka (agent), Eniola (mortgage_ops), Emeka (customer)
# - Developer org (Lekki Gardens) with completed onboarding
# - Bank org (Access Bank) with completed onboarding
# - Published property (Sunrise Heights)
# - MREIF 10/90 payment method (5 phases) linked to property
#
# ⚠️  WARNING: This resets the database! All existing data will be deleted.
#
# Usage:
#   ./scripts/run-demo-bootstrap.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=============================================="
echo " Demo Bootstrap: Mortgage Flow Environment"
echo "=============================================="
echo ""
echo "⚠️  This will RESET the staging database and set up a fresh demo environment."
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
export PAYMENT_SERVICE_URL=$(get_api_url "qshelter-payment-service-staging")

# Validate we got the URLs
if [ -z "$USER_SERVICE_URL" ]; then
    echo "ERROR: Could not discover user-service URL. Is the stack deployed?"
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
echo "  USER_SERVICE_URL:      $USER_SERVICE_URL"
echo "  PROPERTY_SERVICE_URL:  $PROPERTY_SERVICE_URL"
echo "  MORTGAGE_SERVICE_URL:  $MORTGAGE_SERVICE_URL"
echo "  PAYMENT_SERVICE_URL:   $PAYMENT_SERVICE_URL"
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
    echo "Some services are not healthy. Aborting."
    exit 1
fi
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Run the demo bootstrap test
echo "Running demo bootstrap..."
echo ""

npm run test:demo-bootstrap -- --verbose

echo ""
echo "=============================================="
echo " Demo Environment Ready! 🎉"
echo "=============================================="
echo ""
echo "Actors:"
echo "  Adaeze (adaeze@mailsac.com) — Admin"
echo "  Yinka  (yinka@mailsac.com)  — Mortgage Ops"
echo "  Nneka  (nneka@mailsac.com)  — Developer Agent"
echo "  Eniola (eniola@mailsac.com) — Bank Mortgage Ops"
echo "  Emeka  (emeka@mailsac.com)  — Customer"
echo ""
echo "All passwords: password"
echo ""

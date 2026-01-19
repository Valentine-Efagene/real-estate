#!/bin/bash
#
# Run authorizer sanity tests against AWS Staging
#
# This script invokes the authorizer Lambda directly to validate it's working.
#
# Prerequisites:
# - Authorizer Lambda deployed to AWS staging
# - Valid AWS credentials configured
#
# Usage:
#   ./scripts/run-authorizer-tests.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=============================================="
echo " Running Authorizer Tests Against AWS Staging"
echo "=============================================="

# Set Lambda function name
export AUTHORIZER_FUNCTION_NAME="qshelter-authorizer-staging"
export AWS_REGION="us-east-1"

# Try to fetch JWT secret from SSM for valid token tests
echo "Fetching JWT secret from Secrets Manager..."
JWT_SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "qshelter/staging/jwt-secrets" \
    --query 'SecretString' \
    --output text 2>/dev/null || echo "")

if [ -n "$JWT_SECRET_JSON" ]; then
    # Parse the access secret from the JSON
    export JWT_SECRET=$(echo "$JWT_SECRET_JSON" | jq -r '.access // empty')
    if [ -n "$JWT_SECRET" ]; then
        echo "  ✅ JWT secret loaded from Secrets Manager"
    else
        echo "  ⚠️  Could not parse JWT secret - valid token tests will be skipped"
    fi
else
    echo "  ⚠️  Could not fetch JWT secret - valid token tests will be skipped"
fi

echo ""
echo "Configuration:"
echo "  AUTHORIZER_FUNCTION_NAME: $AUTHORIZER_FUNCTION_NAME"
echo "  AWS_REGION:               $AWS_REGION"
echo "  JWT_SECRET:               ${JWT_SECRET:+[configured]}"
echo ""

# Verify Lambda exists
echo "Verifying authorizer Lambda exists..."
if aws lambda get-function --function-name "$AUTHORIZER_FUNCTION_NAME" &>/dev/null; then
    echo "  ✅ Authorizer Lambda found"
else
    echo "  ❌ Authorizer Lambda not found: $AUTHORIZER_FUNCTION_NAME"
    exit 1
fi

# Run the tests
echo ""
echo "Running tests..."
npm test -- authorizer

echo ""
echo "=============================================="
echo " Authorizer Tests Complete"
echo "=============================================="

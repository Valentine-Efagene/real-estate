#!/bin/bash
# Fix API Gateway stages after LocalStack deployment
# LocalStack has a bug where stages sometimes don't get created properly
# This script creates the 'localstack' stage for all deployed APIs

ENDPOINT_URL="http://localhost:4566"
STAGE_NAME="localstack"

echo "🔧 Fixing API Gateway stages for LocalStack..."

# Get all REST APIs
apis=$(aws --endpoint-url=$ENDPOINT_URL apigateway get-rest-apis --query "items[*].[id,name]" --output text 2>/dev/null)

if [ -z "$apis" ]; then
    echo "No API Gateways found"
    exit 0
fi

while IFS=$'\t' read -r api_id api_name; do
    # Check if stage exists
    stage_exists=$(aws --endpoint-url=$ENDPOINT_URL apigateway get-stages --rest-api-id "$api_id" --query "item[?stageName=='$STAGE_NAME'].stageName" --output text 2>/dev/null)
    
    if [ -z "$stage_exists" ]; then
        # Get the latest deployment ID
        deployment_id=$(aws --endpoint-url=$ENDPOINT_URL apigateway get-deployments --rest-api-id "$api_id" --query "items[0].id" --output text 2>/dev/null)
        
        if [ -n "$deployment_id" ] && [ "$deployment_id" != "None" ]; then
            echo "  Creating stage '$STAGE_NAME' for $api_name ($api_id)..."
            aws --endpoint-url=$ENDPOINT_URL apigateway create-stage \
                --rest-api-id "$api_id" \
                --stage-name "$STAGE_NAME" \
                --deployment-id "$deployment_id" > /dev/null 2>&1
            
            if [ $? -eq 0 ]; then
                echo "  ✅ Stage created successfully"
            else
                echo "  ❌ Failed to create stage"
            fi
        else
            echo "  ⚠️  No deployment found for $api_name ($api_id)"
        fi
    else
        echo "  ✓ Stage '$STAGE_NAME' already exists for $api_name ($api_id)"
    fi
done <<< "$apis"

echo "✅ API Gateway stage fix complete"

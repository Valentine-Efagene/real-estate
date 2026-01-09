#!/bin/bash
# Fix LocalStack deployment issues
# 1. API Gateway stages not being created
# 2. Lambda event source mappings not being created
# This script runs after each LocalStack deployment to ensure everything is properly wired up

ENDPOINT_URL="http://localhost:4566"
STAGE_NAME="localstack"

# =============================================================================
# Fix API Gateway Stages
# =============================================================================
echo "🔧 Fixing API Gateway stages for LocalStack..."

# Get all REST APIs
apis=$(aws --endpoint-url=$ENDPOINT_URL apigateway get-rest-apis --query "items[*].[id,name]" --output text 2>/dev/null)

if [ -z "$apis" ]; then
    echo "  No API Gateways found"
else
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
fi

echo "✅ API Gateway stage fix complete"

# =============================================================================
# Fix Lambda Event Source Mappings (SQS Consumers)
# =============================================================================
echo ""
echo "🔧 Fixing Lambda event source mappings..."

# Define the SQS consumer functions and their queue mappings
# Format: "function_name:queue_name"
declare -a SQS_MAPPINGS=(
    "qshelter-notifications-localstack-sqsConsumer:qshelter-localstack-notifications"
)

for mapping in "${SQS_MAPPINGS[@]}"; do
    function_name="${mapping%%:*}"
    queue_name="${mapping##*:}"
    queue_arn="arn:aws:sqs:us-east-1:000000000000:$queue_name"
    
    # Check if function exists
    function_exists=$(aws --endpoint-url=$ENDPOINT_URL lambda get-function --function-name "$function_name" 2>/dev/null)
    
    if [ -z "$function_exists" ]; then
        echo "  ⏭️  Function $function_name not deployed, skipping"
        continue
    fi
    
    # Check if event source mapping already exists
    existing_mapping=$(aws --endpoint-url=$ENDPOINT_URL lambda list-event-source-mappings \
        --function-name "$function_name" \
        --event-source-arn "$queue_arn" \
        --query "EventSourceMappings[0].UUID" \
        --output text 2>/dev/null)
    
    if [ -n "$existing_mapping" ] && [ "$existing_mapping" != "None" ]; then
        echo "  ✓ Event source mapping exists for $function_name → $queue_name"
    else
        echo "  Creating event source mapping for $function_name → $queue_name..."
        aws --endpoint-url=$ENDPOINT_URL lambda create-event-source-mapping \
            --function-name "$function_name" \
            --event-source-arn "$queue_arn" \
            --batch-size 10 \
            --function-response-types ReportBatchItemFailures > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo "  ✅ Event source mapping created successfully"
        else
            echo "  ❌ Failed to create event source mapping"
        fi
    fi
done

echo "✅ Event source mapping fix complete"

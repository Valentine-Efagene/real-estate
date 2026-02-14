#!/usr/bin/env bash
set -euo pipefail

# Invoke the demo-bootstrap endpoint directly via Lambda (bypasses API Gateway 30s timeout)

FUNCTION_NAME="qshelter-user-service-staging-api"
PROP_URL="https://z32oarlcp7.execute-api.us-east-1.amazonaws.com"
MORT_URL="https://el0slr8sg5.execute-api.us-east-1.amazonaws.com"
PAY_URL="https://cmwxqd18ga.execute-api.us-east-1.amazonaws.com"

echo "Fetching bootstrap secret from SSM..."
BOOTSTRAP_SECRET=$(aws ssm get-parameter --name /qshelter/staging/bootstrap-secret --with-decryption --query Parameter.Value --output text)

BODY="{\"propertyServiceUrl\":\"${PROP_URL}\",\"mortgageServiceUrl\":\"${MORT_URL}\",\"paymentServiceUrl\":\"${PAY_URL}\"}"

# Build the API Gateway v2 event JSON using jq
jq -n \
  --arg secret "$BOOTSTRAP_SECRET" \
  --arg body "$BODY" \
'{
  "version": "2.0",
  "routeKey": "POST /admin/demo-bootstrap",
  "rawPath": "/admin/demo-bootstrap",
  "headers": {
    "content-type": "application/json",
    "x-bootstrap-secret": $secret
  },
  "requestContext": {
    "http": { "method": "POST", "path": "/admin/demo-bootstrap" },
    "routeKey": "POST /admin/demo-bootstrap",
    "stage": "$default"
  },
  "body": $body,
  "isBase64Encoded": false
}' > /tmp/demo-bootstrap-event.json

echo "Payload written to /tmp/demo-bootstrap-event.json"
echo "Invoking Lambda ${FUNCTION_NAME} (this may take up to 2 minutes)..."

aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --cli-read-timeout 150 \
  --cli-binary-format raw-in-base64-out \
  --payload file:///tmp/demo-bootstrap-event.json \
  /tmp/demo-bootstrap-response.json

echo ""
echo "=== Lambda Response ==="

# The response is a stringified API Gateway response — parse it
STATUS=$(jq -r '.statusCode' /tmp/demo-bootstrap-response.json 2>/dev/null || echo "unknown")
echo "Status: ${STATUS}"

if [ "$STATUS" = "201" ]; then
  echo ""
  echo "✅ Demo bootstrap succeeded!"
  echo ""
  # Parse the body (which is a JSON string inside the response)
  jq -r '.body' /tmp/demo-bootstrap-response.json | jq '{
    tenantId,
    actors: (.actors | to_entries | map({key: .key, name: .value.name, email: .value.email, role: .value.role})),
    organizations: (.organizations | to_entries | map({key: .key, name: .value.name, type: .value.type})),
    property: { title: .property.title, unitNumber: .property.unitNumber, price: .property.price },
    paymentMethod: .paymentMethod,
    stepCount: (.steps | length)
  }'
else
  echo ""
  echo "❌ Demo bootstrap failed"
  echo ""
  jq '.' /tmp/demo-bootstrap-response.json
fi

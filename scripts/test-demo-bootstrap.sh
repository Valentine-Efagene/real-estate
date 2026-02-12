#!/bin/bash
# Test the POST /admin/demo-bootstrap endpoint via direct Lambda invocation
# (bypasses API Gateway's 30s timeout)

set -e

FUNCTION_NAME="qshelter-user-service-staging-api"
PROPERTY_URL="https://3d8q4b1fk6.execute-api.us-east-1.amazonaws.com"
MORTGAGE_URL="https://ygaqg5xc26.execute-api.us-east-1.amazonaws.com"
PAYMENT_URL="https://fa56k6x6qc.execute-api.us-east-1.amazonaws.com"

echo "🔑 Fetching bootstrap secret from SSM..."
BOOTSTRAP_SECRET=$(aws ssm get-parameter --name /qshelter/staging/bootstrap-secret --with-decryption --query Parameter.Value --output text)

echo "📦 Building Lambda event payload..."
python3 -c "
import json, time, datetime

secret = '$BOOTSTRAP_SECRET'
body_obj = {
    'propertyServiceUrl': '$PROPERTY_URL',
    'mortgageServiceUrl': '$MORTGAGE_URL',
    'paymentServiceUrl': '$PAYMENT_URL'
}

event = {
    'version': '2.0',
    'routeKey': 'ANY /admin/{proxy+}',
    'rawPath': '/admin/demo-bootstrap',
    'rawQueryString': '',
    'headers': {
        'content-type': 'application/json',
        'x-bootstrap-secret': secret
    },
    'requestContext': {
        'accountId': 'anonymous',
        'apiId': '388o2sdi4m',
        'domainName': '388o2sdi4m.execute-api.us-east-1.amazonaws.com',
        'domainPrefix': '388o2sdi4m',
        'http': {
            'method': 'POST',
            'path': '/admin/demo-bootstrap',
            'protocol': 'HTTP/1.1',
            'sourceIp': '127.0.0.1',
            'userAgent': 'test-script'
        },
        'requestId': f'test-{int(time.time())}',
        'routeKey': 'ANY /admin/{proxy+}',
        'stage': '\$default',
        'time': datetime.datetime.utcnow().strftime('%d/%b/%Y:%H:%M:%S +0000'),
        'timeEpoch': int(time.time() * 1000)
    },
    'body': json.dumps(body_obj),
    'isBase64Encoded': False
}

with open('/tmp/demo-bootstrap-payload.json', 'w') as f:
    json.dump(event, f)

print('✅ Payload written to /tmp/demo-bootstrap-payload.json')
"

echo ""
echo "🚀 Invoking Lambda directly (bypassing API Gateway 30s limit)..."
echo "   Function: $FUNCTION_NAME"
echo ""

START_TIME=$(date +%s)

aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --payload file:///tmp/demo-bootstrap-payload.json \
  --cli-read-timeout 180 \
  /tmp/demo-bootstrap-lambda-response.json

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "⏱️  Lambda execution took ${ELAPSED}s"
echo ""
echo "--- Response ---"

python3 -c "
import json

with open('/tmp/demo-bootstrap-lambda-response.json') as f:
    resp = json.load(f)

status = resp.get('statusCode', 'N/A')
print(f'HTTP Status: {status}')

body_str = resp.get('body', '{}')
try:
    body = json.loads(body_str)
except:
    print(f'Raw body: {body_str[:2000]}')
    exit(1)

if body.get('success'):
    print(f'✅ SUCCESS')
    print(f'   Tenant: {body[\"tenantId\"]}')
    print()
    print('   Actors:')
    for name, actor in body.get('actors', {}).items():
        print(f'     {actor[\"name\"]} ({actor[\"email\"]}) — {actor[\"role\"]} — {actor[\"id\"][:8]}...')
    print()
    print('   Organizations:')
    for name, org in body.get('organizations', {}).items():
        print(f'     {org[\"name\"]} ({org[\"type\"]}) — {org[\"id\"][:8]}...')
    print()
    prop = body.get('property', {})
    print(f'   Property: {prop.get(\"title\")} / {prop.get(\"unitNumber\")} — ₦{prop.get(\"price\",0):,.0f}')
    pm = body.get('paymentMethod', {})
    print(f'   Payment Method: {pm.get(\"name\")} ({pm.get(\"phases\")} phases)')
    print()
    print(f'   Steps ({len(body.get(\"steps\", []))}):')
    for s in body.get('steps', []):
        print(f'     ✅ {s[\"step\"]}{\" — \" + s[\"detail\"] if s.get(\"detail\") else \"\"}')
else:
    print(f'❌ FAILED')
    print(json.dumps(body, indent=2)[:3000])
"

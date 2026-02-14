"""
Generate Lambda invocation payload for demo-bootstrap and invoke the Lambda.
Usage: python3 scripts/invoke-demo-bootstrap.py
"""

import json
import subprocess
import sys
import time
import datetime

# Get bootstrap secret from SSM
print("🔑 Fetching bootstrap secret from SSM...")
result = subprocess.run(
    [
        "aws",
        "ssm",
        "get-parameter",
        "--name",
        "/qshelter/staging/bootstrap-secret",
        "--with-decryption",
        "--query",
        "Parameter.Value",
        "--output",
        "text",
    ],
    capture_output=True,
    text=True,
)
BOOTSTRAP_SECRET = result.stdout.strip()
if not BOOTSTRAP_SECRET:
    print("❌ Failed to get bootstrap secret")
    sys.exit(1)
print(f"   Got secret: {BOOTSTRAP_SECRET[:5]}...")

# Build the API Gateway v2 event payload
body_obj = {
    "propertyServiceUrl": "https://z32oarlcp7.execute-api.us-east-1.amazonaws.com",
    "mortgageServiceUrl": "https://el0slr8sg5.execute-api.us-east-1.amazonaws.com",
    "paymentServiceUrl": "https://cmwxqd18ga.execute-api.us-east-1.amazonaws.com",
}

event = {
    "version": "2.0",
    "routeKey": "ANY /admin/{proxy+}",
    "rawPath": "/admin/demo-bootstrap",
    "rawQueryString": "",
    "headers": {
        "content-type": "application/json",
        "x-bootstrap-secret": BOOTSTRAP_SECRET,
    },
    "requestContext": {
        "accountId": "anonymous",
        "apiId": "1oi4sd5b4i",
        "domainName": "1oi4sd5b4i.execute-api.us-east-1.amazonaws.com",
        "domainPrefix": "1oi4sd5b4i",
        "http": {
            "method": "POST",
            "path": "/admin/demo-bootstrap",
            "protocol": "HTTP/1.1",
            "sourceIp": "127.0.0.1",
            "userAgent": "test-script",
        },
        "requestId": f"test-{int(time.time())}",
        "routeKey": "ANY /admin/{proxy+}",
        "stage": "$default",
        "time": datetime.datetime.utcnow().strftime("%d/%b/%Y:%H:%M:%S +0000"),
        "timeEpoch": int(time.time() * 1000),
    },
    "body": json.dumps(body_obj),
    "isBase64Encoded": False,
}

payload_path = "/tmp/demo-bootstrap-payload.json"
response_path = "/tmp/demo-bootstrap-response.json"

with open(payload_path, "w") as f:
    json.dump(event, f)
print(f"📦 Payload written to {payload_path}")

# Invoke Lambda directly
print()
print("🚀 Invoking Lambda directly (bypassing API Gateway 30s limit)...")
print("   Function: qshelter-user-service-staging-api")
print()

start = time.time()
result = subprocess.run(
    [
        "aws",
        "lambda",
        "invoke",
        "--function-name",
        "qshelter-user-service-staging-api",
        "--payload",
        f"file://{payload_path}",
        "--cli-read-timeout",
        "180",
        response_path,
    ],
    capture_output=True,
    text=True,
)
elapsed = time.time() - start

print(f"⏱️  Lambda invocation took {elapsed:.1f}s")
if result.returncode != 0:
    print(f"❌ AWS CLI error: {result.stderr}")
    sys.exit(1)

# Parse invoke metadata
invoke_meta = result.stdout.strip()
if invoke_meta:
    meta = json.loads(invoke_meta)
    if meta.get("FunctionError"):
        print(f"❌ Lambda function error: {meta['FunctionError']}")

# Parse response
print()
print("--- Response ---")
with open(response_path) as f:
    resp = json.load(f)

status = resp.get("statusCode", "N/A")
print(f"HTTP Status: {status}")

body_str = resp.get("body", "{}")
try:
    body = json.loads(body_str)
except Exception:
    print(f"Raw body: {body_str[:3000]}")
    sys.exit(1)

if body.get("success"):
    print("✅ SUCCESS")
    print(f'   Tenant: {body["tenantId"]}')
    print()
    print("   Actors:")
    for name, actor in body.get("actors", {}).items():
        print(
            f'     {actor["name"]} ({actor["email"]}) — {actor["role"]} — {actor["id"][:8]}...'
        )
    print()
    print("   Organizations:")
    for name, org in body.get("organizations", {}).items():
        print(f'     {org["name"]} ({org["type"]}) — {org["id"][:8]}...')
    print()
    prop = body.get("property", {})
    print(
        f'   Property: {prop.get("title")} / {prop.get("unitNumber")} — ₦{prop.get("price", 0):,.0f}'
    )
    pm = body.get("paymentMethod", {})
    print(f'   Payment Method: {pm.get("name")} ({pm.get("phases")} phases)')
    print()
    steps = body.get("steps", [])
    print(f"   Steps ({len(steps)}):")
    for s in steps:
        detail = f' — {s["detail"]}' if s.get("detail") else ""
        print(f'     ✅ {s["step"]}{detail}')
else:
    print("❌ FAILED")
    print(json.dumps(body, indent=2)[:3000])

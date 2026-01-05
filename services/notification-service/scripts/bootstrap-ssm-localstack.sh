#!/usr/bin/env bash
set -euo pipefail
ENDPOINT='http://localhost:4566'
STAGE=${1:-test}
PREFIX="/qshelter/${STAGE}"
AWS="aws --endpoint-url=${ENDPOINT}"

# Create a dummy database secret in Secrets Manager
DB_SECRET_NAME="qshelter-${STAGE}-database-secret"
DB_SECRET_JSON='{"username":"localuser","password":"localpass"}'

echo "Creating Secrets Manager secret ${DB_SECRET_NAME}"
SECRET_ARN=$($AWS secretsmanager create-secret --name ${DB_SECRET_NAME} --secret-string "${DB_SECRET_JSON}" --query 'ARN' --output text || true)
if [ -z "$SECRET_ARN" ] || [ "$SECRET_ARN" = "null" ]; then
  # If exists, fetch ARN
  SECRET_ARN=$($AWS secretsmanager list-secrets --query "SecretList[?Name=='${DB_SECRET_NAME}'].ARN | [0]" --output text)
fi

echo "Secret ARN: ${SECRET_ARN}"

# Helper to put SSM parameter
put() {
  local name="$1"
  local value="$2"
  echo "Putting parameter ${name} = ${value}"
  $AWS ssm put-parameter --name "${name}" --type String --value "${value}" --overwrite >/dev/null
}

# Put infrastructure parameters
put "${PREFIX}/vpc-id" "vpc-0123456789"
put "${PREFIX}/db-security-group-id" "sg-0123456789"
put "${PREFIX}/private-subnet-ids" "subnet-11111111,subnet-22222222"
put "${PREFIX}/db-host" "localhost"
put "${PREFIX}/db-port" "3306"
put "${PREFIX}/database-secret-arn" "${SECRET_ARN}"
put "${PREFIX}/redis-host" "localhost"
put "${PREFIX}/redis-port" "6379"
put "${PREFIX}/role-policies-table-name" "qshelter-role-policies-${STAGE}"
put "${PREFIX}/s3-bucket-name" "qshelter-uploads-${STAGE}"
put "${PREFIX}/eventbridge-bus-name" "qshelter-event-bus-${STAGE}"
put "${PREFIX}/http-api-id" "REPLACE_ME_HTTP_API_ID"

# Also add authorizer lambda ARN placeholder consumed by serverless (if not present)
put "${PREFIX}/authorizer-lambda-arn" "arn:aws:lambda:us-east-1:000000000000:function:qshelter-authorizer-${STAGE}"

# Return list
echo "SSM parameters for ${PREFIX}:"
$AWS ssm get-parameters-by-path --path "${PREFIX}" --query 'Parameters[*].Name' --output table

echo "Bootstrap complete."

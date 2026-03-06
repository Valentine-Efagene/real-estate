#!/usr/bin/env bash
set -euo pipefail

STAGE="${1:-staging}"
AWS_PROFILE="${AWS_PROFILE:-default}"

echo "[studio] Using stage: ${STAGE}"
echo "[studio] Using AWS_PROFILE: ${AWS_PROFILE}"

DB_SECRET_ARN=$(AWS_PROFILE="$AWS_PROFILE" aws ssm get-parameter \
  --name "/qshelter/${STAGE}/database-secret-arn" \
  --query "Parameter.Value" \
  --output text)

DB_SECRET_JSON=$(AWS_PROFILE="$AWS_PROFILE" aws secretsmanager get-secret-value \
  --secret-id "$DB_SECRET_ARN" \
  --query "SecretString" \
  --output text)

DATABASE_URL_FROM_AWS=$(node -e '
const secret = JSON.parse(process.argv[1]);
const username = encodeURIComponent(secret.username || "");
const password = encodeURIComponent(secret.password || "");
const host = secret.host;
const port = secret.port;
const dbname = secret.dbname;
if (!host || !port || !dbname || !username) {
  throw new Error("Missing required DB fields in Secrets Manager payload");
}
console.log(`mysql://${username}:${password}@${host}:${port}/${dbname}`);
' "$DB_SECRET_JSON")

echo "[studio] Launching Prisma Studio for ${STAGE}..."
DATABASE_URL="$DATABASE_URL_FROM_AWS" npx prisma studio

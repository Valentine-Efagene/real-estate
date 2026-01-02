# LocalStack Setup for QShelter E2E Tests

This document describes the LocalStack-based local environment configured for running end-to-end tests for the QShelter monorepo.

---

## Summary

A reproducible local environment using LocalStack + MySQL + Redis is provided so your services (mortgage-service, user-service, property-service, etc.) can run their e2e suites against a mock AWS stack including S3, SSM, Secrets Manager, DynamoDB, EventBridge, SQS, SNS, and CloudWatch Logs.

This environment is configured under the `local-dev/` directory.

---

## Minimal Quick Summary

- LocalStack (:4566) — S3, SSM, Secrets Manager, DynamoDB, EventBridge, SQS, SNS, CloudWatch Logs
- MySQL (:3307) — Prisma database
- Redis (:6379) — Caching
- Adminer (:8080) — DB admin UI
- Pre-seeded role policies — admin, buyer, agent with proper permissions
- Test JWT utilities — generate auth headers for any test user

## Files

- `local-dev/docker-compose.yml` — LocalStack + MySQL + Redis + Adminer compose file
- `local-dev/.env` — Environment variables for local dev (copy from `.env.example`)
- `local-dev/init-scripts/mysql/01-init.sql` — MySQL DB init script
- `local-dev/lib/aws-clients.ts` — LocalStack-aware AWS SDK client factory
- `local-dev/lib/test-utils.ts` — JWT helpers, predefined test users, utility functions
- `local-dev/lib/db-cleanup.ts` — Prisma DB cleanup and seeding helpers for e2e tests
- `local-dev/lib/index.ts` — Exports for local-dev utilities
- `local-dev/scripts/start.sh` — Start script (brings up compose, waits for readiness, deploys CDK)
- `local-dev/scripts/stop.sh` — Stop script
- `local-dev/scripts/reset.sh` — Reset (down + remove volumes + localstack data)
- `local-dev/scripts/logs.sh` — Tail container logs
- `local-dev/scripts/migrate.sh` — Run Prisma migrate/generate against local DB
- `local-dev/scripts/seed.sh` — Run Prisma seed (if present)
- `infrastructure/lib/localstack-stack.ts` — CDK stack for LocalStack resources
- `infrastructure/bin/localstack-app.ts` — CDK app entry point for LocalStack
- `infrastructure/scripts/seed-role-policies.mjs` — Seeds DynamoDB role policies table

---

## Quick Start

1. Start the environment:

```bash
pnpm local:start
```

2. Run Prisma migrations (applies migrations to the test DB):

```bash
pnpm local:migrate
```

3. Seed database (optional):

```bash
pnpm local:seed
```

4. Run e2e tests (example for mortgage service):

```bash
pnpm test:e2e:mortgage
```

5. Stop the environment:

```bash
pnpm local:stop
```

6. Reset everything (destructive):

```bash
pnpm local:reset
```

---

## Environment / Configuration Notes

- LocalStack runs on `http://localhost:4566` (edge port). Configure clients with `AWS_ENDPOINT_URL` or `LOCALSTACK_ENDPOINT`.
- The test database is MySQL exposed on host port `3307` to avoid conflicts with any local MySQL instance.
- `.env` contains variables used by CDK during deployment (DB credentials, secrets, etc.). Copy `.env.example` to `.env` and fill in values.
- S3 path-style addressing is enabled via `AWS_S3_FORCE_PATH_STYLE=true` to ensure compatibility with LocalStack.

Example important env vars:

```bash
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
DATABASE_URL="mysql://qshelter:qshelter_pass@127.0.0.1:3307/qshelter_test"
JWT_ACCESS_SECRET=test-jwt-access-secret-key-for-e2e-testing-min-32-chars
```

---

## AWS Resources Provisioned by CDK

The CDK stack (`infrastructure/lib/localstack-stack.ts`) creates the following resources in LocalStack for the `test` stage:

- S3 buckets: `qshelter-test-uploads`, `qshelter-test-documents`
- SSM parameters under `/qshelter/test/*` (DB credentials, s3-bucket-name, event-bus-name, redis-endpoint, authorizer-lambda-arn, notification service params)
- Secrets Manager secrets: `qshelter/test/jwt-access-secret`, `qshelter/test/jwt-refresh-secret`, `qshelter/test/oauth`, `qshelter/test/paystack`
- DynamoDB table: `qshelter-test-role-policies` (stores authorizer policies)
- EventBridge bus: `qshelter-test-event-bus` and a catch-all rule
- SQS queues: `qshelter-test-notifications`, `qshelter-test-contract-events`, and a DLQ
- SNS topics for notifications and contract events
- CloudWatch Logs groups for Lambda functions

The seed script (`infrastructure/scripts/seed-role-policies.mjs`) populates role policies for `admin`, `buyer`, and `agent`.

---

## Manual CDK Deployment

If you need to deploy or update infrastructure manually:

```bash
cd infrastructure

# Bootstrap (one-time)
pnpm localstack:bootstrap

# Deploy
pnpm localstack:deploy

# View diff
pnpm localstack:diff

# Destroy
pnpm localstack:destroy
```

---

## Services Emulated (LocalStack Community)

LocalStack provides emulation for many core AWS services used by QShelter. The community edition covers the following relevant services:

- S3 (presigned URLs) ✅
- SSM Parameter Store ✅
- Secrets Manager ✅ (note: no KMS-backed encryption in community)
- DynamoDB ✅
- EventBridge ✅
- SQS / SNS ✅
- Lambda ✅ (basic execution, Docker-based)
- API Gateway ✅ (basic behaviour) — advanced features may differ
- CloudWatch Logs ✅

Caveats:

- Some advanced features (KMS-backed secrets, rotation, advanced API Gateway v2 features, IAM edge cases) may not be fully replicated by LocalStack Community. For exact production parity, test critical flows against real AWS.
- Lambda authorizer runtime behavior and API Gateway integrations sometimes require minor adjustments; for tests where authorizer fidelity matters, simulate authorizer behaviour in tests or use AWS SAM for higher fidelity.

---

## Test Utilities (from `local-dev/lib`)

- `aws-clients.ts` — factory functions that create AWS SDK clients automatically pointed at LocalStack when `AWS_ENDPOINT` / `LOCALSTACK_ENDPOINT` is set.
- `test-utils.ts` — helpers to generate JWTs, get prebuilt auth headers, and other small utilities used by e2e tests.
- `db-cleanup.ts` — helpers to truncate tables, seed minimal required data, and create a `createDatabaseCleaner` helper for Jest hooks.

Usage examples:

```ts
import {
  createS3Client,
  createSSMClient,
} from "../../local-dev/lib/aws-clients";
import { getAuthHeader } from "../../local-dev/lib/test-utils";

const s3 = createS3Client();
const auth = getAuthHeader("admin");

await request(app).get("/contracts").set("Authorization", auth).expect(200);
```

---

## Troubleshooting

- Check LocalStack health:

```bash
curl http://localhost:4566/_localstack/health
```

- View LocalStack and container logs:

```bash
pnpm local:logs localstack
# or
docker logs -f qshelter-localstack
```

- MySQL connection issues:

```bash
# verify port
lsof -i :3307
# check container logs
docker logs qshelter-mysql
```

- Reset environment if something is inconsistent:

```bash
pnpm local:reset
pnpm local:start
```

---

## Next Steps / Recommendations

- If exact AWS authorizer/runtime parity is required, add a small set of integration tests that run against a real AWS test account.
- For CI: run `pnpm local:start` in a service job or use a GitHub Actions runner with Docker to start LocalStack and MySQL before running e2e tests.
- If you need LocalStack Pro features (higher fidelity for API GW/Lambda/Secrets), consider upgrading selectively.

---

## Contact

If you want, I can also:

- Add a VS Code `launch.json` and `tasks.json` to automate start/migrate/test flows.
- Configure a GitHub Actions workflow that brings up LocalStack and runs the e2e suite.

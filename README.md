# QShelter API

Serverless backend for multi-tenant real estate sales, mortgage processing, payment orchestration, and document-driven underwriting workflows.

This repository is a monorepo containing independent Lambda-backed microservices, shared infrastructure CDK stacks, and integration tests.

## Product Idea

QShelter is designed as an operating system for real estate financing teams.

The platform coordinates the full journey:

1. Property supply creation by developers and agents.
2. Customer onboarding and application intake.
3. Multi-step qualification and document review.
4. Payment milestones (for example downpayment then mortgage phases).
5. Cross-organization collaboration between platform ops, developers, and lenders.

The key product principle is process control: every transition is explicit, role-governed, and tenant-scoped.

## Architecture

- Serverless-first: AWS API Gateway + Lambda (Express)
- Database: Aurora MySQL (Prisma ORM)
- Auth: API Gateway Lambda authorizer (REQUEST type) — validates JWT, checks role policies, injects auth context into downstream services via headers
- Multi-tenancy: tenant-scoped Prisma utilities across all services
- Events: SNS/SQS orchestration between services
- Shared types: `@valentine-efagene/qshelter-common` npm package

## Services

```
services/
├── user-service          # Auth, tenants, organizations, invitations
├── property-service      # Property catalog, units, inventory
├── mortgage-service      # Applications, phases, approvals, transfers
├── documents-service     # Templates, questionnaires, review workflows
├── payment-service       # Plans, schedules, installment tracking
├── notification-service  # Email/SMS dispatch via SNS
└── uploader-service      # Presigned S3 upload URLs
```

Each service exposes interactive API documentation.

**LocalStack (after running `setup.sh`)** — services run as Lambdas behind API Gateway:

| Service              | Swagger UI                                                                     | OpenAPI JSON       |
| -------------------- | ------------------------------------------------------------------------------ | ------------------ |
| user-service         | `http://localhost:4566/restapis/i4yzi8khcx/localstack/_user_request_/api-docs` | `.../openapi.json` |
| property-service     | `http://localhost:4566/restapis/mdfxapvcyr/localstack/_user_request_/api-docs` | `.../openapi.json` |
| mortgage-service     | `http://localhost:4566/restapis/ondg8oefes/localstack/_user_request_/api-docs` | `.../openapi.json` |
| documents-service    | `http://localhost:4566/restapis/gg7g6thsgu/localstack/_user_request_/api-docs` | `.../openapi.json` |
| payment-service      | `http://localhost:4566/restapis/vq6rto1da5/localstack/_user_request_/api-docs` | `.../openapi.json` |
| notification-service | `http://localhost:4566/restapis/tmlknv2bup/localstack/_user_request_/api-docs` | `.../openapi.json` |
| uploader-service     | `http://localhost:4566/restapis/gnuw1pwul6/localstack/_user_request_/api-docs` | `.../openapi.json` |

> API Gateway IDs are assigned at deploy time and stay stable as long as LocalStack state is preserved. If you run `teardown.sh` + `setup.sh`, the IDs will change — recheck with `aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis`.

**Direct Node.js (`npm run dev`)** — ports 3001–3007 (e.g. `http://localhost:3001/api-docs`). This mode is not used by default; the standard local environment is LocalStack.

## Local Development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for LocalStack + MySQL + Redis)
- [Node.js](https://nodejs.org/) v20+
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) — needed by deploy scripts
- [cdklocal](https://github.com/localstack/aws-cdk-local) — `npm install -g aws-cdk-local aws-cdk`

### First-time setup

**1. Install dependencies**

```bash
npm install
```

**2. Configure local secrets**

```bash
cp local-dev/.env.example local-dev/.env
```

Fill in `local-dev/.env` with real values for JWT secrets, SMTP credentials, and OAuth keys. The database credentials are pre-filled for the Docker MySQL container and do not need changing.

**3. Full setup — boots Docker, deploys infrastructure and all service Lambdas**

```bash
cd local-dev && ./scripts/setup.sh
```

This single command:

- Starts LocalStack, MySQL, and Redis via Docker Compose
- Deploys CDK infrastructure (SSM params, SNS topics, SQS queues, S3 buckets, Secrets Manager)
- Runs Prisma DB migrations
- Builds the shared `qshelter-common` library
- Builds and deploys all 7 service Lambdas to LocalStack
- Fixes API Gateway stage names (LocalStack quirk)

First run takes ~5–10 minutes. Services are available on LocalStack REST API endpoints after completion.

### Subsequent restarts

After a machine reboot, Docker containers need to be restarted but the Lambdas are already deployed (LocalStack persists state in `local-dev/localstack-data/`):

```bash
cd local-dev && ./scripts/start.sh
```

If you have changed service code since the last deploy, see **Redeploying after code changes** below.

### Stop the environment

```bash
cd local-dev && docker compose down
```

### Redeploying after code changes

Lambdas are not hot-reloaded. After editing any service, you must rebuild and redeploy it:

```bash
cd services/<service-name> && npm run deploy:localstack
```

Replace `<service-name>` with e.g. `mortgage-service`, `user-service`, `property-service`, etc.

> **Note:** Changes to `shared/common` do not automatically propagate. For local development, rebuild shared first then redeploy the affected service:
>
> ```bash
> cd shared/common && npm run build
> cd services/<service-name> && npm run deploy:localstack
> ```

### Reset everything

```bash
cd local-dev && ./scripts/teardown.sh
# Then re-run setup.sh for a clean slate
```

### Troubleshooting

#### CDK stack stuck in ROLLBACK_COMPLETE

If `setup.sh` fails during the CDK deploy step (Step 2), LocalStack may leave the `QShelterLocalStack` stack in a `ROLLBACK_COMPLETE` state. Subsequent runs of `setup.sh` will fail immediately because CloudFormation won't re-deploy over a rolled-back stack.

**Symptom:**

```
❌  QShelterLocalStack failed: ToolkitError: The stack named QShelterLocalStack failed creation,
it may need to be manually deleted from the AWS console: ROLLBACK_COMPLETE
```

**Fix:** Delete the stuck stack, then re-run `setup.sh`:

```bash
AWS_ENDPOINT_URL=http://localhost:4566 \
AWS_ACCESS_KEY_ID=test \
AWS_SECRET_ACCESS_KEY=test \
aws cloudformation delete-stack --stack-name QShelterLocalStack --region us-east-1

# Wait a few seconds, then run setup again
cd local-dev && bash scripts/setup.sh
```

#### Missing or empty values in local-dev/.env

The CDK stack reads secrets from `local-dev/.env` at deploy time. Any required variable that is empty will cause SSM parameter creation to fail with a `ValidationException`. Check `local-dev/.env.example` for the full list of required variables and ensure none are blank.

### AWS staging

```bash
cd scripts
./deploy-staging.sh all
```

### Teardown staging

```bash
cd scripts
./teardown-staging.sh
```

Always use `npm run deploy:staging` / `npm run deploy:localstack` inside each service — never raw `npx sls deploy`.

## Prisma Workflows

All Prisma commands run from `shared/common`.

```bash
# Generate Prisma client after schema changes
cd shared/common && npm run generate:prisma

# Run migrations locally
cd shared/common && npm run migrate:local

# Open Prisma Studio (local)
cd shared/common && npm run studio:local

# Open Prisma Studio (staging)
cd shared/common && npm run studio:staging
```

## Shared Package

After changing `shared/common`:

```bash
cd shared/common
npm run generate:prisma
npm run patch                           # bumps and publishes new version
```

Then update all consuming services and regenerate the root lockfile:

```bash
cd services/<service> && npm i @valentine-efagene/qshelter-common@latest
```

## Testing

```bash
# LocalStack integration tests
cd tests/localstack && npm run run:full-e2e

# AWS staging full mortgage flow
cd tests/aws && ./scripts/run-full-e2e-staging.sh
```

## Documentation

- Scenario and domain docs: `docs/`
- Infrastructure: `infrastructure/README.md`
- Local dev: `local-dev/README.md`
- Postman collection + environments: `postman/`

## Simplification Backlog

Things identified as over-engineered for MVP. Address these before scaling the team.

### Auth migration: JWT middleware → Lambda authorizer

**Decision:** Retire the per-service JWT Express middleware in favour of the API Gateway Lambda authorizer pattern (`services/authorizer-stack-dynamo/`).

**What changes:**

- The Lambda authorizer validates the JWT and checks role policies against DynamoDB _before_ the request reaches any service Lambda
- Services no longer import or run auth middleware — they trust the auth context headers injected by the authorizer
- `services/authorizer-api-dynamo/` provides the CRUD API for managing role policies in DynamoDB — keep this

**Done:**

- Authorizer now uses `jsonwebtoken` with signature verification (`process.env.JWT_SECRET`)
- Authorizer returns auth context (userId, tenantId, roles, etc.) in the policy response
- Each service's `lambda.ts` injects that context as `x-authorizer-*` headers before passing the event to Express
- `extractAuthContext()` in `shared/common` reads only from `x-authorizer-*` headers (JWT decode path removed)
- `setupAuth()` calls removed from all `local.ts` files

**Remaining:** The `JWT_SECRET` env var must be set in the authorizer Lambda (from Secrets Manager via CDK). Also need to set the SSM param `/qshelter/{stage}/authorizer-lambda-arn` after deploying the authorizer stack.

### Remove from mortgage-service

These services exist but are not part of the canonical mortgage flow (Emeka / Sunrise Heights):

- `gate-plan.service.ts` — gate phases, never used in any scenario
- `property-transfer.service.ts` — unit transfers, post-MVP
- `payment-method-change.service.ts` — switching payment method mid-application, post-MVP
- `admin-override.service.ts` — workaround for stuck applications
- `condition-evaluator.service.ts` — JSONPath rule evaluation, only needed if event-execution stays
- `event-execution.service.ts` — dynamic event handler engine, 500+ lines for future flexibility
- `underwriting.service.ts` — eligibility scoring engine, future feature

### Remove from user-service

- `api-key.service.ts` — API key management via Secrets Manager, post-MVP
- `social.service.ts` — OAuth/social login, post-MVP
- `onboarding.service.ts` — overlaps with bootstrap logic

### Merge

- `approval-request.service.ts` → fold into `approval-workflow.service.ts`

### Infrastructure

- `infrastructure/lib/localstack-stack.ts` — duplicate of the AWS stack for LocalStack. Parity violations are a recurring bug source. Consider dropping CDK for local dev and using Docker Compose + hardcoded config directly.

### Tenant scoping

- `wallet.service.ts` `findById` / `findByUserId` do not filter by `tenantId`. Low risk today (UUID IDs, authenticated callers) but should be fixed before multi-tenant production use.

### Service pattern inconsistency

- `mortgage-service` uses factory functions (`createXxxService(prisma)`); all other services use class singletons. The factory pattern was adopted to support injecting tenant-scoped Prisma clients, but that can be done inside class methods instead. Standardise on classes when touching these files.

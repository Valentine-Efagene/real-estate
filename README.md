# QShelter API

Serverless backend for multi-tenant real estate sales, mortgage processing, payment orchestration, and document-driven underwriting workflows.

This repository is a pnpm monorepo containing independent Lambda-backed microservices, shared infrastructure CDK stacks, and integration tests.

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

## Local Development

### Prerequisites

- Docker (for LocalStack + MySQL)
- Node.js, pnpm

### Start local environment

```bash
cd local-dev
./scripts/start.sh
```

Boots LocalStack, MySQL, and deploys all services with LocalStack configs.

### Install dependencies

```bash
cd api
pnpm install
```

## Deployment

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
cd api && pnpm install                  # keeps pnpm-lock.yaml in sync
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
- `onboarding-flow.service.ts` — configurable onboarding questionnaires, future feature
- `onboarding.service.ts` — overlaps with bootstrap logic

### Merge

- `approval-request.service.ts` → fold into `approval-workflow.service.ts`

### Infrastructure

- `infrastructure/lib/localstack-stack.ts` — duplicate of the AWS stack for LocalStack. Parity violations are a recurring bug source. Consider dropping CDK for local dev and using Docker Compose + hardcoded config directly.

### Tenant scoping

- `wallet.service.ts` `findById` / `findByUserId` do not filter by `tenantId`. Low risk today (UUID IDs, authenticated callers) but should be fixed before multi-tenant production use.

### Service pattern inconsistency

- `mortgage-service` uses factory functions (`createXxxService(prisma)`); all other services use class singletons. The factory pattern was adopted to support injecting tenant-scoped Prisma clients, but that can be done inside class methods instead. Standardise on classes when touching these files.

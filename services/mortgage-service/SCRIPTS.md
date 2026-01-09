# Mortgage Service Scripts

This document describes the available npm scripts for the mortgage-service.

## Prerequisites for LocalStack E2E Tests

Before running any `test:e2e:localstack:*` scripts, you must have the LocalStack environment fully set up. Run the following from the `local-dev` directory:

```bash
cd local-dev

# Full setup (starts Docker, deploys CDK infrastructure, runs migrations, builds, deploys all services)
pnpm run setup

# Or step-by-step:
pnpm run start              # Start Docker containers (LocalStack, MySQL, Redis)
pnpm run migrate            # Run database migrations
pnpm run deploy:all         # Deploy all services to LocalStack
```

### What `setup` does:

1. **Starts Docker containers** - LocalStack, MySQL, Redis
2. **Deploys CDK infrastructure** - SNS topics, SQS queues, S3 buckets, DynamoDB tables
3. **Runs database migrations** - Prisma migrate deploy
4. **Builds shared libraries** - qshelter-common
5. **Deploys all service Lambdas** - authorizer, user, property, mortgage, notifications, documents
6. **Seeds initial data** - Role policies, etc.

## Build & Deploy Scripts

| Script                      | Description                                |
| --------------------------- | ------------------------------------------ |
| `npm run build`             | Compile TypeScript and bundle with esbuild |
| `npm run deploy`            | Deploy to AWS dev stage (default)          |
| `npm run deploy:dev`        | Deploy to AWS dev stage                    |
| `npm run deploy:staging`    | Deploy to AWS staging stage                |
| `npm run deploy:prod`       | Deploy to AWS production stage             |
| `npm run deploy:localstack` | Deploy to LocalStack (local AWS emulation) |

## Development Scripts

| Script              | Description                            |
| ------------------- | -------------------------------------- |
| `npm run start`     | Build and run locally (Express server) |
| `npm run start:dev` | Alias for `start`                      |
| `npm run format`    | Format source code with Prettier       |
| `npm run lint`      | Lint and fix TypeScript files          |

## Test Scripts

### Unit Tests

| Script         | Description              |
| -------------- | ------------------------ |
| `npm run test` | Run unit tests with Jest |

### E2E Tests (LocalStack)

These tests run against the deployed LocalStack environment. **Make sure LocalStack is running and all services are deployed first.**

| Script                                          | Description                            |
| ----------------------------------------------- | -------------------------------------- |
| `npm run test:e2e:localstack`                   | Run all E2E tests against LocalStack   |
| `npm run test:e2e:localstack:all`               | Alias for running all E2E tests        |
| `npm run test:e2e:localstack:chidi`             | Run the Chidi-Lekki mortgage scenario  |
| `npm run test:e2e:localstack:payment-change`    | Run the payment method change scenario |
| `npm run test:e2e:localstack:property-transfer` | Run the property transfer scenario     |
| `npm run test:e2e:localstack:jinx`              | Run the Jinx workflow builder scenario |

### Base E2E Script

| Script             | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `npm run test:e2e` | Base E2E test command (requires `API_BASE_URL` env var) |

## E2E Test Scenarios

Each scenario is a complete user story with named actors:

### 1. Chidi-Lekki Mortgage (`chidi-lekki-mortgage`)

- **Actors**: Chidi (customer), Adaeze (admin)
- **Story**: Chidi applies for a 10/90 Lekki mortgage, goes through underwriting, makes downpayment, and gets approved

### 2. Payment Method Change (`payment-method-change`)

- **Actors**: Chidi (customer), Adaeze (admin)
- **Story**: Chidi requests to change his payment method from outright to mortgage; Adaeze reviews and approves

### 3. Property Transfer (`property-transfer`)

- **Actors**: Emeka (seller), Funke (buyer), Adaeze (admin)
- **Story**: Emeka sells his property unit to Funke; system handles contract transfer, payment allocation, and notifications

### 4. Jinx Workflow Builder (`jinx-workflow-builder`)

- **Actors**: Jinx (admin)
- **Story**: Jinx configures custom payment method workflows with phases and steps

## Quick Start

```bash
# 1. Setup LocalStack environment (from repo root)
cd local-dev && pnpm run setup

# 2. Run all E2E tests
cd ../services/mortgage-service
npm run test:e2e:localstack:all

# 3. Or run a specific scenario
npm run test:e2e:localstack:chidi
npm run test:e2e:localstack:property-transfer
```

## Troubleshooting

### "Cannot connect to LocalStack"

```bash
# Check if LocalStack is running
docker ps | grep localstack

# Restart LocalStack
cd local-dev && pnpm run stop && pnpm run start
```

### "API Gateway not found"

```bash
# Redeploy the mortgage service
npm run deploy:localstack
```

### "Database connection failed"

```bash
# Run migrations
cd local-dev && pnpm run migrate
```

### "SNS/SQS not working"

```bash
# Redeploy CDK infrastructure
cd infrastructure && pnpm localstack:deploy
```

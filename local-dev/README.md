# QShelter Local Development Environment

This directory contains everything needed to run the QShelter platform locally for e2e testing.

## Quick Start

```bash
# From the project root
pnpm local:start      # Start LocalStack, MySQL, Redis
pnpm local:migrate    # Run Prisma migrations
pnpm test:e2e         # Run all e2e tests
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Local Dev Environment                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  LocalStack  │  │    MySQL     │  │    Redis     │           │
│  │  (AWS Mock)  │  │   (3307)     │  │   (6379)     │           │
│  │    :4566     │  │              │  │              │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│  ┌──────┴─────────────────┴─────────────────┴───────┐           │
│  │                Service Under Test                 │           │
│  │  (mortgage-service, user-service, etc.)          │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Services

| Service    | Port | Description                             |
| ---------- | ---- | --------------------------------------- |
| LocalStack | 4566 | All AWS services (S3, SSM, etc.)        |
| MySQL      | 3307 | Database (uses 3307 to avoid conflicts) |
| Redis      | 6379 | Cache                                   |
| Adminer    | 8080 | Database UI                             |

## AWS Services Available in LocalStack

- **S3** - File uploads with presigned URLs
- **SSM Parameter Store** - Configuration parameters
- **Secrets Manager** - JWT secrets, OAuth credentials
- **DynamoDB** - Role policies for authorizer
- **EventBridge** - Event bus for service communication
- **SQS** - Message queues
- **SNS** - Pub/sub notifications
- **CloudWatch Logs** - Logging
- **Lambda** - Function execution (basic)
- **API Gateway** - HTTP APIs (basic)

## Scripts

From project root:

| Script               | Description                   |
| -------------------- | ----------------------------- |
| `pnpm local:start`   | Start all containers          |
| `pnpm local:stop`    | Stop all containers           |
| `pnpm local:reset`   | Delete all data and restart   |
| `pnpm local:logs`    | Tail container logs           |
| `pnpm local:migrate` | Run Prisma migrations         |
| `pnpm local:seed`    | Seed database with test data  |
| `pnpm test:e2e`      | Start env + run all e2e tests |

## Environment Configuration

The `.env.test` file contains all environment variables for testing:

```bash
# AWS/LocalStack
AWS_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Database
DATABASE_URL="mysql://qshelter:qshelter_pass@127.0.0.1:3307/qshelter_test"

# JWT (matches secrets in LocalStack)
JWT_ACCESS_SECRET=test-jwt-access-secret-key-for-e2e-testing-min-32-chars
JWT_REFRESH_SECRET=test-jwt-refresh-secret-key-for-e2e-testing-min-32-chars
```

## Test Utilities

The `lib/` directory provides utilities for e2e tests:

### AWS Clients (LocalStack-aware)

```typescript
import { createS3Client, createSSMClient } from "../local-dev/lib";

const s3 = createS3Client(); // Automatically routes to LocalStack in test
```

### JWT Test Helpers

```typescript
import { getAuthHeader, testUsers } from "../local-dev/lib";

// Get auth header for predefined test users
const adminAuth = getAuthHeader("admin");
const buyerAuth = getAuthHeader("buyer");

// Use in supertest
await request(app)
  .get("/contracts")
  .set("Authorization", adminAuth)
  .expect(200);
```

### Database Cleanup

```typescript
import { createDatabaseCleaner } from "../local-dev/lib";

const cleaner = createDatabaseCleaner(prisma);

beforeEach(async () => {
  await cleaner.clean();
  await cleaner.seed();
});

afterAll(async () => {
  await cleaner.disconnect();
});
```

## Interacting with LocalStack

Use the AWS CLI with `--endpoint-url`:

```bash
# Set environment
export AWS_ENDPOINT=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

# S3
aws --endpoint-url=$AWS_ENDPOINT s3 ls

# SSM
aws --endpoint-url=$AWS_ENDPOINT ssm get-parameter --name /qshelter/test/database-url

# Secrets Manager
aws --endpoint-url=$AWS_ENDPOINT secretsmanager get-secret-value --secret-id qshelter/test/jwt-access-secret

# DynamoDB
aws --endpoint-url=$AWS_ENDPOINT dynamodb scan --table-name qshelter-test-role-policies

# EventBridge
aws --endpoint-url=$AWS_ENDPOINT events list-event-buses
```

Or install `awslocal` (LocalStack CLI wrapper):

```bash
pip install awscli-local
awslocal s3 ls
```

## Pre-seeded Data

The initialization script seeds:

### S3 Buckets

- `qshelter-test-uploads` (with CORS)
- `qshelter-test-documents`

### SSM Parameters

- `/qshelter/test/database-url`
- `/qshelter/test/s3-bucket-name`
- `/qshelter/test/event-bus-name`
- `/qshelter/test/redis-endpoint`
- `/qshelter/test/authorizer-lambda-arn`

### Secrets

- `qshelter/test/jwt-access-secret`
- `qshelter/test/jwt-refresh-secret`
- `qshelter/test/oauth`
- `qshelter/test/paystack`

### DynamoDB Role Policies

- `admin` - Full access to all resources
- `buyer` - Read properties, manage own contracts
- `agent` - Manage properties and contracts

## Troubleshooting

### LocalStack not starting

```bash
docker logs qshelter-localstack
```

### MySQL connection refused

Ensure port 3307 is available (not 3306 to avoid conflicts):

```bash
lsof -i :3307
```

### Reset everything

```bash
pnpm local:reset
pnpm local:start
```

### Check service health

```bash
curl http://localhost:4566/_localstack/health
docker exec qshelter-mysql mysqladmin ping -u root -prootpassword
```

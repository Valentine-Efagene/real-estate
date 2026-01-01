# LocalStack / Local Development

## Prerequisites

1. LocalStack running via Docker (provides SNS, SSM, Secrets Manager, API Gateway emulation).
2. Local MySQL on port 3307 (via `local-dev/docker-compose.yml`).
3. Run `local-dev/scripts/start.sh` to initialize LocalStack with required SSM parameters.

## Setup

```bash
# Install dependencies
pnpm install   # or npm install

# Push Prisma schema to local DB
NODE_ENV=test prisma db push --schema=../../shared/common/prisma/schema.prisma
```

## Running Locally

### Option A: Deploy to LocalStack (recommended for testing real AWS integrations)

```bash
npm run deploy:test
```

This deploys the Lambda + API Gateway into LocalStack. Invoke via `http://localhost:4566/restapis/<api-id>/test/_user_request_/...`.

### Option B: Run Express directly (faster iteration, no Lambda emulation)

```bash
npm run start
```

This runs the Express server at `http://localhost:3004`.

## Notes

- `.env.test` points AWS SDKs at `http://localhost:4566`.
- The `serverless-localstack` plugin routes `sls deploy --stage test` to LocalStack automatically.
- SSM parameters for the `test` stage are seeded by `local-dev/init-scripts/setup-aws.sh`.

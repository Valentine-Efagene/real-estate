# Running Mortgage Service E2E Tests

This guide explains how to run the mortgage-full-flow E2E tests after a fresh laptop restart.

## Prerequisites

- Docker Desktop installed and running
- Node.js 20+ installed
- pnpm installed (`npm install -g pnpm`)

## Steps to Run Tests

### 1. Start Docker Desktop

Ensure Docker Desktop is running on your machine before proceeding.

### 2. Start the Local Development Environment

From the repository root (`/real-estate`), run:

```bash
pnpm local:start
```

This command will:

- Start LocalStack (AWS services mock) on port 4566
- Start MySQL on port 3307
- Start Redis on port 6379
- Start Adminer (DB UI) on port 8080
- Deploy AWS resources via CDK to LocalStack
- Seed role policies to DynamoDB

Wait for all services to report as healthy:

```
✓ MySQL is ready
✓ LocalStack is ready
✓ Redis is ready
```

### 3. Run Database Migrations

From the repository root, run:

```bash
pnpm local:migrate
```

This will:

- Generate the Prisma client from the schema
- Apply all pending migrations to the test database

### 4. Run the Mortgage E2E Tests

Navigate to the mortgage-service directory and run the tests:

```bash
cd services/mortgage-service
npm run test:e2e -- mortgage-full-flow
```

Or from the repository root:

```bash
pnpm test:e2e:mortgage
```

## One-Liner (All Steps Combined)

From the repository root, you can run everything in sequence:

```bash
pnpm local:start && pnpm local:migrate && cd services/mortgage-service && npm run test:e2e -- mortgage-full-flow
```

## Troubleshooting

### Database Connection Timeout

If you see `pool timeout: failed to retrieve a connection from pool`, the MySQL container may not be running:

```bash
# Check container status
cd local-dev && docker compose ps

# Start MySQL if not running
docker compose up -d mysql

# Wait for it to be healthy, then retry tests
```

### LocalStack Not Ready

If AWS services fail, ensure LocalStack is healthy:

```bash
curl http://localhost:4566/_localstack/health
```

### Reset Everything

If things are broken, reset the entire local environment:

```bash
pnpm local:reset
```

This will stop all containers, delete all data, and restart fresh.

### View Database

Access Adminer at http://localhost:8080 with:

- **Server**: mysql
- **Username**: root
- **Password**: rootpassword
- **Database**: qshelter_test

## Service Ports

| Service    | Port | Description                             |
| ---------- | ---- | --------------------------------------- |
| LocalStack | 4566 | All AWS services (S3, SSM, etc.)        |
| MySQL      | 3307 | Database (uses 3307 to avoid conflicts) |
| Redis      | 6379 | Cache                                   |
| Adminer    | 8080 | Database UI                             |

## Environment Files

The tests use `.env.test` for configuration. Key variables:

```bash
NODE_ENV=test
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=rootpassword
DB_NAME=qshelter_test
AWS_ENDPOINT_URL=http://localhost:4566
```

D

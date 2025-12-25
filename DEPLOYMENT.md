# QShelter Microservices Deployment Guide

## Architecture Overview

QShelter uses a **decoupled microservices architecture** where:

- **CDK Stack** provisions shared infrastructure (VPC, RDS, S3, EventBridge, API Gateway)
- **Each service** deploys independently using Serverless Framework
- **Services communicate** via EventBridge event bus (no direct calls)
- **Authorization** is centralized in the API Gateway Lambda authorizer

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 18.x or later
3. Serverless Framework installed globally: `npm install -g serverless`
4. Docker (for local development)

## Infrastructure Setup (One-Time)

### 1. Deploy CDK Stack

The CDK stack creates shared infrastructure:

```bash
cd /path/to/real-estate
npm install
npm run build
cdk bootstrap  # First time only
cdk deploy
```

**CDK Stack Creates:**

- VPC and subnets (if needed)
- RDS PostgreSQL/MySQL instances
- S3 buckets for uploads
- EventBridge event bus
- API Gateway (if using single gateway)
- Lambda authorizer function
- CloudWatch log groups
- IAM roles

### 2. Note Infrastructure Outputs

After CDK deployment, note these outputs:

- Database endpoints and credentials
- S3 bucket names
- EventBridge event bus name
- Lambda authorizer ARN
- VPC/subnet IDs (if applicable)

## Service Deployment

Each service is deployed **independently** using its own `serverless.yml`.

### General Deployment Steps

For **each service** (user-service, property-service, mortgage-service, notifications):

#### 1. Configure Environment

```bash
cd services/{service-name}
cp .env.example .env
# Edit .env with actual values from CDK outputs
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Build the Service

```bash
npm run build
```

#### 4. Deploy to AWS

```bash
# Deploy to dev environment
serverless deploy --stage dev

# Deploy to production
serverless deploy --stage prod
```

#### 5. View Deployment Info

```bash
serverless info --stage dev
```

### Service-Specific Deployment

#### User Service

```bash
cd services/user-service
cp .env.example .env
# Configure: DB_HOST, JWT_SECRET, GOOGLE_CLIENT_ID, etc.
npm install
npm run build
serverless deploy --stage dev
```

**Endpoints created:**

- `/user/auth/*` - Authentication (public)
- `/user/users/*` - User management (protected)
- `/user/roles/*` - Role management (protected)
- `/user/permissions/*` - Permission management (protected)

#### Property Service

```bash
cd services/property-service
cp .env.example .env
# Configure: DB_HOST, S3_BUCKET_NAME, etc.
npm install
npm run build
serverless deploy --stage dev
```

**Endpoints created:**

- `/property/properties/*` - Property CRUD
- `/property/property-media/*` - Media management
- `/property/property-document/*` - Document management
- `/property/amenities/*` - Amenity management
- `/property/upload/presigned-url` - Generate presigned S3 URLs

#### Mortgage Service

```bash
cd services/mortgage-service
cp .env.example .env
# Configure: DB_HOST, EVENT_BUS_NAME, etc.
npm install
npm run build
serverless deploy --stage dev
```

**Endpoints created:**

- `/mortgage/mortgages/*` - Mortgage management
- `/mortgage/mortgage-types/*` - Mortgage types
- `/mortgage/downpayments/*` - Downpayment tracking
- `/mortgage/payments/*` - Payment tracking

**Event Handlers:**

- FSM state transition listener (EventBridge)

#### Notifications Service

```bash
cd services/notifications
cp .env.example .env
# Configure: SES_FROM_EMAIL, SNS_SENDER_ID, etc.
npm install
npm run build
serverless deploy --stage dev
```

**Event Handlers:**

- Email notification requests
- SMS notification requests
- Push notification requests

## Local Development

Each service can run locally using `serverless-offline`:

```bash
cd services/{service-name}
npm run dev  # or serverless offline
```

This starts the service on its configured port (3001, 3002, 3003, etc.).

### Running All Services Locally

Use Docker Compose for the database and run each service in a separate terminal:

```bash
# Terminal 1: Database
docker-compose up -d

# Terminal 2: User Service
cd services/user-service && npm run dev

# Terminal 3: Property Service
cd services/property-service && npm run dev

# Terminal 4: Mortgage Service
cd services/mortgage-service && npm run dev

# Terminal 5: Notifications Service
cd services/notifications && npm run dev
```

## Environment Variables

Each service has its own `.env` file. **Never commit .env files to git**.

### Required Variables by Service

#### User Service

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
- `ENCRYPTION_PASSWORD`, `ENCRYPTION_SALT`
- `GOOGLE_CLIENT_ID`
- `FRONTEND_BASE_URL`, `BASE_URL`
- `EVENT_BUS_NAME`, `AUTHORIZER_LAMBDA_ARN`

#### Property Service

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET`
- `S3_BUCKET_NAME`
- `EVENT_BUS_NAME`, `AUTHORIZER_LAMBDA_ARN`

#### Mortgage Service

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET`
- `EVENT_BUS_NAME`, `AUTHORIZER_LAMBDA_ARN`

#### Notifications Service

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `SES_FROM_EMAIL`, `SES_FROM_NAME`
- `SNS_SENDER_ID`
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`
- `EVENT_BUS_NAME`, `AUTHORIZER_LAMBDA_ARN`

## Deployment Workflow

### Development Flow

1. Develop feature in local environment
2. Test locally with `npm run dev`
3. Build: `npm run build`
4. Deploy to dev: `serverless deploy --stage dev`
5. Test in dev environment
6. Merge to main branch

### Production Flow

1. Tag release: `git tag v1.0.0`
2. Build: `npm run build`
3. Deploy: `serverless deploy --stage prod`
4. Monitor CloudWatch logs
5. Rollback if needed: `serverless rollback --stage prod`

## CI/CD Integration

Each service should have its own CI/CD pipeline:

### GitHub Actions Example

```yaml
name: Deploy User Service

on:
  push:
    branches: [main]
    paths:
      - "services/user-service/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - name: Install dependencies
        working-directory: services/user-service
        run: npm install
      - name: Build
        working-directory: services/user-service
        run: npm run build
      - name: Deploy
        working-directory: services/user-service
        run: npx serverless deploy --stage prod
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Monitoring and Logs

### View Logs

```bash
# Real-time logs
serverless logs -f functionName --tail --stage dev

# Specific time range
serverless logs -f functionName --startTime 1h --stage dev
```

### CloudWatch Dashboards

Each service creates CloudWatch log groups:

- `/aws/lambda/qshelter-user-service-dev-auth`
- `/aws/lambda/qshelter-property-service-dev-properties`
- etc.

## Rollback

```bash
# List deployments
serverless deploy list --stage prod

# Rollback to previous deployment
serverless rollback --timestamp timestamp --stage prod
```

## Troubleshooting

### Service Won't Deploy

- Check AWS credentials: `aws sts get-caller-identity`
- Verify .env file exists and is configured
- Check build output in `dist/` directory
- Review CloudFormation stack in AWS Console

### Function Timeouts

- Increase timeout in `serverless.yml`
- Check database connection pooling
- Review cold start optimization

### Permission Errors

- Verify IAM role statements in `serverless.yml`
- Check EventBridge permissions
- Confirm S3 bucket policies

## Best Practices

1. **Separate databases** per service (or at least separate schemas)
2. **Never share database** credentials between services
3. **Use EventBridge** for inter-service communication
4. **Version your APIs** (e.g., `/v1/users/`)
5. **Monitor costs** - each Lambda invocation costs money
6. **Set appropriate memory/timeout** based on function needs
7. **Use environment-specific .env files** (dev, staging, prod)
8. **Enable X-Ray tracing** for debugging distributed systems

## Cost Optimization

- Use provisioned concurrency only for critical functions
- Set appropriate memory (higher memory = faster but costlier)
- Implement request caching where appropriate
- Use RDS Proxy for connection pooling
- Archive old CloudWatch logs (30-90 days retention)

## Security Considerations

1. **Secrets Management**: Use AWS Secrets Manager or SSM Parameter Store
2. **Encryption**: Encrypt environment variables in Lambda
3. **VPC**: Place services in VPC if accessing private resources
4. **Least Privilege**: IAM roles should have minimal permissions
5. **API Keys**: Rotate regularly
6. **Audit Logs**: Enable CloudTrail for all services

# Deployment Status

Last Updated: January 22, 2026

## AWS Staging Deployment (staging stage)

All services deployed to AWS staging environment. Account: 898751738669, Region: us-east-1.

### Service Endpoints

| Service               | Package Size | Endpoint URL                                           | Status     |
| --------------------- | ------------ | ------------------------------------------------------ | ---------- |
| Authorizer            | 2.8 MB       | Lambda authorizer (stored in SSM)                      | ✅ Working |
| User Service          | 6.1 MB       | https://90wc5do2hf.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Property Service      | 6.5 MB       | https://mknu68wfp4.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Mortgage Service      | 6.6 MB       | https://znfftqvky9.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Documents Service     | 6.8 MB       | https://ibt80hnb5c.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Payment Service       | 4.6 MB       | https://0xty8vn1xb.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Notifications Service | 8.2 MB       | https://gccen9bc1j.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Policy Sync Service   | 5.9 MB       | SQS consumer only (no HTTP API)                        | ✅ Working |

### Health Check Commands

```bash
curl -s https://90wc5do2hf.execute-api.us-east-1.amazonaws.com/health  # user-service
curl -s https://mknu68wfp4.execute-api.us-east-1.amazonaws.com/health  # property-service
curl -s https://znfftqvky9.execute-api.us-east-1.amazonaws.com/health  # mortgage-service
curl -s https://ibt80hnb5c.execute-api.us-east-1.amazonaws.com/health  # documents-service
curl -s https://0xty8vn1xb.execute-api.us-east-1.amazonaws.com/health  # payment-service
curl -s https://gccen9bc1j.execute-api.us-east-1.amazonaws.com/health  # notification-service
```

### CDK Infrastructure

The CDK stack `RealEstateStack-staging` creates:

- VPC with public subnets
- Aurora MySQL Serverless v2
- SNS topics and SQS queues for event-driven architecture
- DynamoDB table for RBAC policies
- S3 bucket for uploads (configured with DESTROY policy for dev)
- Secrets Manager for database credentials

### Critical Deployment Learnings (January 2026)

1. **SSM Pagination Bug**: ConfigService needs to paginate through SSM parameters. Fixed in @valentine-efagene/qshelter-common@2.0.131.

2. **Database Secret IAM**: CDK auto-generates secret names like `RealEstateStackstagingAuror-HXRnyq4N3o9I`. Must add explicit IAM permission via SSM reference:

   ```yaml
   - ${ssm:/qshelter/${self:provider.stage}/database-secret-arn}
   ```

3. **AWS Profile Conflicts**: Serverless Framework may use different AWS credentials. Use `AWS_PROFILE=default` explicitly.

4. **Health Endpoint Routing**: Services need `/health` endpoint routed in serverless.yml (not prefixed with service path).

5. **esbuild Output Path**: Must match serverless.yml handler path. Use `outfile: 'dist/lambda.mjs'` and handler `dist/lambda.handler`.

---

## Recent Changes

### AWS Staging Redeployment (January 22, 2026)

- ✅ Infrastructure redeployed (104 resources including ValkeyCluster)
- ✅ 54 Prisma migrations applied (including optimistic locking)
- ✅ All 8 services deployed and healthy
- ✅ New endpoint URLs generated (previous deployment was torn down)

### Postman Collection Updated (January 22, 2026)

- ✅ Added Organizations folder with 9 endpoints (CRUD + member management)
- ✅ Added Property Variants folder with 5 endpoints
- ✅ Added Property Units folder with 5 endpoints
- ✅ Added Organization Reviews endpoint for multi-party document review
- ✅ Updated Bootstrap Tenant to include password field and list all 7 roles
- ✅ Added new variables: organizationId, memberId, variantId, unitId, etc.

### AWS Staging Deployment (January 17-18, 2026)

- ✅ CDK infrastructure deployed to AWS staging
- ✅ 50 Prisma migrations applied
- ✅ Fixed SSM pagination bug in ConfigService
- ✅ Fixed IAM permissions for database secret access
- ✅ All 7 services deployed and healthy
- ✅ Added /health endpoints to property, mortgage, documents services
- ✅ Fixed payment-service tenant context issues
- ✅ Fixed esbuild config for payment-service

### RBAC Redesign Implementation Complete (January 11, 2026)

- ✅ Implemented federated users with tenant-scoped roles
- ✅ Migrated to path-based permissions (`path` + `methods[]` + `effect`)
- ✅ Added TenantMembership model for many-to-many User ↔ Tenant relationship
- ✅ Updated DynamoDB policy format to version "2" with path-based statements
- ✅ New tenant membership API endpoints for federated user management
- ✅ **Updated authorizer-service** for tenant-scoped path matching with fallback to global roles
- ✅ **Updated user-service login** to use TenantMembership for federated JWT claims
- ✅ **Updated Postman collection** with tenant membership and policy-sync endpoints
- See [docs/RBAC_REDESIGN.md](docs/RBAC_REDESIGN.md) for full details

## Lambda Functions

| Service               | Package Size | Status     | Health Check  | Swagger Docs    |
| --------------------- | ------------ | ---------- | ------------- | --------------- |
| Authorizer            | 105 KB       | ✅ Working | N/A           | N/A             |
| User Service          | 6.1 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |
| Property Service      | 6.4 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |
| Mortgage Service      | 6.2 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |
| Documents Service     | 6.4 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |
| Notifications Service | 7.3 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |
| Policy Sync Service   | 7.0 MB       | ✅ Healthy | `GET /health` | N/A             |

## LocalStack Deployment (localstack stage)

All services have `serverless.localstack.yml` configs that use **REST API v1** for LocalStack compatibility.

### Deploy Command

```bash
# Deploy a service to LocalStack using REST API v1
cd services/<service-name>
npx sls deploy --config serverless.localstack.yml --stage localstack
```

### Current LocalStack API IDs

| Service               | API ID       | REST API Base URL                                                     |
| --------------------- | ------------ | --------------------------------------------------------------------- |
| User Service          | `54d9r9y23n` | `http://localhost:4566/restapis/54d9r9y23n/localstack/_user_request_` |
| Property Service      | `hsmpsiqobm` | `http://localhost:4566/restapis/hsmpsiqobm/localstack/_user_request_` |
| Mortgage Service      | `g8b5hpkucu` | `http://localhost:4566/restapis/g8b5hpkucu/localstack/_user_request_` |
| Documents Service     | `ujsndxfzfd` | `http://localhost:4566/restapis/ujsndxfzfd/localstack/_user_request_` |
| Notifications Service | `imelipwbj1` | `http://localhost:4566/restapis/imelipwbj1/localstack/_user_request_` |
| Policy Sync Service   | `lcgu6wtwdp` | `http://localhost:4566/restapis/lcgu6wtwdp/localstack/_user_request_` |

### Health Check URLs

| Service               | Health URL                                                                 | Status     |
| --------------------- | -------------------------------------------------------------------------- | ---------- |
| User Service          | http://localhost:4566/restapis/54d9r9y23n/localstack/_user_request_/health | ✅ Healthy |
| Property Service      | http://localhost:4566/restapis/hsmpsiqobm/localstack/_user_request_/health | ✅ Healthy |
| Mortgage Service      | http://localhost:4566/restapis/g8b5hpkucu/localstack/_user_request_/health | ✅ Healthy |
| Documents Service     | http://localhost:4566/restapis/ujsndxfzfd/localstack/_user_request_/health | ✅ Healthy |
| Notifications Service | http://localhost:4566/restapis/imelipwbj1/localstack/_user_request_/health | ✅ Healthy |
| Policy Sync Service   | http://localhost:4566/restapis/lcgu6wtwdp/localstack/_user_request_/health | ✅ Healthy |

> **Note**: API IDs change on each deployment. Get current IDs with:
>
> ```bash
> awslocal apigateway get-rest-apis --query 'items[*].[name,id]' --output table
> ```

## Environment

- **Stage**: localstack (LocalStack)
- **Region**: us-east-1
- **LocalStack Endpoint**: http://localhost:4566

## Quick Health Check Commands

```bash
# Test all services via REST API
curl -s http://localhost:4566/restapis/54d9r9y23n/localstack/_user_request_/health  # user-service
curl -s http://localhost:4566/restapis/hsmpsiqobm/localstack/_user_request_/health  # property-service
curl -s http://localhost:4566/restapis/g8b5hpkucu/localstack/_user_request_/health  # mortgage-service
curl -s http://localhost:4566/restapis/ujsndxfzfd/localstack/_user_request_/health  # documents-service
curl -s http://localhost:4566/restapis/imelipwbj1/localstack/_user_request_/health  # notifications
curl -s http://localhost:4566/restapis/lcgu6wtwdp/localstack/_user_request_/health  # policy-sync

# List all deployed REST APIs
awslocal apigateway get-rest-apis --query 'items[*].[name,id]' --output table

# List all deployed Lambda functions
awslocal lambda list-functions --query 'Functions[].FunctionName' --output table
```

## E2E Tests Against Deployed APIs

Tests can run in two modes:

- **LOCAL** (default): Uses supertest in-process - fast, no network
- **DEPLOYED**: Uses fetch against LocalStack REST APIs - tests real Lambda+API Gateway

```bash
# Run e2e tests against local Express app (fast, in-process)
cd services/mortgage-service
npm run test:e2e

# Run e2e tests against deployed LocalStack APIs
npm run test:e2e:deployed

# Or set API_BASE_URL manually
API_BASE_URL=http://localhost:4566/restapis/g8b5hpkucu/localstack/_user_request_ npm run test:e2e

# From local-dev folder
cd local-dev
npm run test:e2e:deployed
```

## E2E Test Coverage

| Service          | Tests | Status     | Notes                                        |
| ---------------- | ----- | ---------- | -------------------------------------------- |
| User Service     | 78    | ✅ Passing | Auth, Users, Roles, Tenants, Socials         |
| Property Service | 21    | ✅ Passing | Properties, Health                           |
| Mortgage Service | 83    | ✅ Passing | Applications, Payments, Templates, Workflows |

## Deployment Notes

- All services use `package.individually: true` with exclude-first patterns for minimal package sizes
- ESBuild outputs `.mjs` files for ESM Lambda compatibility
- Lambda containers use `LOCALSTACK_ENDPOINT=http://host.docker.internal:4566` to reach LocalStack
- Prisma runtime dependencies are explicitly included in package patterns
- LocalStack uses REST API v1 (`http` events) - HTTP API v2 is not supported in Community Edition

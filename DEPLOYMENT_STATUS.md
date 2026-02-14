# Deployment Status

Last Updated: February 14, 2026

## AWS Staging Deployment (staging stage)

All services deployed to AWS staging environment. Account: 898751738669, Region: us-east-1.

**Cost Optimization**: Staging deployment does **NOT** use NAT Gateway (~$32-45/month savings). RDS is publicly accessible and Lambdas run outside VPC. Aurora Serverless v2 configured with scale-to-zero (minCapacity: 0, maxCapacity: 2).

### Service Endpoints

| Service               | Package Size | Endpoint URL                                           | Status     |
| --------------------- | ------------ | ------------------------------------------------------ | ---------- |
| Authorizer            | 2.8 MB       | Lambda authorizer (stored in SSM)                      | ✅ Working |
| User Service          | 6.8 MB       | https://1oi4sd5b4i.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Property Service      | 6.5 MB       | https://z32oarlcp7.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Mortgage Service      | 6.7 MB       | https://el0slr8sg5.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Documents Service     | 6.8 MB       | https://46mkwkht71.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Payment Service       | 4.6 MB       | https://cmwxqd18ga.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Notifications Service | 8.3 MB       | https://bu4wvejwzl.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Uploader Service      | 9 MB         | https://yvkc0irtqj.execute-api.us-east-1.amazonaws.com | ✅ Healthy |
| Policy Sync Service   | 5.9 MB       | SQS consumer only (no HTTP API)                        | ✅ Working |

### Health Check Commands

```bash
curl -s https://1oi4sd5b4i.execute-api.us-east-1.amazonaws.com/health  # user-service
curl -s https://z32oarlcp7.execute-api.us-east-1.amazonaws.com/health  # property-service
curl -s https://el0slr8sg5.execute-api.us-east-1.amazonaws.com/health  # mortgage-service
curl -s https://46mkwkht71.execute-api.us-east-1.amazonaws.com/health  # documents-service
curl -s https://cmwxqd18ga.execute-api.us-east-1.amazonaws.com/health  # payment-service
curl -s https://bu4wvejwzl.execute-api.us-east-1.amazonaws.com/health  # notification-service
curl -s https://yvkc0irtqj.execute-api.us-east-1.amazonaws.com/health  # uploader-service
```

### CDK Infrastructure

The CDK stack `RealEstateStack-staging` creates:

- VPC with public subnets (no NAT Gateway for staging, saving ~$32-45/month)
- Aurora MySQL Serverless v2 (publicly accessible for staging)
- SNS topics and SQS queues for event-driven architecture
- DynamoDB table for RBAC policies
- S3 bucket for uploads (configured with DESTROY policy for dev)
- Secrets Manager for database credentials

### Critical Deployment Learnings (February 2026)

1. **NAT Gateway Cost Optimization**: For staging, set `natGateways: 0` in CDK and remove VPC config from Lambda services. RDS is publicly accessible, so Lambdas don't need VPC access.

2. **Conditional VPC Config**: Services use `vpc: ${self:custom.vpcConfig.${self:provider.stage}, null}` to only add VPC in production.

3. **SSM Parameter Defaults**: VPC-related SSM references in serverless.yml need default values to prevent resolution failures: `${ssm:/qshelter/prod/private-subnet-1-id, 'subnet-placeholder'}`.

4. **InfrastructureConfig Changes**: Made `privateSubnetIds` and `lambdaSecurityGroupId` optional in common package (v2.0.159) for non-VPC stages.

5. **Force Redeploy After Common Package Update**: Use `npm run build && npx serverless deploy --stage staging --force` to ensure Lambda picks up new package version.

---

## Recent Changes

### Full Redeployment (February 14, 2026)

- ✅ Infrastructure: 109 resources deployed (RealEstateStack-staging)
- ✅ Aurora Serverless v2 with scale-to-zero (minCapacity: 0, maxCapacity: 2)
- ✅ Database: 12 Prisma migrations applied
- ✅ All 9 services deployed (authorizer + 8 application services)
- ✅ DynamoDB seeded with 6 role policies
- ✅ All health endpoints verified (HTTP 200)
- ✅ Deploy script fixed: `head` command replaced with `sed -n '1p'` (Perl conflict on macOS)
- ✅ Deploy script fixed: CDK cleanup no longer deletes managed resources when CDKToolkit is healthy
- ✅ Postman environment updated with new URLs
- ✅ Demo frontend `.env` updated with new URLs

### NAT Gateway Removal for Staging (February 3, 2026)

- ✅ CDK: Set `natGateways: stage === 'prod' ? 1 : 0`
- ✅ CDK: Made private subnet SSM parameters conditional (prod only)
- ✅ All 7 VPC services updated with conditional VPC config
- ✅ Common package v2.0.159: Made privateSubnetIds/lambdaSecurityGroupId optional
- ✅ All services redeployed and healthy
- ✅ Postman environment updated with new URLs
- ✅ Saves ~$32-45/month in NAT Gateway costs
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

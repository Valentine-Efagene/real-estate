# Deployment Status

Last Updated: January 11, 2026

## Recent Changes

### RBAC Redesign (January 11, 2026)

- ✅ Implemented federated users with tenant-scoped roles
- ✅ Migrated to path-based permissions (`path` + `methods[]` + `effect`)
- ✅ Added TenantMembership model for many-to-many User ↔ Tenant relationship
- ✅ Updated DynamoDB policy format to version "2" with path-based statements
- ✅ New tenant membership API endpoints for federated user management
- See [docs/RBAC_REDESIGN.md](docs/RBAC_REDESIGN.md) for full details

## Lambda Functions

| Service               | Package Size | Status     | Health Check  | Swagger Docs    |
| --------------------- | ------------ | ---------- | ------------- | --------------- |
| Authorizer            | 102 KB       | ✅ Working | N/A           | N/A             |
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

| Service          | Tests | Status     | Notes                                     |
| ---------------- | ----- | ---------- | ----------------------------------------- |
| User Service     | 78    | ✅ Passing | Auth, Users, Roles, Tenants, Socials      |
| Property Service | 21    | ✅ Passing | Properties, Health                        |
| Mortgage Service | 83    | ✅ Passing | Contracts, Payments, Templates, Workflows |

## Deployment Notes

- All services use `package.individually: true` with exclude-first patterns for minimal package sizes
- ESBuild outputs `.mjs` files for ESM Lambda compatibility
- Lambda containers use `LOCALSTACK_ENDPOINT=http://host.docker.internal:4566` to reach LocalStack
- Prisma runtime dependencies are explicitly included in package patterns
- LocalStack uses REST API v1 (`http` events) - HTTP API v2 is not supported in Community Edition

# Deployment Status

Last Updated: January 6, 2025

## Lambda Functions

| Service               | Package Size | Status     | Health Check  | Swagger Docs    |
| --------------------- | ------------ | ---------- | ------------- | --------------- |
| Authorizer            | 102 KB       | ✅ Working | N/A           | N/A             |
| User Service          | 5.8 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |
| Property Service      | 6.1 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |
| Mortgage Service      | 6.2 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |
| Documents Service     | 6.4 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |
| Notifications Service | 7.3 MB       | ✅ Healthy | `GET /health` | `GET /api-docs` |

## LocalStack Deployment (test stage)

All services have `serverless.localstack.yml` configs that use **REST API v1** for LocalStack compatibility.

### Deploy Command

```bash
# Deploy a service to LocalStack using REST API v1
cd services/<service-name>
pnpm exec serverless deploy --config serverless.localstack.yml --stage test
```

### Current LocalStack API IDs

| Service               | API ID       | REST API Base URL                                                    |
| --------------------- | ------------ | -------------------------------------------------------------------- |
| User Service          | `tkexzzvh2t` | `http://tkexzzvh2t.execute-api.localhost.localstack.cloud:4566/test` |
| Property Service      | `rctqapw3rb` | `http://rctqapw3rb.execute-api.localhost.localstack.cloud:4566/test` |
| Mortgage Service      | `vf7kbi2plw` | `http://vf7kbi2plw.execute-api.localhost.localstack.cloud:4566/test` |
| Documents Service     | `la2ji49vbp` | `http://la2ji49vbp.execute-api.localhost.localstack.cloud:4566/test` |
| Notifications Service | `q0cty9xmsv` | `http://q0cty9xmsv.execute-api.localhost.localstack.cloud:4566/test` |

### Health Check URLs

| Service               | Health URL                                                                | Status     |
| --------------------- | ------------------------------------------------------------------------- | ---------- |
| User Service          | http://tkexzzvh2t.execute-api.localhost.localstack.cloud:4566/test/health | ✅ Healthy |
| Property Service      | http://rctqapw3rb.execute-api.localhost.localstack.cloud:4566/test/health | ✅ Healthy |
| Mortgage Service      | http://vf7kbi2plw.execute-api.localhost.localstack.cloud:4566/test/health | ✅ Healthy |
| Documents Service     | http://la2ji49vbp.execute-api.localhost.localstack.cloud:4566/test/health | ✅ Healthy |
| Notifications Service | http://q0cty9xmsv.execute-api.localhost.localstack.cloud:4566/test/health | ✅ Healthy |

> **Note**: API IDs change on each deployment. Get current IDs with:
>
> ```bash
> aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis --query 'items[*].[name,id]' --output table
> ```

## Environment

- **Stage**: test (LocalStack)
- **Region**: us-east-1
- **LocalStack Endpoint**: http://localhost:4566

## Quick Health Check Commands

```bash
# Test all services via REST API
curl -s http://tkexzzvh2t.execute-api.localhost.localstack.cloud:4566/test/health  # user-service
curl -s http://rctqapw3rb.execute-api.localhost.localstack.cloud:4566/test/health  # property-service
curl -s http://vf7kbi2plw.execute-api.localhost.localstack.cloud:4566/test/health  # mortgage-service
curl -s http://la2ji49vbp.execute-api.localhost.localstack.cloud:4566/test/health  # documents-service
curl -s http://q0cty9xmsv.execute-api.localhost.localstack.cloud:4566/test/health  # notifications

# List all deployed REST APIs
aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis --query 'items[*].[name,id]' --output table

# List all deployed Lambda functions
aws --endpoint-url=http://localhost:4566 lambda list-functions --query 'Functions[].FunctionName' --output table
```

## Deployment Notes

- All services use `package.individually: true` with exclude-first patterns for minimal package sizes
- ESBuild outputs `.mjs` files for ESM Lambda compatibility
- Lambda containers use `LOCALSTACK_ENDPOINT=http://host.docker.internal:4566` to reach LocalStack
- Prisma runtime dependencies are explicitly included in package patterns
- LocalStack uses REST API v1 (`http` events) - HTTP API v2 is not supported in Community Edition

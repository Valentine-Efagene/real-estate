# API Documentation URLs

This document lists all the Swagger/OpenAPI documentation endpoints for each service in the QShelter platform.

## LocalStack Development (Lambda)

Services are deployed to LocalStack and accessed via API Gateway. The URL format is:

```
http://localhost:4566/restapis/<rest-api-id>/test/_user_request_/<path>
```

After deploying with `npx sls deploy --config serverless.localstack.yml --stage test`, check the serverless output for your API IDs.

### Getting Your API Gateway URLs

```bash
# List all REST APIs in LocalStack
aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis --query 'items[*].[name,id]' --output table
```

Example output and URLs:

| Service                   | Service Name                | Example API Docs URL                                                   |
| ------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| **Mortgage Service**      | `qshelter-mortgage-service` | `http://localhost:4566/restapis/<api-id>/test/_user_request_/api-docs` |
| **Notifications Service** | `qshelter-notifications`    | `http://localhost:4566/restapis/<api-id>/test/_user_request_/api-docs` |
| **User Service**          | `qshelter-user-service`     | `http://localhost:4566/restapis/<api-id>/test/_user_request_/api-docs` |
| **Property Service**      | `qshelter-property-service` | `http://localhost:4566/restapis/<api-id>/test/_user_request_/api-docs` |

### Quick Reference Script

Create a helper to list all deployed API endpoints:

```bash
# Get all LocalStack API Gateway endpoints
aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis \
  --query 'items[*].[name,id]' --output text | \
  while read name id; do
    echo "$name: http://localhost:4566/restapis/$id/test/_user_request_/api-docs"
  done
```

## Direct Local Runs (Optional)

Our primary local workflow uses LocalStack and API Gateway. Running services directly on local ports (e.g. `localhost:3002`) is optional and not used by the standard e2e pipelines.

If you explicitly want to run a service outside of LocalStack for quick iteration, see the service's `local.ts` file and run the service with `pnpm dev` from the service directory. This is intended for development convenience only—production-like testing and integration should go through LocalStack.

```bash
# Example (optional):
cd services/<service-name>
pnpm dev
```

## Deploying to LocalStack

```bash
# 1. Start LocalStack and dependencies
pnpm local:start

# 2. Deploy infrastructure (CDK)
cd infrastructure && pnpm localstack:deploy

# 3. Deploy a service
cd services/mortgage-service
npx sls deploy --config serverless.localstack.yml --stage test

# 4. Note the API endpoint from serverless output
# endpoints:
#   ANY - http://localhost:4566/restapis/abc123xyz/test/_user_request_/{proxy+}
```

## LocalStack setup progression (what we did)

This project uses LocalStack as the canonical local execution environment. Below are the exact steps we follow (and which were performed during troubleshooting) so you can reproduce the same environment and locate the Notifications API docs.

1. Start LocalStack and dependencies (MySQL, Redis):

```bash
cd local-dev
docker compose up -d mysql redis localstack
# wait for LocalStack to be ready
curl http://localhost:4566/_localstack/health | jq .
```

2. Bootstrap CDK resources into LocalStack (creates `/cdk-bootstrap/...` SSM parameters):

```bash
cd infrastructure
pnpm localstack:bootstrap
# verify the bootstrap SSM parameter exists
aws --endpoint-url=http://localhost:4566 ssm get-parameter --name /cdk-bootstrap/hnb659fds/version
```

3. Deploy the infra stack into LocalStack (creates S3 buckets, SSM params, secrets, DynamoDB, etc.):

```bash
pnpm localstack:deploy
```

4. Deploy the Notifications service (Serverless using REST API v1 for LocalStack):

```bash
cd ../services/notifications
npx sls deploy --config serverless.localstack.yml --stage test
# or inspect after deploy
npx sls info --config serverless.localstack.yml --stage test
```

5. Get the REST API id and open the docs (replace `<api-id>`):

```bash
aws --endpoint-url=http://localhost:4566 apigateway get-rest-apis --query "items[*].[name,id]" --output table

# Swagger UI
open "http://localhost:4566/restapis/<api-id>/test/_user_request_/api-docs/"

# OpenAPI JSON
curl "http://localhost:4566/restapis/<api-id>/test/_user_request_/openapi.json" | jq .
```

Notes:

- If you get an empty result from `apigateway get-rest-apis`, the service either hasn't been deployed or was deployed as an HTTP API (apigatewayv2) which may not be emulated depending on your LocalStack edition. Use `serverless.localstack.yml` which targets REST API v1 for LocalStack compatibility.
- If the Serverless deploy fails with a missing `/cdk-bootstrap/...` SSM parameter, run the bootstrap step above; LocalStack state can be ephemeral.

## Staging Environment

Replace `<stage>` with the appropriate stage name (e.g., `dev`, `staging`).

| Service                   | API Docs URL                                                               |
| ------------------------- | -------------------------------------------------------------------------- |
| **User Service**          | https://`<api-id>`.execute-api.`<region>`.amazonaws.com/`<stage>`/api-docs |
| **Property Service**      | https://`<api-id>`.execute-api.`<region>`.amazonaws.com/`<stage>`/api-docs |
| **Mortgage Service**      | https://`<api-id>`.execute-api.`<region>`.amazonaws.com/`<stage>`/api-docs |
| **Notifications Service** | https://`<api-id>`.execute-api.`<region>`.amazonaws.com/`<stage>`/api-docs |

> **Note**: The API Gateway base URLs are unique per deployment. Check the serverless output or AWS Console for the actual URLs.

## Production Environment

Production API docs may be restricted. Check with your team lead for access.

## Swagger Authentication (Notifications Service)

The notifications service Swagger UI is protected with basic authentication in deployed environments:

- **Username**: `qshelter`
- **Password**: (see `SWAGGER_PASSWORD` in serverless.yml or SSM parameters)

## Health Check Endpoints

### LocalStack (Lambda)

```bash
# Replace <api-id> with your actual API ID
curl http://localhost:4566/restapis/<api-id>/test/_user_request_/health
```

> Note: Direct service ports (running services on local ports) are optional and intentionally omitted here — our canonical local workflow uses LocalStack and API Gateway. If you need to run a service directly for troubleshooting, see the service's `local.ts` and run `pnpm dev` in that service folder.

## Service Responsibilities

| Service                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| **User Service**          | Authentication, user management, profiles, roles    |
| **Property Service**      | Property listings, search, media management         |
| **Mortgage Service**      | Mortgage contracts, payment plans, prequalification |
| **Notifications Service** | Email, SMS, push notifications, Slack webhooks      |
| **Authorizer Service**    | Lambda authorizer for API Gateway (no Swagger UI)   |

## Troubleshooting

### Swagger UI not loading in Lambda/API Gateway

The services use CDN-hosted Swagger UI with inline OpenAPI specs. See [services/notifications/SWAGGER_SETUP.md](services/notifications/SWAGGER_SETUP.md) for the implementation pattern.

### OpenAPI JSON endpoint

If Swagger UI doesn't load, you can fetch the raw OpenAPI spec via LocalStack (preferred):

```bash
# LocalStack
curl http://localhost:4566/restapis/<api-id>/test/_user_request_/openapi.json | jq .
```

### Common Issues

1. **Port already in use**: Check if another service is running on the same port
2. **Database connection failed**: Ensure MySQL is running (`docker compose up -d mysql`)
3. **CORS errors**: Check that you're accessing from the correct origin

# Permissions CRUD API

A lightweight CRUD API for permission policies stored in DynamoDB.

## Stack

- Express
- Zod validation
- Swagger / OpenAPI docs
- TypeScript
- esbuild
- Serverless Framework
- DynamoDB

## Endpoints

- GET /health
- GET /openapi.json
- GET /api-docs
- GET /permissions
- POST /permissions
- GET /permissions/:roleName
- PUT /permissions/:roleName
- PATCH /permissions/:roleName
- DELETE /permissions/:roleName

## Sample payload

```json
{
  "roleName": "admin",
  "isActive": true,
  "policy": {
    "version": "1.0",
    "statements": [
      {
        "effect": "Allow",
        "resources": [
          {
            "path": "/hello",
            "methods": ["GET"]
          },
          {
            "path": "/users/:id",
            "methods": ["GET", "PUT"]
          }
        ]
      },
      {
        "effect": "Deny",
        "resources": [
          {
            "path": "/admin/*",
            "methods": ["DELETE"]
          }
        ]
      }
    ]
  }
}
```

## Run locally

1. Install dependencies:
   npm install
2. Start the API:
   npm run start:dev
3. Build for serverless:
   npm run build
4. Deploy:
   npm run deploy

## DynamoDB table

The table is created by the Serverless stack as:

- authorizer-api-dynamo-dev-permissions

Set these environment variables if you want to point to a local or custom DynamoDB endpoint:

- PERMISSIONS_TABLE
- DYNAMODB_ENDPOINT
- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

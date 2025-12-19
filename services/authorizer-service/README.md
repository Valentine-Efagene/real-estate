# Lambda Authorizer Service

Lambda authorizer for Real Estate API with DynamoDB-backed role-based access control.

## Features

- **JWT Token Validation**: Verifies JWT tokens and extracts user roles
- **Path Matching**: Supports dynamic path parameters (e.g., `/users/:id`)
- **DynamoDB Integration**: Fast policy lookups from DynamoDB
- **IAM Policy Generation**: Returns API Gateway-compatible IAM policies
- **Multi-tenant Support**: Optional tenant-based policy isolation
- **Response Caching**: API Gateway caches authorizer responses (5 min TTL)

## Architecture

```
API Gateway Request → Lambda Authorizer → DynamoDB (role-policies)
                ↓
         IAM Policy (Allow/Deny)
                ↓
         Service Lambda
```

## Policy Model

Policies are stored in DynamoDB with the following structure:

```json
{
  "PK": "ROLE#admin",
  "SK": "POLICY",
  "roleName": "admin",
  "policy": {
    "version": "1",
    "statements": [
      {
        "effect": "Allow",
        "resources": [
          {
            "path": "/users",
            "methods": ["GET", "POST"]
          },
          {
            "path": "/users/:id",
            "methods": ["GET", "PATCH", "DELETE"]
          }
        ]
      }
    ]
  },
  "isActive": true,
  "tenantId": "tenant-123",
  "GSI1PK": "TENANT#tenant-123",
  "GSI1SK": "ROLE#admin",
  "updatedAt": "2025-12-19T..."
}
```

## Environment Variables

- `ROLE_POLICIES_TABLE_NAME`: DynamoDB table name (default: `role-policies`)
- `JWT_SECRET`: Secret key for JWT verification
- `AWS_REGION_NAME`: AWS region

## JWT Token Format

The authorizer expects JWT tokens with the following payload:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "roles": ["admin", "user"],
  "tenantId": "tenant-123",
  "iat": 1234567890,
  "exp": 1234567890
}
```

## Path Matching

The authorizer supports dynamic path parameters:

- `/users/:id` matches `/users/123`, `/users/abc`, etc.
- `/properties/:propertyId/units/:unitId` matches `/properties/1/units/2`
- Exact matches are checked first for performance

## Usage

### Authorization Header

```
Authorization: Bearer <jwt-token>
```

### Context Passed to Service Lambdas

The authorizer adds the following context to the request:

```json
{
  "userId": "user-id",
  "email": "user@example.com",
  "roles": "[\"admin\",\"user\"]",
  "tenantId": "tenant-123"
}
```

Access in your service Lambda:

```typescript
const userId = event.requestContext.authorizer.userId;
const roles = JSON.parse(event.requestContext.authorizer.roles);
```

## Seeding Initial Policies

Run the seed script to populate DynamoDB with initial role policies:

```bash
export AWS_REGION_NAME=us-east-1
export ROLE_POLICIES_TABLE_NAME=role-policies
node scripts/seed-role-policies.mjs
```

Default roles created:

- `admin`: Full access to all resources
- `user`: Read access + own profile management
- `property-manager`: Property and amenity management
- `mortgage-officer`: Mortgage and payment management

## Syncing Policies from User Service

Import `PolicySyncService` in your User Service to sync policy changes:

```typescript
import { PolicySyncService } from "@shared/common/services/policy-sync.service";

// After role creation/update
await this.policySyncService.syncRolePolicy({
  roleName: role.name,
  policy: role.policyDocument,
  isActive: role.isActive,
  tenantId: role.tenantId,
});
```

## Performance

- **Cold Start**: ~800ms (outside VPC)
- **Warm Invocation**: ~50ms
- **Cache Hit**: 0ms (API Gateway caches for 5 minutes)
- **DynamoDB Query**: ~10ms average

## Security Considerations

1. **JWT Secret**: Store in AWS Secrets Manager in production
2. **Token Expiry**: Set reasonable expiration times (e.g., 1 hour)
3. **Cache TTL**: Balance between performance and security (5 minutes default)
4. **Policy Updates**: Changes take effect after cache expiry
5. **Deny by Default**: Any error results in access denial

## Building

```bash
npm install
npm run build
```

## Testing Locally

```typescript
// test-authorizer.ts
import { handler } from "./src/index";

const event = {
  type: "TOKEN",
  authorizationToken: "Bearer <your-jwt-token>",
  methodArn: "arn:aws:execute-api:us-east-1:123456789:api-id/prod/GET/users",
};

handler(event, {} as any).then(console.log);
```

## Deployment

Deployed automatically via CDK stack:

```bash
cd ../..
cdk deploy
```

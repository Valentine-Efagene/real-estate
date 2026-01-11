# Policy Sync Service

Syncs role/permission policies from RDS (MySQL) to DynamoDB for the authorizer service.

## Architecture

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────────┐
│   User Service  │────▶│  SNS Topic  │────▶│   SQS Queue     │
│  (Role CRUD)    │     │             │     │                 │
└─────────────────┘     └─────────────┘     └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │  Policy Sync    │
                                            │   Lambda        │
                                            └────────┬────────┘
                                                     │
                    ┌────────────────────────────────┼────────────────────────────────┐
                    │                                │                                │
                    ▼                                ▼                                ▼
           ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
           │   RDS (MySQL)   │◀─────────────│  Policy Sync    │─────────────▶│    DynamoDB     │
           │  Source of Truth│   Fetch      │    Service      │    Upsert    │  (Cache Layer)  │
           └─────────────────┘              └─────────────────┘              └─────────────────┘
                                                                                      │
                                                                                      ▼
                                                                             ┌─────────────────┐
                                                                             │   Authorizer    │
                                                                             │    Service      │
                                                                             └─────────────────┘
```

## Event Flow

1. Admin creates/updates/deletes a role or permission via the User Service
2. User Service publishes an event to the SNS topic
3. SNS delivers the event to the SQS queue
4. Policy Sync Lambda consumes the message
5. Lambda fetches fresh data from RDS and updates DynamoDB

## Event Types

- `POLICY.ROLE_CREATED` - New role created
- `POLICY.ROLE_UPDATED` - Role name/description updated
- `POLICY.ROLE_DELETED` - Role deleted
- `POLICY.PERMISSION_CREATED` - New permission created
- `POLICY.PERMISSION_UPDATED` - Permission updated
- `POLICY.PERMISSION_DELETED` - Permission deleted
- `POLICY.ROLE_PERMISSION_ASSIGNED` - Permissions assigned to role
- `POLICY.ROLE_PERMISSION_REVOKED` - Permissions revoked from role
- `POLICY.FULL_SYNC_REQUESTED` - Request full sync of all roles

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/sync/full` | Trigger full sync from RDS to DynamoDB |
| POST | `/sync/role/:roleId` | Sync a specific role by ID |
| POST | `/sync/role-by-name/:roleName` | Sync a specific role by name |
| GET | `/policies/:roleName` | Get a role policy from DynamoDB (for debugging) |

## Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.localstack

# Build
npm run build

# Deploy to LocalStack
npm run deploy:localstack

# Or run locally
npm run start
```

## DynamoDB Schema

Each role policy item in DynamoDB:

```json
{
  "PK": "ROLE#admin",
  "SK": "POLICY",
  "roleName": "admin",
  "scopes": ["users:read", "users:write", "properties:read"],
  "isActive": true,
  "tenantId": "optional-tenant-id",
  "GSI1PK": "TENANT#tenant-id",
  "GSI1SK": "ROLE#admin",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Scope Format

Scopes are derived from permissions in the format: `{resource}:{action}`

Examples:
- `users:read` - Read users
- `users:write` - Write users
- `properties:delete` - Delete properties

# RBAC Redesign: Federated Users with Tenant-Scoped Policies

## Implementation Status

✅ **COMPLETED** - January 11, 2026

### What Was Implemented

1. ✅ Prisma schema updated with path-based permissions, tenant-scoped roles, and TenantMembership model
2. ✅ User-service updated with new role, permission, and tenant-membership services
3. ✅ Policy-sync-service updated to handle path-based policy format
4. ✅ Common library updated with new event types and publisher methods
5. ✅ DynamoDB syncing working with tenant-scoped keys: `TENANT#tenantId#ROLE#roleName`
6. ✅ All services deployed and tested on LocalStack

### New API Endpoints

- `POST /permissions` - Create path-based permission (`{path, methods[], effect}`)
- `POST /permissions/crud` - Bulk create CRUD permissions for a resource
- `POST /permissions/bulk` - Bulk create multiple permissions
- `GET /roles?tenantId=xxx` - List roles (global + tenant-specific)
- `POST /roles` - Create role with optional `tenantId` for tenant scoping
- `PUT /roles/:id/permissions` - Assign permissions to role
- `POST /tenants/:tenantId/members` - Add user to tenant with role
- `GET /tenants/:tenantId/members` - List tenant members
- `PUT /tenants/:tenantId/members/:userId` - Update member's role
- `DELETE /tenants/:tenantId/members/:userId` - Remove member from tenant
- `GET /users/:userId/tenants` - List user's tenant memberships
- `GET /users/:userId/default-tenant` - Get user's default tenant with full permissions
- `PUT /users/:userId/default-tenant/:tenantId` - Set user's default tenant

---

## Original Design Document

### Current State

The current system has:

1. Simple `resource:action` scopes (e.g., `users:read`, `properties:write`)
2. Single-tenant user model (`User.tenantId` is optional but 1:1)
3. Global roles (not tenant-specific)
4. Permissions stored as `resource + action` pairs

## Requirements

1. **Path + HTTP Method Authorization**: Policies should specify exact paths (`/users/:id`) and HTTP methods (`GET`, `POST`, etc.)
2. **Tenant-Scoped Access Control**: Authorization is per-tenant, not global
3. **Federated Users**: A user can belong to multiple tenants with different roles in each
4. **Role Flexibility**: A user could be "mortgage-admin" in Tenant A but "customer" in Tenant B

## Proposed Data Model

### 1. Core Entities

```prisma
// User is NOT tenant-scoped - federated across tenants
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String?
  firstName String?
  lastName  String?
  phone     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Federation: User belongs to multiple tenants
  tenantMemberships TenantMembership[]
}

// Many-to-many: User <-> Tenant with role assignment
model TenantMembership {
  id        String   @id @default(cuid())
  userId    String
  tenantId  String
  roleId    String
  isActive  Boolean  @default(true)
  isDefault Boolean  @default(false) // User's default tenant
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Restrict)

  @@unique([userId, tenantId])
  @@index([tenantId])
  @@index([userId])
}

// Roles can be global templates or tenant-specific
model Role {
  id          String   @id @default(cuid())
  name        String
  description String?
  tenantId    String?  // NULL = global template, set = tenant-specific
  isSystem    Boolean  @default(false) // System roles can't be deleted
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant?            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  permissions RolePermission[]
  memberships TenantMembership[]

  @@unique([name, tenantId]) // Unique name per tenant (null = global)
  @@index([tenantId])
}

// Permission defines a path + methods + effect
model Permission {
  id          String   @id @default(cuid())
  name        String   // Descriptive name: "Read Users", "Manage Properties"
  description String?
  path        String   // Path pattern: /users, /users/:id, /properties/*
  methods     Json     // ["GET"], ["GET", "POST"], ["*"]
  effect      Effect   @default(ALLOW)
  tenantId    String?  // NULL = global template
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant Tenant?          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  roles  RolePermission[]

  @@unique([path, tenantId]) // Unique path per tenant
  @@index([tenantId])
}

enum Effect {
  ALLOW
  DENY
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@id([roleId, permissionId])
}
```

### 2. DynamoDB Policy Structure (for Authorizer)

The policy synced to DynamoDB should support path-based authorization:

```typescript
interface RolePolicyItem {
  PK: string; // TENANT#tenantId#ROLE#roleName
  SK: string; // POLICY
  tenantId: string;
  roleName: string;
  policy: {
    version: string; // "2"
    statements: PolicyStatement[];
  };
  isActive: boolean;
  updatedAt: string;
}

interface PolicyStatement {
  effect: "Allow" | "Deny";
  resources: PolicyResource[];
}

interface PolicyResource {
  path: string; // /users, /users/:id, /properties/*
  methods: string[]; // ['GET', 'POST'], ['*']
}
```

### 3. JWT Token Structure

```typescript
interface JwtPayload {
  sub: string; // userId
  email: string;
  tenantId: string; // Current tenant context
  roles: string[]; // Role names for current tenant
  principalType: "user" | "apiKey";
  iat: number;
  exp: number;
}
```

### 4. Authorization Flow

```
1. User logs in → selects tenant (or uses default)
2. JWT issued with: { sub, tenantId, roles: [roles for that tenant] }
3. Request arrives at API Gateway
4. Authorizer:
   a. Validates JWT
   b. Extracts tenantId + roles
   c. Looks up TENANT#tenantId#ROLE#roleName in DynamoDB
   d. Matches request path/method against policy statements
   e. Returns Allow/Deny with context
5. Downstream service receives:
   - x-user-id
   - x-tenant-id
   - x-roles (JSON)
   - x-scopes (resolved from policies)
```

## API Changes

### User Service

```
POST   /tenants/:tenantId/members          # Add user to tenant with role
GET    /tenants/:tenantId/members          # List tenant members
PUT    /tenants/:tenantId/members/:userId  # Update user's role in tenant
DELETE /tenants/:tenantId/members/:userId  # Remove user from tenant

GET    /users/:id/tenants                  # List tenants user belongs to
POST   /users/:id/tenants/:tenantId        # Add user to tenant
DELETE /users/:id/tenants/:tenantId        # Remove user from tenant
```

### Auth Service Changes

```
POST /auth/login
Request:
{
  "email": "user@example.com",
  "password": "...",
  "tenantId": "optional-specific-tenant"  // If not provided, uses default
}

Response:
{
  "token": "jwt...",
  "user": { ... },
  "tenant": { id, name },
  "availableTenants": [{ id, name, role }]  // All tenants user has access to
}

POST /auth/switch-tenant
Request:
{
  "tenantId": "new-tenant-id"
}

Response:
{
  "token": "new-jwt-with-new-tenant-context"
}
```

## Migration Strategy

1. **Phase 1**: Update Prisma schema with new models
2. **Phase 2**: Migrate existing data
   - Create TenantMembership records from existing User.tenantId + UserRole
   - Keep backward compatibility
3. **Phase 3**: Update policy-sync-service
   - Change DynamoDB key format to include tenantId
   - Sync full policy structure (not just scopes)
4. **Phase 4**: Update authorizer
   - Look up policies by tenant + role
   - Match path/method against statements
5. **Phase 5**: Update JWT structure
   - Include tenantId in token
   - Add tenant switching endpoints

## DynamoDB Table Changes

### New Key Structure

| PK                     | SK       | Purpose                     |
| ---------------------- | -------- | --------------------------- |
| `TENANT#t1#ROLE#admin` | `POLICY` | Role policy for tenant t1   |
| `TENANT#t1#ROLE#user`  | `POLICY` | Role policy for tenant t1   |
| `GLOBAL#ROLE#admin`    | `POLICY` | Global template (no tenant) |

### GSI for Tenant Queries

- **GSI1PK**: `TENANT#tenantId`
- **GSI1SK**: `ROLE#roleName`

This allows querying all roles for a tenant.

## Benefits

1. **True Multi-Tenancy**: Users are federated, not duplicated per tenant
2. **Flexible Roles**: Same user can have different roles per tenant
3. **Path-Based Auth**: Supports exact path + method authorization
4. **Scalable**: DynamoDB handles high-throughput auth lookups
5. **Backward Compatible**: Can support both scope-based and path-based auth during migration

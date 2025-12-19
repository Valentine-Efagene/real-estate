# Multitenancy Implementation

This application now supports multitenancy, allowing you to serve multiple tenants (organizations) from a single application instance with complete data isolation.

## Architecture

### Tenant Identification Strategies

The application supports multiple strategies for identifying tenants:

1. **Subdomain-based**: Extract tenant from subdomain (e.g., `acme.yourdomain.com`)
2. **Custom domain**: Support custom domains per tenant (e.g., `realestate.acme.com`)
3. **HTTP Header**: `X-Tenant-ID` header with tenant ID
4. **HTTP Header**: `X-Tenant-Subdomain` header with subdomain

### Data Isolation

All tenant-aware entities extend `TenantAwareBaseEntity` or `AbstractTenantAwareEntity` which includes:

- `tenantId` column (indexed)
- Foreign key relationship to `Tenant` entity
- Automatic cascade delete when tenant is removed

### Tenant-Aware Entities

The following base entities support multitenancy:

- `TenantAwareBaseEntity` - Basic entities (User, etc.)
- `AbstractTenantAwareEntity` - Abstract base
- `AbstractBaseReviewableEntity` - For entities with review workflow

All entities extending these classes will have automatic tenant isolation.

## Usage

### Creating a Tenant

```typescript
POST /tenants
{
  "name": "Acme Corp",
  "subdomain": "acme",
  "domain": "realestate.acme.com", // optional
  "plan": "premium",
  "contactEmail": "admin@acme.com"
}
```

### Accessing Tenant Context

In your controllers, use the `@CurrentTenant()` decorator:

```typescript
import { CurrentTenant, CurrentTenantId } from '../common/decorator/tenant.decorator';

@Get('profile')
getProfile(
  @CurrentTenant() tenant: Tenant,
  @CurrentTenantId() tenantId: number
) {
  // tenant and tenantId are automatically injected
}
```

### Protecting Routes

Use the `TenantGuard` to ensure a route requires tenant context:

```typescript
import { UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/guard/tenant.guard';

@UseGuards(TenantGuard)
@Get('sensitive-data')
getSensitiveData() {
  // This route requires valid tenant context
}
```

### Querying with Tenant Scope

The middleware automatically adds `tenantId` to the request. In services, filter by tenant:

```typescript
@Injectable()
export class UserService {
  async findAll(@CurrentTenantId() tenantId: number) {
    return this.userRepo.find({
      where: { tenantId },
    });
  }
}
```

## Tenant Status

Tenants can have the following statuses:

- `ACTIVE` - Tenant is active and can access the system
- `SUSPENDED` - Tenant is temporarily suspended
- `PENDING` - Tenant setup is pending
- `TRIAL` - Tenant is on trial period
- `CANCELLED` - Tenant subscription is cancelled

Suspended or inactive tenants will receive a 403 Forbidden response.

## Tenant Plans

- `FREE` - Free tier
- `BASIC` - Basic features
- `PREMIUM` - Premium features
- `ENTERPRISE` - Full enterprise features

## Configuration

Each tenant can have custom configuration:

```typescript
{
  "config": {
    "maxUsers": 100,
    "maxProperties": 500,
    "features": ["advanced-search", "analytics"],
    "customBranding": {
      "logo": "https://...",
      "primaryColor": "#ff0000",
      "secondaryColor": "#00ff00"
    }
  }
}
```

## Testing

### With Subdomain

```bash
# Add to /etc/hosts:
127.0.0.1 acme.localhost
127.0.0.1 demo.localhost

# Test with subdomain
curl http://acme.localhost:3000/api/users
```

### With Headers

```bash
# Test with tenant ID header
curl -H "X-Tenant-ID: 1" http://localhost:3000/api/users

# Test with subdomain header
curl -H "X-Tenant-Subdomain: acme" http://localhost:3000/api/users
```

## Database Strategy

Currently using **shared database** strategy where all tenants share the same database with `tenantId` for isolation.

Future support for **isolated database** strategy is planned where each tenant can have their own database.

## Security Considerations

1. **Data Isolation**: All queries must filter by `tenantId`
2. **Tenant Validation**: Middleware validates tenant status before processing requests
3. **Cascade Delete**: Deleting a tenant cascades to all related data
4. **Index Performance**: `tenantId` columns are indexed for performance

## Migration Guide

When adding new entities:

1. Extend `TenantAwareBaseEntity` or `AbstractTenantAwareEntity`
2. Queries will automatically have access to `tenantId`
3. Use `@CurrentTenantId()` decorator in service methods
4. Add `@UseGuards(TenantGuard)` to routes that require tenant context

## API Endpoints

### Tenant Management

- `GET /tenants` - List all tenants
- `GET /tenants/:id` - Get tenant by ID
- `GET /tenants/subdomain/:subdomain` - Get tenant by subdomain
- `POST /tenants` - Create new tenant
- `PATCH /tenants/:id` - Update tenant
- `PATCH /tenants/:id/suspend` - Suspend tenant
- `PATCH /tenants/:id/activate` - Activate tenant
- `DELETE /tenants/:id` - Delete tenant (soft delete)

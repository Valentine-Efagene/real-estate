# User Service V2 - Express + Prisma + Jest

Lightweight user authentication service optimized for AWS Lambda.

## Tech Stack

- **Express.js** - Fast, minimalist web framework
- **Prisma** - Modern ORM with type safety
- **Jest** - Testing framework (unit + e2e)
- **Zod** - Runtime validation (from @valentine-efagene/qshelter-common)
- **esbuild** - Ultra-fast bundler
- **AWS Lambda** - Serverless deployment
- **Google OAuth2** - Social authentication with redirect and token flows

## Features

- ✅ Email/password authentication
- ✅ Google OAuth2 (redirect flow + token flow)
- ✅ JWT access & refresh tokens
- ✅ Email verification
- ✅ Password reset
- ✅ Role-based access control (via shared common library)
- ✅ Multi-tenant support

See [GOOGLE_OAUTH.md](./GOOGLE_OAUTH.md) for OAuth2 flow documentation.

## Estimated Bundle Size

~5-10MB (vs ~93MB in NestJS v1)

## Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client (IMPORTANT: Run this first!)
cd ../../shared/common
pnpm prisma:generate
cd ../../services/user-service-v2

# Run migrations (if needed)
pnpm prisma:migrate

# Start local dev server
pnpm dev

# Run tests
pnpm test

# Run e2e tests
pnpm test:e2e
```

## Deployment

```bash
# Build for Lambda
pnpm build

# Deploy to dev
pnpm deploy:dev

# Deploy to staging
pnpm deploy:staging

# Deploy to production
pnpm deploy:prod
```

## Project Structure

```
src/
├── app.ts                  # Express app setup
├── lambda.ts               # Lambda handler
├── local.ts                # Local dev server
├── lib/
│   ├── config.ts           # AWS config loader
│   └── prisma.ts           # Prisma client instance
├── middleware/
│   ├── error-handler.ts
│   └── request-logger.ts
├── routes/
│   ├── auth.ts             # Authentication routes
│   ├── users.ts            # User management routes
│   ├── roles.ts            # Role management routes
│   ├── permissions.ts      # Permission management routes
│   ├── tenants.ts          # Tenant management routes
│   └── socials.ts          # Social profile routes
├── services/
│   ├── auth.service.ts     # Auth business logic
│   ├── user.service.ts     # User management logic
│   ├── role.service.ts     # Role management logic
│   ├── permission.service.ts   # Permission logic
│   ├── tenant.service.ts   # Tenant logic
│   └── social.service.ts   # Social profile logic
└── validators/
    ├── auth.validator.ts
    └── user.validator.ts
```

## Features Migrated from V1

### ✅ Authentication

- Email/password signup and login
- Google OAuth integration
- JWT-based authentication (access + refresh tokens)
- Email verification
- Password reset flow
- Token refresh mechanism

### ✅ User Management

- CRUD operations for users
- Paginated user listing with filtering
- User suspension and reinstatement
- Avatar management via S3 presigned URLs
- Profile updates
- Role assignment

### ✅ RBAC (Role-Based Access Control)

- Role management (create, read, update, delete)
- User-role assignment
- Permission checking handled by Lambda authorizer

### ✅ Multi-tenancy

- Tenant management
- Subdomain-based tenant lookup
- Tenant customization (logo, colors)

### ✅ Social Profiles

- Link social media profiles to users
- Support for multiple platforms per user

## API Endpoints

### Auth Routes (Public)

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/verify-email?token=` - Verify email address
- `POST /api/auth/request-password-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/google-token-login` - Login with Google token

### Auth Routes (Protected)

- `GET /api/auth/me` - Get current user profile

### User Routes (Protected)

- `GET /api/users` - List users (paginated, filterable)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PUT /api/users/:id/avatar` - Update user avatar
- `PATCH /api/users/profile` - Update own profile
- `POST /api/users/:id/suspend` - Suspend user
- `POST /api/users/:id/reinstate` - Reinstate suspended user
- `PUT /api/users/:id/roles` - Assign roles to user

### Role Routes (Protected)

- `GET /api/roles` - List all roles
- `POST /api/roles` - Create role
- `GET /api/roles/:id` - Get role by ID
- `PUT /api/roles/:id` - Update role
- `DELETE /api/roles/:id` - Delete role
- `PUT /api/roles/:id/permissions` - Assign permissions to role

### Tenant Routes (Protected)

- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create tenant
- `GET /api/tenants/:id` - Get tenant by ID
- `GET /api/tenants/subdomain/:subdomain` - Get tenant by subdomain
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Delete tenant

### Social Routes (Protected)

- `GET /api/socials/user/:userId` - Get user's social profiles
- `POST /api/socials` - Create social profile
- `GET /api/socials/:id` - Get social profile by ID
- `PUT /api/socials/:id` - Update social profile
- `DELETE /api/socials/:id` - Delete social profile

## Environment Variables

See `.env.example` for local development.

For AWS: Configure SSM Parameter Store and Secrets Manager as per infrastructure setup.

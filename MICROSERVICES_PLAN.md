# Microservices Architecture Plan

## Overview

Split the monolithic application into 3 separate NestJS microservices, each with its own serverless handler, but all managed by a single CDK stack for infrastructure.

## Service Breakdown

### 1. User Service (`services/user-service`)

**Responsibilities:**

- Authentication (sign-in, sign-up, JWT, refresh tokens)
- User onboarding and profile management
- Password reset
- Email verification
- Role and permission management
- User suspensions
- Social auth (Google OAuth)

**Entities:**

- User
- Role
- Permission
- RefreshToken
- PasswordResetToken
- UserSuspension
- Tenant (for multitenancy)

**API Routes:**

- `/auth/*`
- `/users/*`
- `/roles/*`
- `/permissions/*`
- `/tenants/*`

---

### 2. Mortgage Service (`services/mortgage-service`)

**Responsibilities:**

- Mortgage application flow (FSM)
- Mortgage document management
- Mortgage steps tracking
- Downpayment plans and installments
- Payment processing
- Mortgage type management
- Appraisal and credit checks
- Notifications for underwriters/borrowers

**Entities:**

- Mortgage
- MortgageDocument
- MortgageStep
- MortgageType
- MortgageDownpaymentPlan
- MortgageDownpaymentInstallment
- MortgageDownpaymentPayment
- Transaction (mortgage-related)
- Wallet (mortgage-related)

**API Routes:**

- `/mortgages/*`
- `/mortgage-types/*`
- `/mortgage-documents/*`
- `/mortgage-steps/*`
- `/mortgage-downpayments/*`
- `/mortgage-payments/*`

---

### 3. Property Service (`services/property-service`)

**Responsibilities:**

- Property CRUD operations
- Property media management
- Property document management
- Property approval workflow
- Amenity management
- QR code generation
- Property search and filtering

**Entities:**

- Property
- PropertyMedia
- PropertyDocument
- Amenity

**API Routes:**

- `/properties/*`
- `/property-media/*`
- `/property-documents/*`
- `/amenities/*`
- `/qr-code/*`

---

## Shared Components

### Database Module

Each service imports the centralized database module from `../shared/database`:

```typescript
import { DatabaseModule, User, Property } from "../shared/database";
```

### Common Module

Shared utilities, guards, decorators, middleware:

- `shared/common/guards/` - AuthGuard, PermissionGuard, TenantGuard
- `shared/common/decorators/` - CurrentUser, CurrentTenant
- `shared/common/middleware/` - TenantMiddleware, AuthenticationMiddleware
- `shared/common/helpers/` - CustomNamingStrategy, BaseEntity
- `shared/common/mail-templates/` - Email templates

### Event Bus Module

Inter-service communication via HTTP/SNS:

- `shared/event-bus/` - EventBusService, FSMEventConfig

---

## Directory Structure

```
real-estate/
├── lib/
│   └── real-estate-stack.ts          # Single CDK stack
├── shared/
│   ├── database/                     # Centralized DB module
│   ├── common/                       # Shared utilities
│   └── event-bus/                    # Inter-service communication
├── services/
│   ├── user-service/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── serverless.ts         # Lambda handler
│   │   │   ├── app.module.ts
│   │   │   ├── auth/
│   │   │   ├── user/
│   │   │   ├── role/
│   │   │   ├── permission/
│   │   │   └── tenant/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mortgage-service/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── serverless.ts         # Lambda handler
│   │   │   ├── app.module.ts
│   │   │   ├── mortgage/
│   │   │   ├── mortgage-fsm/
│   │   │   ├── mortgage-type/
│   │   │   ├── mortgage-downpayment/
│   │   │   ├── payments/
│   │   │   └── wallet/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── property-service/
│       ├── src/
│       │   ├── main.ts
│       │   ├── serverless.ts         # Lambda handler
│       │   ├── app.module.ts
│       │   ├── property/
│       │   ├── property-media/
│       │   ├── property-document/
│       │   ├── amenity/
│       │   └── qr-code/
│       ├── package.json
│       └── tsconfig.json
```

---

## CDK Stack Configuration

The single CDK stack will deploy 3 Lambda functions:

```typescript
// User Service Lambda
const userLambda = new lambda.Function(this, "UserServiceLambda", {
  handler: "serverless.handler",
  code: lambda.Code.fromAsset("services/user-service"),
  // ... config
});

// Mortgage Service Lambda
const mortgageLambda = new lambda.Function(this, "MortgageServiceLambda", {
  handler: "serverless.handler",
  code: lambda.Code.fromAsset("services/mortgage-service"),
  // ... config
});

// Property Service Lambda
const propertyLambda = new lambda.Function(this, "PropertyServiceLambda", {
  handler: "serverless.handler",
  code: lambda.Code.fromAsset("services/property-service"),
  // ... config
});

// API Gateway with path-based routing
const api = new apigateway.RestApi(this, "RealEstateApi");

const authResource = api.root.addResource("auth");
authResource.addProxy({
  defaultIntegration: new apigateway.LambdaIntegration(userLambda),
});

const mortgagesResource = api.root.addResource("mortgages");
mortgagesResource.addProxy({
  defaultIntegration: new apigateway.LambdaIntegration(mortgageLambda),
});

const propertiesResource = api.root.addResource("properties");
propertiesResource.addProxy({
  defaultIntegration: new apigateway.LambdaIntegration(propertyLambda),
});
```

---

## Inter-Service Communication

Services communicate via EventBus (HTTP webhooks initially, SNS later):

```typescript
// Mortgage Service publishes event
await eventBus.publish({
  eventType: MortgageAction.NOTIFY_BORROWER,
  data: { userId, mortgageId, message },
});

// User Service handles notification
@EventHandler(MortgageAction.NOTIFY_BORROWER)
async handleNotification(data) {
  await this.mailService.sendEmail(data.userId, data.message);
}
```

---

## Migration Strategy

### Phase 1: Setup Shared Modules

1. Move `database/` to `shared/database/`
2. Move `common/` to `shared/common/`
3. Move `event-bus/` to `shared/event-bus/`

### Phase 2: Create Service Scaffolds

1. Create `services/user-service/` with basic NestJS structure
2. Create `services/mortgage-service/` with basic NestJS structure
3. Create `services/property-service/` with basic NestJS structure

### Phase 3: Move Modules

1. Move auth, user, role, permission, tenant to user-service
2. Move mortgage, mortgage-fsm, payments, wallet to mortgage-service
3. Move property, property-media, property-document, amenity to property-service

### Phase 4: Update CDK Stack

1. Add 3 Lambda function definitions
2. Configure API Gateway routing
3. Share database credentials and VPC config

### Phase 5: Testing & Deployment

1. Test each service independently
2. Test inter-service communication
3. Deploy all services via `cdk deploy`

---

## Benefits

✅ **Independent Deployment** - Deploy each service separately
✅ **Scalability** - Scale services based on individual load
✅ **Team Ownership** - Different teams can own different services
✅ **Fault Isolation** - Failures in one service don't affect others
✅ **Technology Flexibility** - Can use different tech stacks per service
✅ **Simplified Testing** - Test services in isolation
✅ **Shared Infrastructure** - Single CDK stack manages all resources

---

## Next Steps

1. Confirm the service boundaries and entity assignments
2. Create the shared modules structure
3. Scaffold the three service projects
4. Update CDK stack with 3 Lambda functions
5. Implement inter-service communication patterns

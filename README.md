# Real Estate Platform - Microservices Monorepo

A microservices-based real estate management platform built with NestJS, AWS Lambda, and serverless architecture.

## Project Structure

```
real-estate/
├── infrastructure/             # AWS CDK infrastructure (VPC, RDS, Lambda, API Gateway)
├── services/                   # Microservices
│   ├── authorizer-service/    # Lambda authorizer (JWT + RBAC)
│   ├── user-service/          # User management, auth, roles, permissions
│   ├── mortgage-service/      # Mortgage applications, payments, wallets
│   └── property-service/      # Property listings, media, amenities
└── shared/                     # Shared modules (database, common utilities)
```

## Architecture

### Microservices

- **User Service** (Port 3001): Authentication, users, roles, permissions, tenants
- **Mortgage Service** (Port 3002): Mortgage workflows, payments, FSM
- **Property Service** (Port 3003): Property management, media, amenities
- **Authorizer Service**: Lambda authorizer for API Gateway

### Infrastructure

- **API Gateway**: RESTful API with path-based routing
- **Lambda**: Serverless compute for each service
- **Aurora Serverless v2**: MySQL database (shared)
- **ElastiCache**: Redis/Valkey for caching
- **DynamoDB**: Role-based access control policies
- **VPC**: Multi-AZ private networking

## Quick Start

### Prerequisites

- Node.js 20.x
- AWS CLI configured
- AWS CDK CLI: `npm install -g aws-cdk`

### 1. Install Dependencies

Each module is self-contained:

```bash
# Shared modules
cd shared && npm install && cd ..

# Services
cd services/user-service && npm install && cd ../..
cd services/mortgage-service && npm install && cd ../..
cd services/property-service && npm install && cd ../..
cd services/authorizer-service && npm install && cd ../..

# Infrastructure
cd infrastructure && npm install && cd ..
```

### 2. Configure Environment

```bash
# Export AWS credentials
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-east-1
export JWT_SECRET=your-super-secret-key
```

### 3. Deploy Infrastructure

```bash
cd infrastructure
npm run build
cdk bootstrap  # First time only
cdk deploy
```

### 4. Seed Initial Data

```bash
# Seed role policies for authorizer
export ROLE_POLICIES_TABLE_NAME=role-policies
node scripts/seed-role-policies.mjs
```

## Local Development

### Run Services Locally

```bash
# Terminal 1 - User Service
cd services/user-service
npm run start:dev

# Terminal 2 - Mortgage Service
cd services/mortgage-service
npm run start:dev

# Terminal 3 - Property Service
cd services/property-service
npm run start:dev
```

### Access Locally

- User Service: http://localhost:3001
- Mortgage Service: http://localhost:3002
- Property Service: http://localhost:3003

## Deployment

### Deploy All Services

```bash
cd infrastructure
cdk deploy
```

### Deploy Individual Service

```bash
# Update specific Lambda
cd services/user-service
npm run build

cd ../../infrastructure
cdk deploy --hotswap  # Fast deployment for Lambda code changes
```

## API Routes

All routes go through API Gateway:

### Public Routes

- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Protected Routes (Requires JWT)

**User Service:**

- `/users` - User CRUD
- `/roles` - Role management
- `/permissions` - Permission management
- `/tenants` - Tenant management

**Mortgage Service:**

- `/mortgages` - Mortgage applications
- `/mortgage-types` - Mortgage types
- `/payments` - Payment processing
- `/wallets` - User wallets

**Property Service:**

- `/properties` - Property listings
- `/amenities` - Property amenities
- `/qr-code` - QR code generation

## Authorization

Uses Lambda authorizer with DynamoDB-backed role policies:

```bash
# Example request
curl -X GET https://api.example.com/users \
  -H "Authorization: Bearer <jwt-token>"
```

Token must include:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "roles": ["admin", "user"],
  "tenantId": "tenant-123"
}
```

## Module Documentation

- **Infrastructure**: See [infrastructure/README.md](infrastructure/README.md)
- **Authorizer**: See [services/authorizer-service/README.md](services/authorizer-service/README.md)
- **Deployment Guide**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Microservices Plan**: See [MICROSERVICES_COMPLETE.md](MICROSERVICES_COMPLETE.md)
- **Authorizer Details**: See [AUTHORIZER_COMPLETE.md](AUTHORIZER_COMPLETE.md)

## Technology Stack

- **Backend**: NestJS, TypeScript
- **Database**: MySQL (Aurora Serverless v2), TypeORM
- **Cache**: Redis/Valkey
- **Auth**: JWT, Passport
- **Infrastructure**: AWS CDK, CloudFormation
- **Compute**: AWS Lambda (Node.js 20)
- **API**: API Gateway REST API
- **Storage**: DynamoDB (policies), S3 (media)

## Development Guidelines

### Code Organization

- Each service is independent with its own package.json
- Shared code lives in `/shared` (database, common utilities)
- Infrastructure as code in `/infrastructure`

### Database

- Centralized entities in `shared/database`
- Services import entities via TypeScript paths
- Migrations managed from user-service

### Testing

- E2E tests in each service's `test/` directory
- Unit tests co-located with source files

## Monitoring

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/UserServiceLambda --follow
aws logs tail /aws/lambda/AuthorizerLambda --follow
```

### Metrics

- Lambda invocations, errors, duration
- API Gateway latency, 4xx/5xx errors
- DynamoDB read/write capacity
- RDS connections, CPU usage

## Cost Optimization

- Aurora Serverless v2 auto-scales (0.5-1 ACU)
- Lambda pay-per-invocation
- DynamoDB on-demand pricing
- ElastiCache t4g.micro for dev
- Single NAT Gateway (upgrade to 2 for HA)

Estimated: **~$90/month** for development environment

## Security

- Private subnets for Lambda and databases
- Secrets Manager for credentials
- JWT token authentication
- Role-based access control (RBAC)
- VPC security groups
- Encryption at rest

## Future Enhancements

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] CloudFront CDN
- [ ] Custom domain + ACM certificates
- [ ] Multi-region deployment
- [ ] Service mesh (App Mesh)
- [ ] Observability (X-Ray tracing)
- [ ] WAF rules
- [ ] Automated backups

## Contributing

Each module can be developed independently:

1. Make changes in respective service/module
2. Test locally
3. Build: `npm run build`
4. Deploy: `cd infrastructure && cdk deploy`

## License

MIT

## Support

- Infrastructure issues: Check [infrastructure/README.md](infrastructure/README.md)
- Service issues: Check respective service README
- Deployment: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

# Real Estate Infrastructure

AWS CDK infrastructure module for the Real Estate microservices platform.

## Architecture

This CDK stack deploys:

- **VPC**: Multi-AZ with private/public subnets and NAT gateway
- **RDS Aurora Serverless v2**: MySQL database cluster
- **ElastiCache**: Redis/Valkey cluster for caching
- **DynamoDB**: Role policies table for Lambda authorizer
- **Lambda Functions**:
  - User Service (authentication, users, roles, permissions)
  - Mortgage Service (mortgages, payments, wallets)
  - Property Service (properties, amenities, media)
  - Authorizer (JWT validation and RBAC)
- **API Gateway**: RESTful API with path-based routing and Lambda authorizer

## Prerequisites

- Node.js 20.x
- AWS CLI configured
- AWS CDK CLI: `npm install -g aws-cdk`
- Sufficient AWS permissions to create VPC, RDS, Lambda, API Gateway, DynamoDB

## Installation

```bash
cd infrastructure
npm install
```

## Configuration

### Environment Variables

Create a `.env` file or export:

```bash
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=us-east-1
export JWT_SECRET=your-super-secret-jwt-key
```

### Service Paths

The stack references services from parent directory:

- `../services/user-service`
- `../services/mortgage-service`
- `../services/property-service`
- `../services/authorizer-service`

## Deployment

### Bootstrap (First Time Only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Synthesize CloudFormation

```bash
npm run synth
# or
cdk synth
```

### Deploy

```bash
npm run deploy
# or
cdk deploy
```

### View Differences

```bash
npm run diff
# or
cdk diff
```

## Stack Outputs

After deployment, you'll get:

```
Outputs:
  ApiUrl                    - API Gateway endpoint
  UserServiceLambdaArn      - User service Lambda ARN
  MortgageServiceLambdaArn  - Mortgage service Lambda ARN
  PropertyServiceLambdaArn  - Property service Lambda ARN
  AuthorizerLambdaArn       - Authorizer Lambda ARN
  DatabaseSecretArn         - RDS credentials secret
  ValkeyEndpoint            - Redis/Valkey endpoint
  RolePoliciesTableName     - DynamoDB table name
```

## Resources Created

### Networking

- VPC with 2 Availability Zones
- Public subnets (for NAT)
- Private subnets (for Lambda, RDS, ElastiCache)
- 1 NAT Gateway
- Internet Gateway
- Route tables

### Database

- Aurora Serverless v2 MySQL cluster
- Auto-scaling writer instance
- Credentials stored in Secrets Manager
- Database name: `mediacraftdb`

### Caching

- ElastiCache cluster (Redis/Valkey)
- Instance type: `cache.t4g.micro`
- Single node (can be scaled)

### Authorization

- DynamoDB table: `role-policies`
- Primary key: `PK` (ROLE#roleName) + `SK` (POLICY)
- GSI: Tenant-based queries
- Pay-per-request billing

### Lambda Functions

All functions:

- Runtime: Node.js 20.x
- Memory: 1024 MB (512 MB for authorizer)
- Timeout: 30 seconds (10s for authorizer)
- VPC: Private subnets (except authorizer)
- Log retention: 7 days

### API Gateway

- REST API with custom domain support
- Path-based routing:
  - `/auth/*` → User Service (no auth)
  - `/users/*` → User Service (authorized)
  - `/roles/*` → User Service (authorized)
  - `/permissions/*` → User Service (authorized)
  - `/tenants/*` → User Service (authorized)
  - `/mortgages/*` → Mortgage Service (authorized)
  - `/mortgage-types/*` → Mortgage Service (authorized)
  - `/payments/*` → Mortgage Service (authorized)
  - `/wallets/*` → Mortgage Service (authorized)
  - `/properties/*` → Property Service (authorized)
  - `/amenities/*` → Property Service (authorized)
  - `/qr-code/*` → Property Service (authorized)
- Throttling: 100 req/s rate, 200 burst
- CORS enabled
- Lambda authorizer with 5-minute cache

## Cost Estimate

Approximate monthly costs (us-east-1):

| Resource             | Configuration           | Est. Cost      |
| -------------------- | ----------------------- | -------------- |
| VPC & NAT            | 1 NAT Gateway           | $32            |
| Aurora Serverless v2 | Min 0.5 ACU             | $44            |
| ElastiCache          | t4g.micro               | $12            |
| DynamoDB             | On-demand, 1M reads     | $0.25          |
| Lambda               | 1M invocations, 1GB-sec | $0.20          |
| API Gateway          | 1M requests             | $3.50          |
| **Total**            |                         | **~$92/month** |

_Costs vary based on actual usage, data transfer, and storage._

## Development Workflow

### Local Testing

Services can run locally:

```bash
# User Service
cd ../services/user-service && npm run start:dev

# Mortgage Service
cd ../services/mortgage-service && npm run start:dev

# Property Service
cd ../services/property-service && npm run start:dev
```

### Update Stack

After code changes:

```bash
npm run build    # Compile TypeScript
cdk diff         # Preview changes
cdk deploy       # Apply changes
```

### View Logs

```bash
# Authorizer
aws logs tail /aws/lambda/AuthorizerLambda --follow

# User Service
aws logs tail /aws/lambda/UserServiceLambda --follow
```

## Cleanup

```bash
npm run destroy
# or
cdk destroy
```

⚠️ **Warning**: This will delete all resources including databases.

## Security

- Database credentials in Secrets Manager
- Lambda functions in private subnets
- Security groups restrict access
- JWT tokens for authentication
- API Gateway authorizer for all protected routes
- Encryption at rest for RDS and DynamoDB

## Monitoring

CloudWatch metrics automatically created for:

- Lambda invocations, errors, duration
- API Gateway requests, latency, 4xx/5xx errors
- DynamoDB read/write capacity
- RDS CPU, memory, connections

## Troubleshooting

### Deployment Fails

1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify CDK bootstrap: `cdk bootstrap --show-template`
3. Check service builds: `cd ../services/user-service && npm run build`

### Lambda Timeout

- Increase timeout in stack (currently 30s)
- Check VPC subnet routes
- Verify NAT Gateway is running

### Database Connection Issues

- Verify Lambda is in VPC private subnets
- Check security group rules
- Confirm Secrets Manager access

## Structure

```
infrastructure/
├── bin/
│   └── real-estate-stack.ts    # CDK app entry point
├── lib/
│   └── real-estate-stack.ts    # Stack definition
├── cdk.json                    # CDK configuration
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
└── README.md                   # This file
```

## Migration from Monolith

This infrastructure supports the microservices migration:

1. **Shared Database**: All services share Aurora cluster
2. **Shared Cache**: All services use same Valkey cluster
3. **Independent Deployment**: Each service has own Lambda
4. **Centralized Auth**: Single authorizer for all services

## Future Enhancements

- [ ] Add CloudFront distribution
- [ ] Implement Aurora read replicas
- [ ] Add ElastiCache cluster mode
- [ ] Set up CI/CD pipeline
- [ ] Add WAF rules
- [ ] Implement backup automation
- [ ] Add multi-region support
- [ ] Custom domain mapping

## Support

For issues or questions about the infrastructure:

1. Check CloudWatch logs
2. Review CDK deployment events
3. Verify AWS resource status in console

---

**License**: MIT  
**Maintained by**: Real Estate Platform Team

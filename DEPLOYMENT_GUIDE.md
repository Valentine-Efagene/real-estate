# Installation & Deployment Guide

## Prerequisites

- Node.js 20.x
- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Navigate to project root
cd /Users/valentyne/Documents/code/research/real-estate

# Install root dependencies (CDK)
npm install

# Install shared module dependencies
cd shared
npm install
cd ..

# Install authorizer service dependencies
cd services/authorizer-service
npm install
cd ../..

# Install user service dependencies
cd services/user-service
npm install
cd ../..

# Install mortgage service dependencies
cd services/mortgage-service
npm install
cd ../..

# Install property service dependencies
cd services/property-service
npm install
cd ../..
```

### 2. Set Environment Variables

Create `.env` file in root:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# AWS Configuration
AWS_REGION_NAME=us-east-1
AWS_ACCOUNT_ID=123456789012
```

### 3. Bootstrap CDK (First Time Only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 4. Synthesize CloudFormation Template

```bash
cdk synth
```

### 5. Deploy Infrastructure

```bash
# Deploy all resources (VPC, RDS, DynamoDB, Lambda, API Gateway)
cdk deploy

# Confirm deployment when prompted
```

**Expected Output**:

```
✅  RealEstateStack

Outputs:
RealEstateStack.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod/
RealEstateStack.AuthorizerLambdaArn = arn:aws:lambda:us-east-1:123:function:AuthorizerLambda
RealEstateStack.DatabaseSecretArn = arn:aws:secretsmanager:us-east-1:123:secret:...
RealEstateStack.RolePoliciesTableName = role-policies
RealEstateStack.UserServiceLambdaArn = arn:aws:lambda:us-east-1:123:function:UserServiceLambda
RealEstateStack.MortgageServiceLambdaArn = arn:aws:lambda:us-east-1:123:function:MortgageServiceLambda
RealEstateStack.PropertyServiceLambdaArn = arn:aws:lambda:us-east-1:123:function:PropertyServiceLambda
```

### 6. Seed Role Policies

```bash
# Set environment variables
export AWS_REGION_NAME=us-east-1
export ROLE_POLICIES_TABLE_NAME=role-policies

# Run seed script
node scripts/seed-role-policies.mjs
```

**Expected Output**:

```
Seeding policies to table: role-policies
Region: us-east-1
✓ Seeded 4 policies (batch 1)

✅ Successfully seeded all role policies!

Seeded roles: admin, user, property-manager, mortgage-officer
```

### 7. Run Database Migrations

```bash
# Get database credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id <DatabaseSecretArn from outputs> \
  --query SecretString --output text

# Set environment variables
export DB_HOST=<cluster-endpoint>
export DB_PORT=3306
export DB_NAME=mediacraftdb
export DB_USERNAME=<from secret>
export DB_PASSWORD=<from secret>

# Run migrations from user-service
cd services/user-service
npm run migration:run
```

### 8. Test the API

#### Login (No Authorization Required)

```bash
curl -X POST https://YOUR-API-URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

**Response**:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123",
    "email": "admin@example.com",
    "roles": ["admin"]
  }
}
```

#### Test Protected Endpoint

```bash
curl -X GET https://YOUR-API-URL/users \
  -H "Authorization: Bearer <access_token>"
```

**Success Response (200)**:

```json
[
  {
    "id": "123",
    "email": "admin@example.com",
    "roles": ["admin"]
  }
]
```

**Unauthorized Response (403)**:

```json
{
  "Message": "User is not authorized to access this resource"
}
```

## Local Development

### Run Services Locally

Each service can run locally for development:

```bash
# User Service (port 3001)
cd services/user-service
npm run start:dev

# Mortgage Service (port 3002)
cd services/mortgage-service
npm run start:dev

# Property Service (port 3003)
cd services/property-service
npm run start:dev
```

### Test Authorizer Locally

Create a test script:

```typescript
// test-authorizer.ts
import { handler } from "./services/authorizer-service/src/index";

const event = {
  type: "TOKEN",
  authorizationToken: "Bearer YOUR-JWT-TOKEN",
  methodArn: "arn:aws:execute-api:us-east-1:123:api/prod/GET/users",
};

handler(event, {} as any).then((result) => {
  console.log(JSON.stringify(result, null, 2));
});
```

## Troubleshooting

### Lambda Cold Starts

- **Symptom**: First request takes 5-10 seconds
- **Solution**: Use provisioned concurrency or wait for warm-up

### Authorization Fails

- **Symptom**: 403 Unauthorized on all requests
- **Check**:
  1. JWT token is valid and not expired
  2. Token includes `roles` array in payload
  3. Role policies exist in DynamoDB
  4. Path and method match policy resources

### DynamoDB Permissions

- **Symptom**: Authorizer returns 500 error
- **Solution**: Verify Lambda has `dynamodb:Query` permission on role-policies table

### View Authorizer Logs

```bash
aws logs tail /aws/lambda/AuthorizerLambda --follow
```

### View Service Lambda Logs

```bash
# User Service
aws logs tail /aws/lambda/UserServiceLambda --follow

# Mortgage Service
aws logs tail /aws/lambda/MortgageServiceLambda --follow

# Property Service
aws logs tail /aws/lambda/PropertyServiceLambda --follow
```

## Updating Policies

### Option 1: Direct DynamoDB Update

```bash
aws dynamodb put-item \
  --table-name role-policies \
  --item '{
    "PK": {"S": "ROLE#custom-role"},
    "SK": {"S": "POLICY"},
    "roleName": {"S": "custom-role"},
    "policy": {"M": {...}},
    "isActive": {"BOOL": true},
    "updatedAt": {"S": "2025-12-19T12:00:00Z"}
  }'
```

### Option 2: Via User Service

```typescript
// In your role management endpoint
await this.policySyncService.syncRolePolicy({
  roleName: "custom-role",
  policy: {
    version: "1",
    statements: [
      /* ... */
    ],
  },
  isActive: true,
});
```

### Clear Authorizer Cache

Policies are cached for 5 minutes. To force immediate update:

- Wait 5 minutes, OR
- Redeploy API Gateway, OR
- Change Authorization header (forces new cache key)

## Clean Up

To delete all resources:

```bash
cdk destroy
```

⚠️ **Warning**: This will delete:

- VPC, subnets, NAT gateway
- RDS Aurora cluster
- ElastiCache cluster
- All Lambda functions
- DynamoDB table (if RemovalPolicy allows)
- API Gateway

## Cost Optimization

### Development

- Use `t4g.micro` instances (ARM-based)
- Set Aurora to pause after inactivity
- Use DynamoDB on-demand pricing

### Production

- Consider provisioned concurrency for Lambdas
- Switch to provisioned capacity for DynamoDB if predictable traffic
- Use Aurora Serverless v2 auto-scaling

## Monitoring

### CloudWatch Metrics to Watch

1. **AuthorizerLambda**:

   - Invocations (should decrease after cache warms)
   - Duration (should be <100ms)
   - Errors (should be 0)

2. **DynamoDB**:

   - ConsumedReadCapacityUnits
   - ThrottledRequests (should be 0)

3. **API Gateway**:
   - 4XXError (unauthorized access attempts)
   - Latency (should be <500ms)

### Set Up Alarms

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name authorizer-high-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=AuthorizerLambda
```

## Next Steps

1. ✅ Deploy infrastructure
2. ✅ Seed role policies
3. ✅ Test authentication flow
4. ⏭️ Integrate PolicySyncService in User Service
5. ⏭️ Add custom roles via Admin UI
6. ⏭️ Implement fine-grained permissions (e.g., user can only access own resources)
7. ⏭️ Add monitoring and alerting
8. ⏭️ Set up CI/CD pipeline

---

**Support**: For issues, check CloudWatch Logs for detailed error messages.

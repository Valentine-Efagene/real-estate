# Infrastructure Setup and Deployment Guide

## Prerequisites

1. AWS CDK installed and configured
2. Node.js 20.x installed
3. AWS CLI configured with appropriate credentials
4. Separate repositories for each service (if deploying independently)

## Step 1: Deploy Infrastructure (CDK Stack)

The CDK stack provisions all shared infrastructure that services will use.

```bash
cd infrastructure
npm install
npm run build

# Deploy to development
npx cdk deploy --profile your-aws-profile

# Deploy to production
npx cdk deploy --context stage=production --profile your-aws-profile
```

### CDK Outputs

After deployment, CDK will output important values. **Copy these values** - you'll need them for service deployment:

```
QShelterVpcId = vpc-0abc123def456
QShelterPrivateSubnetIds = subnet-0abc123,subnet-0def456
QShelterDatabaseEndpoint = qshelter-db.cluster-abc123.us-east-1.rds.amazonaws.com
QShelterDatabasePort = 3306
QShelterDatabaseSecretArn = arn:aws:secretsmanager:us-east-1:123456789:secret:xxxxx
QShelterDatabaseSecurityGroupId = sg-0abc123def
QShelterValkeyEndpoint = qshelter-valkey.abc123.0001.use1.cache.amazonaws.com
QShelterRolePoliciesTableName = role-policies
QShelterUploadsBucketName = qshelter-uploads-123456789
QShelterEventBusName = qshelter-event-bus
QShelterHttpApiId = abc123def4
QShelterHttpApiEndpoint = https://abc123def4.execute-api.us-east-1.amazonaws.com
```

## Step 2: Configure Service Environment Variables

Each service team needs to create a `.env` file from the CDK outputs.

### For User Service Team

Create `services/user-service/.env`:

```bash
# Copy from CDK outputs
HTTP_API_ID=abc123def4
VPC_ID=vpc-0abc123def456
DB_SECURITY_GROUP_ID=sg-0abc123def
PRIVATE_SUBNET_ID_1=subnet-0abc123
PRIVATE_SUBNET_ID_2=subnet-0def456

DB_HOST=qshelter-db.cluster-abc123.us-east-1.rds.amazonaws.com
DB_PORT=3306
DATABASE_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789:secret:xxxxx

REDIS_HOST=qshelter-valkey.abc123.0001.use1.cache.amazonaws.com
REDIS_PORT=6379

ROLE_POLICIES_TABLE_NAME=role-policies
EVENTBRIDGE_BUS_NAME=qshelter-event-bus
S3_BUCKET_NAME=qshelter-uploads-123456789

# Service-specific secrets (generate these)
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
REFRESH_TOKEN_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
ENCRYPTION_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_SALT=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://abc123def4.execute-api.us-east-1.amazonaws.com/auth/google/callback

FRONTEND_BASE_URL=https://www.qshelter.ng
```

### For Authorizer Service Team

Create `services/authorizer-service/.env`:

```bash
# Copy from CDK outputs
HTTP_API_ID=abc123def4
ROLE_POLICIES_TABLE_NAME=role-policies

# Must match user-service JWT_SECRET!
JWT_SECRET=same-secret-as-user-service
```

### For Property Service Team

Create `services/property-service/.env`:

```bash
# Copy from CDK outputs
HTTP_API_ID=abc123def4
VPC_ID=vpc-0abc123def456
DB_SECURITY_GROUP_ID=sg-0abc123def
PRIVATE_SUBNET_ID_1=subnet-0abc123
PRIVATE_SUBNET_ID_2=subnet-0def456

DB_HOST=qshelter-db.cluster-abc123.us-east-1.rds.amazonaws.com
DB_PORT=3306
DATABASE_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789:secret:xxxxx

EVENTBRIDGE_BUS_NAME=qshelter-event-bus
S3_BUCKET_NAME=qshelter-uploads-123456789

# Service-specific
JWT_SECRET=same-secret-as-user-service
```

### For Mortgage Service Team

Create `services/mortgage-service/.env`:

```bash
# Copy from CDK outputs
HTTP_API_ID=abc123def4
VPC_ID=vpc-0abc123def456
DB_SECURITY_GROUP_ID=sg-0abc123def
PRIVATE_SUBNET_ID_1=subnet-0abc123
PRIVATE_SUBNET_ID_2=subnet-0def456

DB_HOST=qshelter-db.cluster-abc123.us-east-1.rds.amazonaws.com
DB_PORT=3306
DATABASE_SECRET_ARN=arn:aws:secretsmanager:us-east-1:123456789:secret:xxxxx

EVENTBRIDGE_BUS_NAME=qshelter-event-bus

# Service-specific
JWT_SECRET=same-secret-as-user-service
PAYSTACK_SECRET_KEY=sk_live_your_production_key
PAYSTACK_PUBLIC_KEY=pk_live_your_production_key
```

## Step 3: Deploy Services

### Deployment Order

**CRITICAL**: Deploy authorizer FIRST, then other services in any order.

#### 1. Deploy Authorizer (Required First)

```bash
cd services/authorizer-service
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

This creates the `qshelterAuthorizer` that other services reference.

#### 2. Deploy User Service

```bash
cd services/user-service
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

#### 3. Deploy Property Service

```bash
cd services/property-service
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

#### 4. Deploy Mortgage Service

```bash
cd services/mortgage-service
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

#### 5. Deploy Notifications Service

```bash
cd services/notifications
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

## Step 4: Verify Deployment

### Test API Endpoints

```bash
# Get the API endpoint from CDK outputs
API_URL=https://abc123def4.execute-api.us-east-1.amazonaws.com

# Test public endpoint
curl $API_URL/auth/login

# Test protected endpoint (will fail without auth)
curl $API_URL/users

# Login and get token
TOKEN=$(curl -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.data.accessToken')

# Test protected endpoint with token
curl $API_URL/users \
  -H "Authorization: Bearer $TOKEN"
```

## Sharing Infrastructure Values Between Teams

Since services are in different repos, you need a way to share CDK outputs:

### Option 1: Manual Distribution

1. DevOps deploys CDK and shares outputs via secure channel (Slack, email)
2. Each team copies values to their `.env` file

### Option 2: AWS Systems Manager Parameter Store

DevOps team creates parameters:

```bash
# After CDK deployment, export values
aws ssm put-parameter --name "/qshelter/production/http-api-id" --value "abc123" --type String
aws ssm put-parameter --name "/qshelter/production/db-host" --value "xxx.rds.amazonaws.com" --type String
# ... etc for all values

# Service teams retrieve:
aws ssm get-parameter --name "/qshelter/production/http-api-id" --query Parameter.Value
```

### Option 3: Secrets Manager (for sensitive values)

Store all infrastructure config as a single secret:

```bash
aws secretsmanager create-secret \
  --name qshelter/production/infrastructure \
  --secret-string '{
    "http_api_id": "abc123",
    "db_host": "xxx.rds.amazonaws.com",
    "db_port": "3306",
    ...
  }'
```

### Option 4: Shared Configuration Repository

Create a separate `qshelter-config` repo with environment files that all teams pull from.

## Updating Services

### When Infrastructure Changes

1. DevOps updates and redeploys CDK stack
2. DevOps shares new values with service teams
3. Service teams update their `.env` files
4. Service teams redeploy: `serverless deploy`

### When Only Service Code Changes

Each team independently:

```bash
npm run build
serverless deploy --stage production
```

### When Authorizer Changes

1. Authorizer team deploys: `serverless deploy`
2. Authorizer updates automatically apply to all services
3. No other services need redeployment

## Rollback Procedures

### Rollback a Service

```bash
serverless deploy --stage production --function functionName --version previous-version
```

### Rollback Infrastructure

```bash
cd infrastructure
npx cdk deploy --rollback
```

## Monitoring

Check CloudWatch logs for each service:

```bash
aws logs tail /aws/lambda/qshelter-user-service --follow
aws logs tail /aws/lambda/qshelter-authorizer-service --follow
aws logs tail /aws/lambda/qshelter-property-service --follow
```

## Troubleshooting

### Service can't connect to database

- Verify `DB_SECURITY_GROUP_ID` matches CDK output
- Check VPC subnet IDs are correct
- Ensure Lambda is in private subnets with NAT gateway

### Authorizer not found

- Verify authorizer was deployed first
- Check `HTTP_API_ID` matches CDK output
- Confirm authorizer name is `qshelterAuthorizer`

### 403 Forbidden errors

- Verify all services use the same `JWT_SECRET`
- Check token is being sent in `Authorization` header
- Review CloudWatch logs for authorizer Lambda

## Cost Optimization

- Use `serverless remove` to delete unused stages
- Set Lambda reserved concurrency to prevent runaway costs
- Enable API Gateway caching to reduce Lambda invocations
- Use RDS Aurora Serverless v2 auto-scaling

## Security Checklist

- [ ] All secrets in AWS Secrets Manager (not `.env` files)
- [ ] VPC security groups properly configured
- [ ] S3 bucket not publicly accessible
- [ ] API Gateway has rate limiting enabled
- [ ] CloudTrail enabled for audit logging
- [ ] Lambda functions have minimal IAM permissions

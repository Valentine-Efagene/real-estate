# AWS Configuration Management

## Overview

The CDK stack now manages all configuration using a hybrid approach:

- **SSM Parameter Store** (free) for infrastructure values
- **Secrets Manager** (paid) for sensitive credentials

## How It Works

### 1. CDK Deployment

When you deploy the CDK stack, it automatically creates:

**SSM Parameters** (all at `/qshelter/{stage}/`):

- `http-api-id` - API Gateway ID
- `vpc-id` - VPC ID
- `db-security-group-id` - Database security group
- `private-subnet-ids` - Comma-separated subnet IDs
- `db-host` - Database endpoint
- `db-port` - Database port
- `database-secret-arn` - ARN of DB credentials secret
- `redis-host` - Redis/Valkey endpoint
- `redis-port` - Redis port
- `role-policies-table-name` - DynamoDB table name
- `s3-bucket-name` - S3 uploads bucket
- `eventbridge-bus-name` - EventBridge bus name

**Secrets Manager Secrets** (all at `qshelter/{stage}/`):

- `jwt-secret` - **AUTO-GENERATED** JWT signing secret
- `refresh-token-secret` - **AUTO-GENERATED** refresh token secret
- `encryption` - **AUTO-GENERATED** encryption password and salt
- `oauth` - OAuth credentials (**UPDATE MANUALLY**)
- `paystack` - Paystack API keys (**UPDATE MANUALLY**)
- `email` - Email/SMTP credentials (**UPDATE MANUALLY**)

### 2. Update Placeholder Secrets

After CDK deployment, update the placeholder secrets:

```bash
# Update OAuth credentials
aws secretsmanager put-secret-value \
  --secret-id qshelter/production/oauth \
  --secret-string '{
    "google_client_id": "actual-client-id",
    "google_client_secret": "actual-secret",
    "google_callback_url": "https://abc123.execute-api.us-east-1.amazonaws.com/auth/google/callback"
  }'

# Update Paystack credentials
aws secretsmanager put-secret-value \
  --secret-id qshelter/production/paystack \
  --secret-string '{
    "secret_key": "sk_live_actual_key",
    "public_key": "pk_live_actual_key",
    "base_url": "https://api.paystack.co"
  }'

# Update Email credentials
aws secretsmanager put-secret-value \
  --secret-id qshelter/production/email \
  --secret-string '{
    "office365_client_id": "actual-client-id",
    "office365_client_secret": "actual-secret",
    "office365_tenant_id": "actual-tenant-id",
    "office365_sender_email": "info@qshelter.ng"
  }'
```

### 3. Using in Services

Services use the `ConfigService` from `@valentine-efagene/qshelter-common`:

```typescript
import { configService } from "@valentine-efagene/qshelter-common";

// In your main.ts or bootstrap function
async function bootstrap() {
  // Load all infrastructure config (cached for 5 minutes)
  const infra = await configService.getInfrastructureConfig("production");

  console.log("API Gateway ID:", infra.httpApiId);
  console.log("Database Host:", infra.dbHost);
  console.log("S3 Bucket:", infra.s3BucketName);

  // Load JWT secret
  const jwtSecret = await configService.getJwtSecret("production");
  console.log("JWT Secret:", jwtSecret.secret);

  // Load encryption keys
  const encryption = await configService.getEncryptionSecrets("production");

  // Load OAuth secrets
  const oauth = await configService.getOAuthSecrets("production");

  // Use in your app
  const app = await NestFactory.create(AppModule);
  // ...
}
```

### 4. No Environment Files Needed

Services **no longer need** `.env` files in production! Just deploy:

```bash
cd services/user-service
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

The service automatically fetches all config from AWS at startup.

## Local Development

For local development, you can still use `.env` files OR fetch from AWS:

```typescript
// Option 1: Use .env file locally
if (process.env.NODE_ENV === "development") {
  require("dotenv").config();
  // Use process.env.* values
}

// Option 2: Fetch from AWS dev stage
const infra = await configService.getInfrastructureConfig("dev");
```

## Benefits

✅ **No Manual Configuration** - Services automatically get all values  
✅ **No Secrets in Code** - Everything stored securely in AWS  
✅ **Automatic Rotation** - Rotate secrets without redeploying services  
✅ **Single Source of Truth** - CDK manages everything  
✅ **Cross-Account Support** - Can share configs across AWS accounts  
✅ **Version Control Safe** - No secrets in Git  
✅ **Team Independence** - Each team just deploys, no config needed

## Cost

- **SSM Parameter Store**: FREE for standard parameters
- **Secrets Manager**: $0.40/month per secret + $0.05 per 10,000 API calls
- **Caching**: ConfigService caches for 5 minutes to minimize API calls

Estimated cost for all secrets: ~$3/month

## Security

- Lambda functions have IAM permissions to read only their stage's config
- Secrets are encrypted at rest
- CloudTrail logs all access
- Can set up automatic rotation for database credentials
- Fine-grained access control via IAM

## Deployment Workflow

1. **DevOps**: Deploy CDK stack

   ```bash
   cd infrastructure
   npx cdk deploy --context stage=production
   ```

2. **DevOps**: Update placeholder secrets (one-time)

   ```bash
   # Run the aws secretsmanager put-secret-value commands above
   ```

3. **Service Teams**: Just deploy!
   ```bash
   cd services/user-service
   serverless deploy --stage production
   ```

That's it! No configuration sharing needed between teams. 🎉

## Troubleshooting

### Service can't read parameters

- Verify Lambda has IAM permissions (check CDK LambdaServiceRole)
- Confirm stage name matches (dev/production)
- Check CloudWatch logs for detailed error messages

### Secrets not found

- Verify CDK deployed successfully
- Check secret names match pattern: `qshelter/{stage}/secret-name`
- Ensure you updated placeholder secrets

### Performance issues

- ConfigService caches for 5 minutes by default
- Consider increasing cache TTL for production
- Monitor CloudWatch for throttling

## Example: Complete Service Bootstrap

```typescript
// src/main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configService } from "@valentine-efagene/qshelter-common";

async function bootstrap() {
  const stage = process.env.NODE_ENV || "dev";

  // Fetch all config from AWS
  const [infra, jwtSecret, encryption, oauth] = await Promise.all([
    configService.getInfrastructureConfig(stage),
    configService.getJwtSecret(stage),
    configService.getEncryptionSecrets(stage),
    configService.getOAuthSecrets(stage),
  ]);

  // Create NestJS app with loaded config
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  // Use config in your app...
  console.log(`Connected to database: ${infra.dbHost}`);
  console.log(`Using S3 bucket: ${infra.s3BucketName}`);

  await app.listen(3000);
}

bootstrap();
```

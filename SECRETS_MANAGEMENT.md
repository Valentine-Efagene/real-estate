# Secrets Management Guide

## Overview

This guide explains how to securely manage secrets for the QShelter platform using AWS Secrets Manager.

## Why AWS Secrets Manager?

- Automatic encryption at rest
- Automatic rotation of credentials
- Fine-grained access control via IAM
- Audit logging via CloudTrail
- Integration with AWS services
- No secrets in code or environment variables in production

## Setup Process

### 1. Install AWS CLI (if not already installed)

```bash
# macOS
brew install awscli

# Verify installation
aws --version
```

### 2. Configure AWS Credentials

```bash
aws configure --profile production
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1
# - Default output format: json
```

### 3. Create Secrets in AWS Secrets Manager

#### Database Credentials

```bash
aws secretsmanager create-secret \
  --name qshelter/production/database \
  --description "Production database credentials" \
  --secret-string '{
    "host": "your-rds-endpoint.rds.amazonaws.com",
    "port": "3306",
    "username": "qshelter_admin",
    "password": "STRONG_PASSWORD_HERE",
    "database": "qshelter_production"
  }' \
  --region us-east-1 \
  --profile production
```

#### JWT Secrets

```bash
# Generate strong secrets first
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
ACCESS_TOKEN_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
REFRESH_TOKEN_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

aws secretsmanager create-secret \
  --name qshelter/production/jwt \
  --description "JWT secrets for token generation" \
  --secret-string "{
    \"jwt_secret\": \"$JWT_SECRET\",
    \"access_token_secret\": \"$ACCESS_TOKEN_SECRET\",
    \"refresh_token_secret\": \"$REFRESH_TOKEN_SECRET\",
    \"expires_in\": \"1h\"
  }" \
  --region us-east-1 \
  --profile production
```

#### Encryption Keys

```bash
ENCRYPTION_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_SALT=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")

aws secretsmanager create-secret \
  --name qshelter/production/encryption \
  --description "Encryption keys for sensitive data" \
  --secret-string "{
    \"password\": \"$ENCRYPTION_PASSWORD\",
    \"salt\": \"$ENCRYPTION_SALT\"
  }" \
  --region us-east-1 \
  --profile production
```

#### AWS Service Credentials

```bash
aws secretsmanager create-secret \
  --name qshelter/production/aws \
  --description "AWS service credentials" \
  --secret-string '{
    "access_key_id": "YOUR_ACCESS_KEY",
    "secret_access_key": "YOUR_SECRET_KEY",
    "region": "us-east-1",
    "s3_bucket_name": "qshelter-uploads-production",
    "eventbridge_bus_name": "qshelter-event-bus-production"
  }' \
  --region us-east-1 \
  --profile production
```

#### Redis/ElastiCache Credentials

```bash
aws secretsmanager create-secret \
  --name qshelter/production/redis \
  --description "Redis/ElastiCache credentials" \
  --secret-string '{
    "host": "your-elasticache-endpoint.amazonaws.com",
    "port": "6379",
    "username": "default",
    "password": "REDIS_PASSWORD_HERE"
  }' \
  --region us-east-1 \
  --profile production
```

#### Paystack API Keys

```bash
aws secretsmanager create-secret \
  --name qshelter/production/paystack \
  --description "Paystack payment gateway credentials" \
  --secret-string '{
    "secret_key": "sk_live_YOUR_PRODUCTION_KEY",
    "public_key": "pk_live_YOUR_PRODUCTION_KEY",
    "base_url": "https://api.paystack.co"
  }' \
  --region us-east-1 \
  --profile production
```

#### Google OAuth Credentials

```bash
aws secretsmanager create-secret \
  --name qshelter/production/google-oauth \
  --description "Google OAuth credentials" \
  --secret-string '{
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "client_secret": "YOUR_GOOGLE_CLIENT_SECRET",
    "callback_url": "https://api.qshelter.ng/auth/google/callback"
  }' \
  --region us-east-1 \
  --profile production
```

#### Email Service Credentials (Office365)

```bash
aws secretsmanager create-secret \
  --name qshelter/production/email \
  --description "Email service credentials" \
  --secret-string '{
    "office365_client_id": "YOUR_CLIENT_ID",
    "office365_client_secret": "YOUR_CLIENT_SECRET",
    "office365_tenant_id": "YOUR_TENANT_ID",
    "office365_sender_email": "info@qshelter.ng",
    "from_email": "info@qshelter.ng",
    "reply_email": "info@qshelter.ng"
  }' \
  --region us-east-1 \
  --profile production
```

#### Swagger/API Documentation Credentials

```bash
aws secretsmanager create-secret \
  --name qshelter/production/swagger \
  --description "Swagger API documentation credentials" \
  --secret-string '{
    "username": "qshelter",
    "password": "STRONG_SWAGGER_PASSWORD_HERE"
  }' \
  --region us-east-1 \
  --profile production
```

### 4. Grant Lambda Functions Access to Secrets

Update your `serverless.yml` files to include IAM permissions:

```yaml
provider:
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - secretsmanager:GetSecretValue
          Resource:
            - arn:aws:secretsmanager:${self:provider.region}:*:secret:qshelter/${self:provider.stage}/*
```

### 5. Accessing Secrets in Lambda Functions

#### Option 1: Using AWS SDK (Recommended)

```typescript
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getSecret(secretName: string) {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return JSON.parse(response.SecretString);
}

// Usage
const dbCredentials = await getSecret("qshelter/production/database");
const jwtSecrets = await getSecret("qshelter/production/jwt");
```

#### Option 2: Lambda Extension (Better Performance)

AWS provides a Lambda extension that caches secrets:

```yaml
# In serverless.yml
functions:
  myFunction:
    layers:
      - arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension:4
    environment:
      SECRET_ARN: arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:qshelter/production/database
```

### 6. Rotating Secrets

#### Manual Rotation

```bash
# Update a secret
aws secretsmanager update-secret \
  --secret-id qshelter/production/database \
  --secret-string '{
    "host": "your-rds-endpoint.rds.amazonaws.com",
    "port": "3306",
    "username": "qshelter_admin",
    "password": "NEW_STRONG_PASSWORD",
    "database": "qshelter_production"
  }' \
  --region us-east-1 \
  --profile production
```

#### Automatic Rotation Setup

```bash
# For RDS credentials (AWS can rotate automatically)
aws secretsmanager rotate-secret \
  --secret-id qshelter/production/database \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:ACCOUNT_ID:function:SecretsManagerRotation \
  --rotation-rules AutomaticallyAfterDays=30 \
  --region us-east-1 \
  --profile production
```

## Staging Environment

For staging, create similar secrets with `/staging/` in the name:

```bash
aws secretsmanager create-secret \
  --name qshelter/staging/database \
  --description "Staging database credentials" \
  --secret-string '{...}' \
  --region us-east-1 \
  --profile production
```

## Development Environment

For local development, use `.env` files (already in `.gitignore`). Never use production secrets locally.

## Viewing Secrets

```bash
# List all secrets
aws secretsmanager list-secrets --region us-east-1 --profile production

# Get a specific secret
aws secretsmanager get-secret-value \
  --secret-id qshelter/production/database \
  --region us-east-1 \
  --profile production
```

## Deleting Secrets

```bash
# Schedule deletion (7-30 days recovery window)
aws secretsmanager delete-secret \
  --secret-id qshelter/production/old-secret \
  --recovery-window-in-days 7 \
  --region us-east-1 \
  --profile production

# Immediate deletion (use with caution!)
aws secretsmanager delete-secret \
  --secret-id qshelter/production/old-secret \
  --force-delete-without-recovery \
  --region us-east-1 \
  --profile production
```

## Cost Optimization

- Each secret costs $0.40/month
- Each 10,000 API calls costs $0.05
- Use Lambda extension to cache secrets and reduce API calls
- Delete unused secrets
- Consider AWS Systems Manager Parameter Store for non-sensitive configs ($0 for standard parameters)

## Best Practices

1. **Never commit secrets to Git** - Use `.gitignore` for `.env` files
2. **Use different secrets per environment** - staging, production
3. **Rotate secrets regularly** - at least every 90 days
4. **Use least privilege IAM policies** - only grant access to needed secrets
5. **Enable CloudTrail** - audit all secret access
6. **Use encryption helpers** - for additional data encryption
7. **Cache secrets in Lambda** - reduce API calls and improve performance
8. **Document secret structure** - maintain this guide
9. **Set up alerts** - for unauthorized access attempts
10. **Regular audits** - review who has access to secrets

## Troubleshooting

### Secret Not Found

```bash
# Verify secret exists
aws secretsmanager describe-secret \
  --secret-id qshelter/production/database \
  --region us-east-1 \
  --profile production
```

### Permission Denied

- Check IAM role has `secretsmanager:GetSecretValue` permission
- Verify resource ARN in IAM policy matches secret ARN
- Check Lambda execution role

### Caching Issues

- Lambda extension caches secrets for 5 minutes by default
- Force refresh by updating the secret version
- Or wait for cache TTL to expire

## Migration from .env to Secrets Manager

1. Create all secrets in Secrets Manager (as shown above)
2. Update Lambda code to fetch secrets on cold start
3. Cache secrets in memory during Lambda execution
4. Remove environment variables from `serverless.yml`
5. Test thoroughly in staging
6. Deploy to production
7. Monitor CloudWatch logs for any issues

## Example: Complete Lambda Function with Secrets

```typescript
// src/config/secrets.service.ts
import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

interface DatabaseSecret {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

interface JwtSecret {
  jwt_secret: string;
  access_token_secret: string;
  refresh_token_secret: string;
  expires_in: string;
}

@Injectable()
export class SecretsService implements OnModuleInit {
  private client: SecretsManagerClient;
  private cache = new Map<string, any>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<string, number>();

  constructor() {
    this.client = new SecretsManagerClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  async onModuleInit() {
    // Preload critical secrets on startup
    await this.getDatabaseCredentials();
    await this.getJwtSecrets();
  }

  private async getSecret<T>(secretName: string): Promise<T> {
    const now = Date.now();
    const cachedTime = this.cacheTimestamps.get(secretName);

    // Return cached value if still valid
    if (
      cachedTime &&
      now - cachedTime < this.CACHE_TTL &&
      this.cache.has(secretName)
    ) {
      return this.cache.get(secretName);
    }

    // Fetch from Secrets Manager
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await this.client.send(command);
    const secret = JSON.parse(response.SecretString);

    // Update cache
    this.cache.set(secretName, secret);
    this.cacheTimestamps.set(secretName, now);

    return secret;
  }

  async getDatabaseCredentials(): Promise<DatabaseSecret> {
    const stage = process.env.NODE_ENV || "development";
    return this.getSecret<DatabaseSecret>(`qshelter/${stage}/database`);
  }

  async getJwtSecrets(): Promise<JwtSecret> {
    const stage = process.env.NODE_ENV || "development";
    return this.getSecret<JwtSecret>(`qshelter/${stage}/jwt`);
  }

  async getEncryptionKeys() {
    const stage = process.env.NODE_ENV || "development";
    return this.getSecret(`qshelter/${stage}/encryption`);
  }

  async getPaystackCredentials() {
    const stage = process.env.NODE_ENV || "development";
    return this.getSecret(`qshelter/${stage}/paystack`);
  }
}
```

## Support

For issues or questions, contact the DevOps team.

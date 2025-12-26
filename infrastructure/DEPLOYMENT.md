# Infrastructure Deployment Guide

## Overview

The CDK stack reads sensitive values from the `.env` file at the project root during deployment. This keeps secrets out of version control while allowing easy configuration.

## Prerequisites

1. Ensure the `.env` file exists at the project root (`/Users/valentyne/Documents/code/research/real-estate/.env`)
2. Make sure `.env` is listed in `.gitignore`
3. AWS CLI configured with appropriate credentials
4. Node.js and npm installed

## Environment Variables Used

The stack reads the following variables from `.env`:

### Authentication & Security

- `ACCESS_TOKEN_SECRET` - JWT signing secret
- `REFRESH_TOKEN_SECRET` - Refresh token signing secret
- `ENCRYPTION_PASSWORD` - Encryption password for sensitive data
- `ENCRYPTION_SALT` - Encryption salt

### OAuth (Google)

- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_CALLBACK_URL` - Google OAuth callback URL

### Payment Gateway (Paystack)

- `PAYSTACK_SECRET_KEY` - Paystack secret key
- `PAYSTACK_PUBLIC_KEY` - Paystack public key
- `PAYSTACK_BASE_URL` - Paystack API base URL

### Email Configuration

- `OFFICE365_CLIENT_ID` - Office 365 client ID
- `OFFICE365_CLIENT_SECRET` - Office 365 client secret
- `OFFICE365_TENANT_ID` - Office 365 tenant ID
- `OFFICE365_SENDER_EMAIL` - Sender email address
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_USERNAME` - SMTP username
- `SMTP_PASSWORD` - SMTP password
- `SMTP_ENCRYPTION` - SMTP encryption method (STARTTLS, SSL)
- `FROM_EMAIL` or `MAIL_FROM_ADDRESS` - Default sender email

## Deployment Commands

### 1. Install Dependencies

```bash
cd infrastructure
npm install
```

### 2. Build the Stack

```bash
npm run build
```

### 3. Synthesize CloudFormation Template

```bash
cdk synth
```

### 4. Deploy to AWS

**Development:**

```bash
cdk deploy --context stage=dev
```

**Staging:**

```bash
cdk deploy --context stage=staging
```

**Production:**

```bash
cdk deploy --context stage=production
```

## What Gets Created

### AWS Systems Manager (Parameter Store)

All infrastructure values are stored as parameters:

- `/qshelter/{stage}/http-api-id` - HTTP API Gateway ID
- `/qshelter/{stage}/vpc-id` - VPC ID
- `/qshelter/{stage}/db-host` - Database endpoint
- `/qshelter/{stage}/db-port` - Database port
- `/qshelter/{stage}/redis-host` - Redis/Valkey endpoint
- `/qshelter/{stage}/redis-port` - Redis port
- `/qshelter/{stage}/role-policies-table-name` - DynamoDB table name
- `/qshelter/{stage}/s3-bucket-name` - S3 bucket name
- `/qshelter/{stage}/eventbridge-bus-name` - EventBridge bus name

### AWS Secrets Manager

All sensitive credentials are stored as secrets:

- `qshelter/{stage}/jwt-secret` - JWT signing secret
- `qshelter/{stage}/refresh-token-secret` - Refresh token secret
- `qshelter/{stage}/encryption` - Encryption keys (password & salt)
- `qshelter/{stage}/oauth` - OAuth credentials (Google)
- `qshelter/{stage}/paystack` - Paystack payment credentials
- `qshelter/{stage}/email` - Email/SMTP credentials

## Security Notes

1. **Never commit the `.env` file** - It contains sensitive credentials
2. **Auto-generation fallback** - If a secret is missing from `.env`, the stack will auto-generate a random value (for JWT/encryption keys)
3. **Update secrets manually** - After deployment, you can update secrets in AWS Secrets Manager console if needed
4. **Cost** - Secrets Manager charges $0.40/secret/month. Parameter Store is free.

## Post-Deployment

After deploying the infrastructure:

1. Note the stack outputs (HTTP API ID, etc.)
2. Services can now fetch configuration at runtime using the ConfigService from `@valentine-efagene/qshelter-common`
3. No need to pass environment variables to Lambda functions
4. All config is fetched from AWS at runtime

## Troubleshooting

### Missing .env file

If the `.env` file is not found, create it at the project root with all required variables.

### Invalid credentials

Ensure all OAuth and payment gateway credentials in `.env` are valid and up-to-date.

### Deployment fails

Check CloudFormation console for detailed error messages. Common issues:

- Insufficient AWS permissions
- Resource limits exceeded
- Conflicting resource names

### Updating secrets

To update a secret after deployment:

```bash
aws secretsmanager update-secret \
  --secret-id qshelter/dev/oauth \
  --secret-string '{"google_client_id":"new-value","google_client_secret":"new-value",...}'
```

## Multi-Stage Deployment

The stack supports multiple stages (dev, staging, production). Each stage:

- Has separate infrastructure resources
- Uses separate SSM parameters (`/qshelter/{stage}/...`)
- Uses separate secrets (`qshelter/{stage}/...`)
- Is completely isolated from other stages

This allows safe testing in dev/staging before promoting to production.

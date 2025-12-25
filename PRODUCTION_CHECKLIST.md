# Production Deployment Checklist

## Pre-Deployment Security & Configuration

### 1. Environment Variables

- [ ] Update all `CHANGE_ME_IN_PRODUCTION` placeholders in `.env` files
- [ ] Generate strong JWT secrets (minimum 64 characters)
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- [ ] Generate encryption keys (32 characters for password, 16 for salt)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- [ ] Update database credentials with production values
- [ ] Configure AWS credentials with production access keys
- [ ] Update Paystack keys with production keys
- [ ] Verify all EventBridge ARNs and bus names
- [ ] Update S3 bucket names to production buckets
- [ ] Update Redis/ElastiCache endpoints
- [ ] Update RDS endpoints
- [ ] Set OAuth callback URLs to production domains

### 2. Database Security

- [ ] Enable SSL/TLS for database connections
- [ ] Set `DB_SYNCHRONIZE=false` in all production `.env` files (already done)
- [ ] Create database migrations for schema changes
- [ ] Configure database backups and retention policies
- [ ] Set up read replicas if needed
- [ ] Configure VPC security groups for database access
- [ ] Enable encryption at rest for RDS
- [ ] Review and minimize database user permissions

### 3. AWS Infrastructure

- [ ] Deploy CDK stack to production account
  ```bash
  cd /Users/valentyne/Documents/code/research/real-estate
  npm run cdk:deploy -- --profile production
  ```
- [ ] Verify VPC, subnets, and security groups
- [ ] Configure CloudWatch log groups and retention
- [ ] Set up CloudWatch alarms for critical metrics
- [ ] Configure S3 bucket policies and CORS
- [ ] Enable S3 bucket encryption
- [ ] Set S3 lifecycle policies for old uploads
- [ ] Create EventBridge bus and configure rules
- [ ] Set up Lambda authorizer
- [ ] Configure API Gateway with custom domain
- [ ] Set up AWS Secrets Manager for sensitive credentials
- [ ] Configure AWS Systems Manager Parameter Store

### 4. Service Deployment

Each service should be deployed in order:

#### User Service

```bash
cd services/user-service
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

#### Property Service

```bash
cd services/property-service
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

#### Mortgage Service

```bash
cd services/mortgage-service
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

#### Notifications Service

```bash
cd services/notifications
npm install
npm run build
serverless deploy --stage production --region us-east-1
```

### 5. Security Hardening

- [ ] Enable AWS WAF on API Gateway
- [ ] Configure rate limiting on API Gateway
- [ ] Set up AWS Shield for DDoS protection
- [ ] Enable CloudTrail for audit logging
- [ ] Configure Lambda function policies (least privilege)
- [ ] Enable Lambda function versioning and aliases
- [ ] Set up VPC endpoints for AWS services
- [ ] Enable AWS GuardDuty for threat detection
- [ ] Configure AWS Config for compliance monitoring
- [ ] Review and update CORS policies
- [ ] Enable HTTPS only (disable HTTP)
- [ ] Configure security headers (HSTS, CSP, etc.)

### 6. Monitoring & Logging

- [ ] Set up CloudWatch dashboards
- [ ] Configure log aggregation and analysis
- [ ] Set up alerts for:
  - Lambda errors and timeouts
  - Database connection failures
  - High memory/CPU usage
  - API Gateway 4xx/5xx errors
  - EventBridge failed deliveries
- [ ] Configure X-Ray for distributed tracing
- [ ] Set up custom metrics for business KPIs
- [ ] Configure log retention policies
- [ ] Set up SNS topics for critical alerts

### 7. Performance Optimization

- [ ] Configure Lambda reserved concurrency
- [ ] Enable Lambda provisioned concurrency for critical functions
- [ ] Set appropriate Lambda memory and timeout settings
- [ ] Configure API Gateway caching
- [ ] Set up CloudFront distribution for static assets
- [ ] Enable ElastiCache for Redis caching
- [ ] Configure database connection pooling
- [ ] Review and optimize database indexes
- [ ] Enable RDS Performance Insights

### 8. Backup & Disaster Recovery

- [ ] Configure automated RDS snapshots
- [ ] Set up cross-region RDS backups
- [ ] Configure S3 versioning for critical buckets
- [ ] Set up S3 cross-region replication
- [ ] Document disaster recovery procedures
- [ ] Test backup restoration process
- [ ] Configure EventBridge event archive and replay

### 9. CI/CD Pipeline

- [ ] Set up GitHub Actions or AWS CodePipeline
- [ ] Configure automated testing in pipeline
- [ ] Set up staging environment
- [ ] Configure blue-green deployments
- [ ] Set up automated rollback on failures
- [ ] Configure deployment approvals for production
- [ ] Set up automated security scanning

### 10. Documentation

- [ ] Document API endpoints and contracts
- [ ] Create runbooks for common operations
- [ ] Document deployment procedures
- [ ] Create incident response playbook
- [ ] Document environment variables and their purposes
- [ ] Create architecture diagrams
- [ ] Document inter-service communication patterns

### 11. Testing

- [ ] Run all e2e tests
- [ ] Perform load testing
- [ ] Conduct security penetration testing
- [ ] Test all EventBridge event flows
- [ ] Verify S3 presigned URL generation and expiry
- [ ] Test OAuth flows
- [ ] Verify email delivery
- [ ] Test payment integration
- [ ] Verify database migrations
- [ ] Test disaster recovery procedures

### 12. Compliance & Legal

- [ ] Review data retention policies
- [ ] Ensure GDPR compliance (if applicable)
- [ ] Configure data encryption at rest and in transit
- [ ] Document data processing agreements
- [ ] Set up audit logging for sensitive operations
- [ ] Review and update privacy policy
- [ ] Configure cookie consent management

## Post-Deployment Verification

### Immediate Checks (within 1 hour)

- [ ] Verify all Lambda functions are running
- [ ] Check API Gateway endpoints respond correctly
- [ ] Verify database connectivity
- [ ] Test user authentication flow
- [ ] Verify EventBridge event delivery
- [ ] Check CloudWatch logs for errors
- [ ] Test S3 presigned URL generation
- [ ] Verify email sending works

### First 24 Hours

- [ ] Monitor error rates and latencies
- [ ] Review CloudWatch alarms
- [ ] Check database performance metrics
- [ ] Monitor Lambda cold start times
- [ ] Review API usage patterns
- [ ] Check for any security alerts
- [ ] Monitor costs in AWS Cost Explorer

### First Week

- [ ] Analyze CloudWatch metrics trends
- [ ] Review and optimize Lambda performance
- [ ] Fine-tune database queries
- [ ] Adjust Lambda concurrency settings
- [ ] Review security logs
- [ ] Optimize costs
- [ ] Gather user feedback

## Maintenance Procedures

### Weekly

- [ ] Review CloudWatch alarms and logs
- [ ] Check database performance
- [ ] Monitor AWS costs
- [ ] Review security advisories
- [ ] Check for dependency updates

### Monthly

- [ ] Update dependencies and patch vulnerabilities
- [ ] Review and rotate credentials
- [ ] Analyze performance trends
- [ ] Review and optimize costs
- [ ] Conduct security audit
- [ ] Review and update documentation
- [ ] Test backup restoration

### Quarterly

- [ ] Conduct disaster recovery drill
- [ ] Review and update security policies
- [ ] Perform comprehensive security audit
- [ ] Review architecture for optimization opportunities
- [ ] Update compliance documentation

## Emergency Contacts

- DevOps Lead: [contact info]
- Security Team: [contact info]
- Database Administrator: [contact info]
- AWS Support: [support plan details]

## Rollback Procedures

### Lambda Function Rollback

```bash
# List versions
aws lambda list-versions-by-function --function-name qshelter-user-service-production

# Rollback to previous version
aws lambda update-alias \
  --function-name qshelter-user-service-production \
  --name production \
  --function-version [previous-version]
```

### Database Rollback

```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier qshelter-production-restored \
  --db-snapshot-identifier [snapshot-id]
```

## Notes

- All passwords and secrets must be stored in AWS Secrets Manager
- Never commit `.env` files to version control
- Always test in staging before deploying to production
- Maintain a deployment log with timestamps and deployer names

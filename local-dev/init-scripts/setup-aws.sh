#!/bin/bash
# LocalStack initialization script - runs automatically when LocalStack is ready
# This sets up all AWS resources needed for e2e testing

set -e

echo "🚀 Initializing LocalStack AWS resources for QShelter..."

ENDPOINT="http://localhost:4566"
REGION="us-east-1"
STAGE="test"

# Helper function
awslocal() {
  aws --endpoint-url=$ENDPOINT --region=$REGION "$@"
}

# =============================================================================
# S3 BUCKETS
# =============================================================================
echo "📦 Creating S3 buckets..."

awslocal s3 mb s3://qshelter-${STAGE}-uploads || true
awslocal s3 mb s3://qshelter-${STAGE}-documents || true

# Enable CORS for uploads bucket
awslocal s3api put-bucket-cors --bucket qshelter-${STAGE}-uploads --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }]
}'

# =============================================================================
# SSM PARAMETERS
# =============================================================================
echo "🔧 Setting up SSM parameters..."

# Infrastructure parameters
awslocal ssm put-parameter --name "/qshelter/${STAGE}/database-url" \
  --value "mysql://qshelter:qshelter_pass@host.docker.internal:3307/qshelter_test" \
  --type "SecureString" --overwrite || true

awslocal ssm put-parameter --name "/qshelter/${STAGE}/s3-bucket-name" \
  --value "qshelter-${STAGE}-uploads" \
  --type "String" --overwrite || true

awslocal ssm put-parameter --name "/qshelter/${STAGE}/event-bus-name" \
  --value "qshelter-${STAGE}-event-bus" \
  --type "String" --overwrite || true

awslocal ssm put-parameter --name "/qshelter/${STAGE}/redis-endpoint" \
  --value "localhost:6379" \
  --type "String" --overwrite || true

awslocal ssm put-parameter --name "/qshelter/${STAGE}/authorizer-lambda-arn" \
  --value "arn:aws:lambda:${REGION}:000000000000:function:qshelter-${STAGE}-authorizer" \
  --type "String" --overwrite || true

awslocal ssm put-parameter --name "/qshelter/${STAGE}/dynamodb-table-role-policies" \
  --value "qshelter-${STAGE}-role-policies" \
  --type "String" --overwrite || true

# =============================================================================
# SECRETS MANAGER
# =============================================================================
echo "🔐 Setting up Secrets Manager secrets..."

# JWT secrets
awslocal secretsmanager create-secret --name "qshelter/${STAGE}/jwt-access-secret" \
  --secret-string "test-jwt-access-secret-key-for-e2e-testing-min-32-chars" || \
awslocal secretsmanager put-secret-value --secret-id "qshelter/${STAGE}/jwt-access-secret" \
  --secret-string "test-jwt-access-secret-key-for-e2e-testing-min-32-chars"

awslocal secretsmanager create-secret --name "qshelter/${STAGE}/jwt-refresh-secret" \
  --secret-string "test-jwt-refresh-secret-key-for-e2e-testing-min-32-chars" || \
awslocal secretsmanager put-secret-value --secret-id "qshelter/${STAGE}/jwt-refresh-secret" \
  --secret-string "test-jwt-refresh-secret-key-for-e2e-testing-min-32-chars"

# OAuth secrets (mock values for testing)
awslocal secretsmanager create-secret --name "qshelter/${STAGE}/oauth" \
  --secret-string '{"google_client_id":"test-google-client-id","google_client_secret":"test-google-secret","facebook_client_id":"test-fb-id","facebook_client_secret":"test-fb-secret"}' || \
awslocal secretsmanager put-secret-value --secret-id "qshelter/${STAGE}/oauth" \
  --secret-string '{"google_client_id":"test-google-client-id","google_client_secret":"test-google-secret","facebook_client_id":"test-fb-id","facebook_client_secret":"test-fb-secret"}'

# Payment secrets (mock)
awslocal secretsmanager create-secret --name "qshelter/${STAGE}/paystack" \
  --secret-string '{"secret_key":"sk_test_xxx","public_key":"pk_test_xxx"}' || \
awslocal secretsmanager put-secret-value --secret-id "qshelter/${STAGE}/paystack" \
  --secret-string '{"secret_key":"sk_test_xxx","public_key":"pk_test_xxx"}'

# =============================================================================
# DYNAMODB TABLES
# =============================================================================
echo "📊 Creating DynamoDB tables..."

# Role policies table (for authorizer)
awslocal dynamodb create-table \
  --table-name qshelter-${STAGE}-role-policies \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST || true

# =============================================================================
# EVENTBRIDGE
# =============================================================================
echo "📡 Setting up EventBridge..."

awslocal events create-event-bus --name qshelter-${STAGE}-event-bus || true

# Create a catch-all rule for testing (logs all events)
awslocal events put-rule \
  --name qshelter-${STAGE}-catch-all \
  --event-bus-name qshelter-${STAGE}-event-bus \
  --event-pattern '{"source": [{"prefix": "qshelter"}]}' \
  --state ENABLED || true

# =============================================================================
# SQS QUEUES
# =============================================================================
echo "📬 Creating SQS queues..."

# Dead letter queue
awslocal sqs create-queue --queue-name qshelter-${STAGE}-dlq || true

# Event processing queues
awslocal sqs create-queue --queue-name qshelter-${STAGE}-notifications \
  --attributes '{"RedrivePolicy":"{\"deadLetterTargetArn\":\"arn:aws:sqs:'${REGION}':000000000000:qshelter-'${STAGE}'-dlq\",\"maxReceiveCount\":\"3\"}"}' || true

awslocal sqs create-queue --queue-name qshelter-${STAGE}-contract-events \
  --attributes '{"RedrivePolicy":"{\"deadLetterTargetArn\":\"arn:aws:sqs:'${REGION}':000000000000:qshelter-'${STAGE}'-dlq\",\"maxReceiveCount\":\"3\"}"}' || true

# =============================================================================
# SNS TOPICS
# =============================================================================
echo "📢 Creating SNS topics..."

awslocal sns create-topic --name qshelter-${STAGE}-notifications || true
awslocal sns create-topic --name qshelter-${STAGE}-contract-events || true

# =============================================================================
# CLOUDWATCH LOG GROUPS
# =============================================================================
echo "📋 Creating CloudWatch log groups..."

awslocal logs create-log-group --log-group-name /aws/lambda/qshelter-${STAGE}-user-service || true
awslocal logs create-log-group --log-group-name /aws/lambda/qshelter-${STAGE}-property-service || true
awslocal logs create-log-group --log-group-name /aws/lambda/qshelter-${STAGE}-mortgage-service || true
awslocal logs create-log-group --log-group-name /aws/lambda/qshelter-${STAGE}-authorizer || true

# =============================================================================
# SEED ROLE POLICIES
# =============================================================================
echo "👥 Seeding role policies for authorizer..."

# Admin role - full access
awslocal dynamodb put-item --table-name qshelter-${STAGE}-role-policies --item '{
  "PK": {"S": "ROLE#admin"},
  "SK": {"S": "POLICY"},
  "roleName": {"S": "admin"},
  "isActive": {"BOOL": true},
  "policy": {"S": "{\"version\":\"1.0\",\"statements\":[{\"effect\":\"Allow\",\"resources\":[{\"path\":\"/*\",\"methods\":[\"GET\",\"POST\",\"PUT\",\"PATCH\",\"DELETE\"]}]}]}"},
  "createdAt": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
  "updatedAt": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}
}'

# Buyer role
awslocal dynamodb put-item --table-name qshelter-${STAGE}-role-policies --item '{
  "PK": {"S": "ROLE#buyer"},
  "SK": {"S": "POLICY"},
  "roleName": {"S": "buyer"},
  "isActive": {"BOOL": true},
  "policy": {"S": "{\"version\":\"1.0\",\"statements\":[{\"effect\":\"Allow\",\"resources\":[{\"path\":\"/properties/*\",\"methods\":[\"GET\"]},{\"path\":\"/contracts/*\",\"methods\":[\"GET\",\"POST\"]},{\"path\":\"/payment-plans/*\",\"methods\":[\"GET\"]},{\"path\":\"/users/me\",\"methods\":[\"GET\",\"PUT\"]}]}]}"},
  "createdAt": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
  "updatedAt": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}
}'

# Agent role
awslocal dynamodb put-item --table-name qshelter-${STAGE}-role-policies --item '{
  "PK": {"S": "ROLE#agent"},
  "SK": {"S": "POLICY"},
  "roleName": {"S": "agent"},
  "isActive": {"BOOL": true},
  "policy": {"S": "{\"version\":\"1.0\",\"statements\":[{\"effect\":\"Allow\",\"resources\":[{\"path\":\"/properties/*\",\"methods\":[\"GET\",\"POST\",\"PUT\"]},{\"path\":\"/contracts/*\",\"methods\":[\"GET\",\"POST\",\"PUT\"]},{\"path\":\"/users/*\",\"methods\":[\"GET\"]}]}]}"},
  "createdAt": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
  "updatedAt": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}
}'

echo "✅ LocalStack initialization complete!"
echo ""
echo "Available resources:"
echo "  - S3: qshelter-${STAGE}-uploads, qshelter-${STAGE}-documents"
echo "  - EventBridge: qshelter-${STAGE}-event-bus"
echo "  - DynamoDB: qshelter-${STAGE}-role-policies"
echo "  - SQS: qshelter-${STAGE}-notifications, qshelter-${STAGE}-contract-events"
echo "  - SNS: qshelter-${STAGE}-notifications, qshelter-${STAGE}-contract-events"
echo "  - SSM/Secrets: /qshelter/${STAGE}/*"
echo ""
echo "Endpoint: http://localhost:4566"

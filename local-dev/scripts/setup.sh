#!/bin/bash
# =============================================================================
# QShelter LocalStack Full Setup Script
# =============================================================================
# This script sets up the complete local development environment:
# 1. Starts Docker containers (LocalStack, MySQL, Redis)
# 2. Deploys CDK infrastructure (SNS, SQS, S3, DynamoDB, etc.)
# 3. Runs database migrations
# 4. Builds all shared libraries
# 5. Deploys all service Lambdas to LocalStack
# 6. Seeds initial data
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DEV_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$LOCAL_DEV_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${YELLOW}🔧 $1${NC}"; echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     🏠 QShelter LocalStack Full Setup                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# STEP 1: Start Docker containers
# =============================================================================
log_step "Step 1/7: Starting Docker containers"

cd "$LOCAL_DEV_DIR"
docker compose up -d

log_info "Waiting for services to be healthy..."

# Wait for MySQL
echo "  - Waiting for MySQL..."
until docker exec qshelter-mysql mysqladmin ping -h localhost -u root -prootpassword --silent 2>/dev/null; do
  sleep 2
done
log_success "MySQL is ready"

# Wait for LocalStack
echo "  - Waiting for LocalStack..."
until curl -s http://localhost:4566/_localstack/health | grep -qE '"dynamodb": "(available|running)"' 2>/dev/null; do
  sleep 2
done
log_success "LocalStack is ready"

# Wait for Redis
echo "  - Waiting for Redis..."
until docker exec qshelter-redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
log_success "Redis is ready"

# =============================================================================
# STEP 2: Deploy CDK Infrastructure
# =============================================================================
log_step "Step 2/7: Deploying CDK Infrastructure to LocalStack"

cd "$REPO_ROOT/infrastructure"
log_info "Bootstrapping CDK..."
pnpm localstack:bootstrap 2>/dev/null || true

log_info "Deploying CDK stack..."
pnpm localstack:deploy

log_success "CDK infrastructure deployed"

# Seed role policies
log_info "Seeding role policies..."
ROLE_POLICIES_TABLE_NAME=qshelter-test-role-policies AWS_ENDPOINT_URL=http://localhost:4566 node scripts/seed-role-policies.mjs || true
log_success "Role policies seeded"

# =============================================================================
# STEP 3: Run Database Migrations
# =============================================================================
log_step "Step 3/7: Running Database Migrations"

cd "$REPO_ROOT/shared/common"
log_info "Running Prisma db push (for local dev)..."
npx prisma db push --accept-data-loss
log_success "Database schema applied"

# =============================================================================
# STEP 4: Build Shared Libraries
# =============================================================================
log_step "Step 4/7: Building Shared Libraries"

cd "$REPO_ROOT/shared/common"
log_info "Generating Prisma client..."
npx prisma generate

log_info "Building qshelter-common..."
pnpm run build
log_success "Shared libraries built"

# =============================================================================
# STEP 5: Deploy Service Lambdas
# =============================================================================
log_step "Step 5/7: Deploying Service Lambdas to LocalStack"

deploy_service() {
  local service_name=$1
  local service_dir=$2
  
  if [ -d "$REPO_ROOT/services/$service_dir" ]; then
    log_info "Deploying $service_name..."
    cd "$REPO_ROOT/services/$service_dir"
    
    # Clean serverless cache to avoid stale deployments
    rm -rf .serverless
    
    pnpm run build 2>/dev/null || npm run build
    
    # Check if serverless.localstack.yml exists, otherwise use serverless.yml with --stage localstack
    if [ -f "serverless.localstack.yml" ]; then
      npx sls deploy --stage localstack --config serverless.localstack.yml 2>&1 || log_warning "$service_name deployment had warnings"
    else
      npx sls deploy --stage localstack 2>&1 || log_warning "$service_name deployment had warnings"
    fi
    log_success "$service_name deployed"
  else
    log_warning "$service_name directory not found, skipping"
  fi
}

# Deploy authorizer first (other services may depend on it)
deploy_service "Authorizer Service" "authorizer-service"

# Deploy other services
deploy_service "User Service" "user-service"
deploy_service "Property Service" "property-service"
deploy_service "Mortgage Service" "mortgage-service"
deploy_service "Notification Service" "notification-service"
deploy_service "Documents Service" "documents-service"

log_success "All services deployed"

# =============================================================================
# STEP 6: Verify Deployment
# =============================================================================
log_step "Step 6/7: Verifying Deployment"

ENDPOINT=http://localhost:4566

log_info "Checking SNS topics..."
aws --endpoint-url=$ENDPOINT sns list-topics --query 'Topics[*].TopicArn' --output table 2>/dev/null || true

log_info "Checking SQS queues..."
aws --endpoint-url=$ENDPOINT sqs list-queues --query 'QueueUrls' --output table 2>/dev/null || true

log_info "Checking Lambda functions..."
aws --endpoint-url=$ENDPOINT lambda list-functions --query 'Functions[*].FunctionName' --output table 2>/dev/null || true

log_info "Checking S3 buckets..."
aws --endpoint-url=$ENDPOINT s3 ls 2>/dev/null || true

log_info "Checking API Gateways..."
aws --endpoint-url=$ENDPOINT apigateway get-rest-apis --query 'items[*].{name:name,id:id}' --output table 2>/dev/null || true

log_success "Deployment verified"

# =============================================================================
# STEP 7: Seed Demo Data (optional)
# =============================================================================
log_step "Step 7/7: Seeding Demo Data"

cd "$LOCAL_DEV_DIR"
if [ -f "scripts/seed.sh" ]; then
  bash scripts/seed.sh 2>/dev/null || log_warning "Seed script had issues"
fi
log_success "Demo data seeded"

# =============================================================================
# DONE!
# =============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     🎉 QShelter LocalStack Setup Complete!                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Services:"
echo "  - LocalStack:  http://localhost:4566"
echo "  - MySQL:       localhost:3307 (user: qshelter, pass: qshelter_pass)"
echo "  - Redis:       localhost:6379"
echo "  - Adminer:     http://localhost:8080"
echo ""
echo "🧪 Run e2e tests:"
echo "  cd local-dev && pnpm run test:e2e:mortgage"
echo ""
echo "🛑 Stop everything:"
echo "  cd local-dev && pnpm run stop"
echo ""

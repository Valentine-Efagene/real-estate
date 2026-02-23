#!/bin/bash
# =============================================================================
# QShelter LocalStack Full Setup Script
# =============================================================================
# This script sets up the complete local development environment:
# 1. Starts Docker containers (LocalStack, MySQL, Redis)
# 2. Deploys CDK infrastructure (SNS, SQS, S3, Secrets Manager, SSM)
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
until curl -s http://localhost:4566/_localstack/health | grep -qE '"s3": "(available|running)"' 2>/dev/null; do
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
    
    # Deploy with LocalStack-specific config (REST API v1 instead of HTTP API v2)
    # LocalStack Community doesn't support apigatewayv2, so we use serverless.localstack.yml
    npx sls deploy --config serverless.localstack.yml --stage localstack 2>&1 || log_warning "$service_name deployment had warnings"
    log_success "$service_name deployed"
  else
    log_warning "$service_name directory not found, skipping"
  fi
}

# Ensure all REST API stages exist (LocalStack sometimes drops stages on redeploy)
ensure_api_stages() {
  log_info "Ensuring REST API stages exist..."
  local ENDPOINT=http://localhost:4566

  local api_ids
  api_ids=$(aws --endpoint-url=$ENDPOINT apigateway get-rest-apis \
    --query 'items[*].id' --output text 2>/dev/null)

  for api_id in $api_ids; do
    local api_name
    api_name=$(aws --endpoint-url=$ENDPOINT apigateway get-rest-api \
      --rest-api-id "$api_id" --query 'name' --output text 2>/dev/null)
    local has_stage
    has_stage=$(aws --endpoint-url=$ENDPOINT apigateway get-stages \
      --rest-api-id "$api_id" --query 'item[?stageName==`localstack`].stageName' \
      --output text 2>/dev/null)
    
    if [ -z "$has_stage" ]; then
      log_warning "API $api_name ($api_id) missing 'localstack' stage — creating..."
      # Get the latest deployment
      local deployment_id
      deployment_id=$(aws --endpoint-url=$ENDPOINT apigateway get-deployments \
        --rest-api-id "$api_id" --query 'items[0].id' --output text 2>/dev/null)
      
      if [ -n "$deployment_id" ] && [ "$deployment_id" != "None" ]; then
        aws --endpoint-url=$ENDPOINT apigateway create-stage \
          --rest-api-id "$api_id" \
          --stage-name localstack \
          --deployment-id "$deployment_id" 2>/dev/null && \
          log_success "Created 'localstack' stage for $api_name" || \
          log_warning "Failed to create stage for $api_name"
      else
        log_warning "No deployments found for $api_name — skipping stage creation"
      fi
    fi
  done
  log_success "All API stages verified"
}

# Deploy services (user-service first — creates the HTTP API Gateway)
deploy_service "User Service" "user-service"
deploy_service "Property Service" "property-service"
deploy_service "Mortgage Service" "mortgage-service"
deploy_service "Documents Service" "documents-service"
deploy_service "Payment Service" "payment-service"
deploy_service "Notification Service" "notification-service"
deploy_service "Uploader Service" "uploader-service"

# Ensure all REST API stages exist (LocalStack can drop stages on redeploy)
ensure_api_stages

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

# Print usable service URLs
log_info "Service URLs (REST API v1):"
SERVICE_NAMES=("user-service" "property-service" "mortgage-service" "documents-service" "payment-service" "notification-service" "uploader-service")
SLS_SERVICE_NAMES=("qshelter-user-service" "qshelter-property-service" "qshelter-mortgage-service" "qshelter-documents-service" "qshelter-payment-service" "qshelter-notifications" "qshelter-uploader-service")
declare -A SERVICE_URLS

for i in "${!SLS_SERVICE_NAMES[@]}"; do
  sls_name="${SLS_SERVICE_NAMES[$i]}-localstack"
  svc_name="${SERVICE_NAMES[$i]}"
  api_id=$(aws --endpoint-url=$ENDPOINT apigateway get-rest-apis \
    --query "items[?name=='$sls_name'].id" --output text 2>/dev/null)
  if [ -n "$api_id" ] && [ "$api_id" != "None" ]; then
    url="http://localhost:4566/restapis/$api_id/localstack/_user_request_"
    SERVICE_URLS[$svc_name]="$url"
    echo "  - $svc_name: $url"
  else
    echo "  - $svc_name: NOT FOUND"
  fi
done

log_success "Deployment verified"

# Generate demo-frontend .env file
DEMO_ENV_FILE="$REPO_ROOT/../demo-frontend/.env"
if [ -d "$REPO_ROOT/../demo-frontend" ]; then
  log_info "Updating demo-frontend .env with service URLs..."
  cat > "$DEMO_ENV_FILE" <<EOF
# QShelter Demo Frontend - Environment Variables
# Auto-generated by setup.sh on $(date +%Y-%m-%d)
#
# LOCAL DEVELOPMENT (default target)
# Services run on LocalStack REST API Gateway (v1).

# Service URLs (LocalStack REST API Gateway)
# Pattern: http://localhost:4566/restapis/{api-id}/localstack/_user_request_
NEXT_PUBLIC_USER_SERVICE_URL=${SERVICE_URLS[user-service]:-http://localhost:3001}
NEXT_PUBLIC_PROPERTY_SERVICE_URL=${SERVICE_URLS[property-service]:-http://localhost:3002}
NEXT_PUBLIC_MORTGAGE_SERVICE_URL=${SERVICE_URLS[mortgage-service]:-http://localhost:3003}
NEXT_PUBLIC_DOCUMENTS_SERVICE_URL=${SERVICE_URLS[documents-service]:-http://localhost:3004}
NEXT_PUBLIC_PAYMENT_SERVICE_URL=${SERVICE_URLS[payment-service]:-http://localhost:3005}
NEXT_PUBLIC_NOTIFICATION_SERVICE_URL=${SERVICE_URLS[notification-service]:-http://localhost:3006}
NEXT_PUBLIC_UPLOADER_SERVICE_URL=${SERVICE_URLS[uploader-service]:-http://localhost:3007}

# App Config
NEXT_PUBLIC_APP_NAME=QShelter Demo
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cookie config (server-side only - no NEXT_PUBLIC_ prefix)
JWT_SECRET=your-jwt-secret-for-verification
COOKIE_NAME=qshelter_session
COOKIE_MAX_AGE=604800

NEXT_PUBLIC_GOOGLE_CLIENT_ID="857862406590-sjklejj2j5hqpr7tmgjutsos7ahn0dhf.apps.googleusercontent.com"
EOF
  log_success "demo-frontend .env updated"
fi

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

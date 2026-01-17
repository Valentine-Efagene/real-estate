#!/bin/bash
#
# Full LocalStack E2E Test Setup
#
# This script prepares the complete LocalStack environment for running
# the full E2E mortgage flow test. It handles:
# 1. Starting LocalStack and dependent services (MySQL, Redis)
# 2. Running database migrations
# 3. Deploying all services to LocalStack
# 4. Fixing API Gateway stages
# 5. Verifying the setup
#
# Prerequisites:
# - Docker running
# - pnpm/npm installed
# - AWS CLI installed
#
# Usage:
#   ./scripts/setup.sh           # Full setup from scratch
#   ./scripts/setup.sh --deploy  # Skip LocalStack start, just deploy services
#   ./scripts/setup.sh --verify  # Just verify the setup
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_LOCALSTACK_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(cd "$TESTS_LOCALSTACK_DIR/../.." && pwd)"
LOCAL_DEV_DIR="$PROJECT_ROOT/local-dev"
SERVICES_DIR="$PROJECT_ROOT/services"
SHARED_DIR="$PROJECT_ROOT/shared/common"

LOCALSTACK_ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
STAGE_NAME="localstack"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_step() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

echo_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Parse arguments
SKIP_START=false
VERIFY_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --deploy)
            SKIP_START=true
            shift
            ;;
        --verify)
            VERIFY_ONLY=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--deploy|--verify]"
            exit 1
            ;;
    esac
done

# =============================================================================
# Step 0: Verify Prerequisites
# =============================================================================
echo_step "Step 0: Verifying Prerequisites"

check_command() {
    if command -v "$1" &> /dev/null; then
        echo "  ✓ $1 found"
        return 0
    else
        echo_error "$1 not found. Please install it first."
        return 1
    fi
}

check_command docker
check_command aws
check_command node
check_command npm

# Check Docker is running
if docker info &> /dev/null; then
    echo "  ✓ Docker daemon is running"
else
    echo_error "Docker daemon is not running. Please start Docker."
    exit 1
fi

echo_success "Prerequisites verified"

# =============================================================================
# Verify Only Mode
# =============================================================================
if [ "$VERIFY_ONLY" = true ]; then
    echo_step "Verifying LocalStack Setup"
    
    # Check LocalStack health
    echo "Checking LocalStack health..."
    if curl -s "$LOCALSTACK_ENDPOINT/_localstack/health" | grep -q '"sqs": "available"'; then
        echo_success "LocalStack is healthy"
    else
        echo_error "LocalStack is not running or unhealthy"
        exit 1
    fi
    
    # Check API Gateways
    echo ""
    echo "Checking deployed API Gateways..."
    aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis \
        --query "items[*].[name, id]" --output table 2>/dev/null || {
        echo_error "Failed to list API Gateways"
        exit 1
    }
    
    echo ""
    echo_success "Verification complete!"
    exit 0
fi

# =============================================================================
# Step 1: Start LocalStack and Services
# =============================================================================
if [ "$SKIP_START" = false ]; then
    echo_step "Step 1: Starting LocalStack and Services"
    
    cd "$LOCAL_DEV_DIR"
    
    # Check if containers are already running
    if docker compose ps --format json 2>/dev/null | grep -q '"State":"running"'; then
        echo "  Some containers are already running..."
        echo "  Restarting to ensure clean state..."
        docker compose down --remove-orphans 2>/dev/null || true
    fi
    
    # Start containers
    echo "  Starting Docker containers..."
    docker compose up -d
    
    echo "  Waiting for services to be healthy..."
    
    # Wait for MySQL
    echo "    - Waiting for MySQL..."
    MYSQL_RETRIES=30
    while [ $MYSQL_RETRIES -gt 0 ]; do
        if docker exec qshelter-mysql mysqladmin ping -h localhost -u root -prootpassword --silent 2>/dev/null; then
            echo "    ✓ MySQL is ready"
            break
        fi
        MYSQL_RETRIES=$((MYSQL_RETRIES - 1))
        sleep 2
    done
    
    if [ $MYSQL_RETRIES -eq 0 ]; then
        echo_error "MySQL failed to start"
        exit 1
    fi
    
    # Wait for LocalStack
    echo "    - Waiting for LocalStack..."
    LOCALSTACK_RETRIES=30
    while [ $LOCALSTACK_RETRIES -gt 0 ]; do
        if curl -s "$LOCALSTACK_ENDPOINT/_localstack/health" | grep -q '"sqs": "available"' 2>/dev/null; then
            echo "    ✓ LocalStack is ready"
            break
        fi
        LOCALSTACK_RETRIES=$((LOCALSTACK_RETRIES - 1))
        sleep 2
    done
    
    if [ $LOCALSTACK_RETRIES -eq 0 ]; then
        echo_error "LocalStack failed to start"
        exit 1
    fi
    
    # Wait for Redis
    echo "    - Waiting for Redis..."
    REDIS_RETRIES=15
    while [ $REDIS_RETRIES -gt 0 ]; do
        if docker exec qshelter-redis redis-cli ping 2>/dev/null | grep -q PONG; then
            echo "    ✓ Redis is ready"
            break
        fi
        REDIS_RETRIES=$((REDIS_RETRIES - 1))
        sleep 1
    done
    
    if [ $REDIS_RETRIES -eq 0 ]; then
        echo_warning "Redis may not be ready, but continuing..."
    fi
    
    echo_success "LocalStack and services started"
else
    echo_step "Step 1: Skipped (--deploy mode)"
    
    # Verify LocalStack is running
    if ! curl -s "$LOCALSTACK_ENDPOINT/_localstack/health" | grep -q '"sqs": "available"' 2>/dev/null; then
        echo_error "LocalStack is not running. Run without --deploy flag first."
        exit 1
    fi
    echo_success "LocalStack is running"
fi

# =============================================================================
# Step 2: Deploy Infrastructure (CDK)
# =============================================================================
echo_step "Step 2: Deploying Infrastructure (CDK)"

cd "$PROJECT_ROOT/infrastructure"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "  Installing infrastructure dependencies..."
    pnpm install || npm install
fi

echo "  Bootstrapping CDK for LocalStack..."
pnpm localstack:bootstrap 2>/dev/null || npm run localstack:bootstrap 2>/dev/null || true

echo "  Deploying infrastructure..."
pnpm localstack:deploy || npm run localstack:deploy

echo "  Seeding role policies..."
ROLE_POLICIES_TABLE_NAME=qshelter-test-role-policies \
AWS_ENDPOINT_URL="$LOCALSTACK_ENDPOINT" \
node scripts/seed-role-policies.mjs 2>/dev/null || true

echo_success "Infrastructure deployed"

# =============================================================================
# Step 3: Run Database Migrations
# =============================================================================
echo_step "Step 3: Running Database Migrations"

cd "$SHARED_DIR"

# Load test environment
if [ -f "$LOCAL_DEV_DIR/.env.test" ]; then
    export $(grep -v '^#' "$LOCAL_DEV_DIR/.env.test" | grep -v '^\s*$' | xargs)
fi

# Also set explicit DATABASE_URL for Prisma
export DATABASE_URL="mysql://qshelter:qshelter_pass@127.0.0.1:3307/qshelter_test"

echo "  Installing shared/common dependencies..."
npm install 2>/dev/null || true

echo "  Generating Prisma client..."
npx prisma generate

echo "  Applying migrations..."
npx prisma migrate deploy || {
    echo_warning "Migration failed, trying to push schema directly..."
    npx prisma db push --accept-data-loss
}

echo_success "Database migrations complete"

# =============================================================================
# Step 4: Deploy All Services
# =============================================================================
echo_step "Step 4: Deploying All Services"

# Services to deploy (in order - authorizer first)
SERVICES=(
    "authorizer-service"
    "user-service"
    "property-service"
    "documents-service"
    "mortgage-service"
    "notification-service"
)

FAILED_SERVICES=""

deploy_service() {
    local service=$1
    local service_dir="$SERVICES_DIR/$service"
    
    if [ ! -d "$service_dir" ]; then
        echo_warning "Service directory not found: $service"
        return 1
    fi
    
    echo ""
    echo "  Deploying $service..."
    
    cd "$service_dir"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "    Installing dependencies..."
        npm install
    fi
    
    # Deploy to LocalStack
    if npm run deploy:localstack 2>&1 | tail -5; then
        echo "    ✓ $service deployed"
        return 0
    else
        echo_warning "$service deployment may have issues"
        FAILED_SERVICES="$FAILED_SERVICES $service"
        return 1
    fi
}

for service in "${SERVICES[@]}"; do
    deploy_service "$service" || true
done

if [ -n "$FAILED_SERVICES" ]; then
    echo_warning "Some services had issues:$FAILED_SERVICES"
else
    echo_success "All services deployed"
fi

# =============================================================================
# Step 5: Fix API Gateway Stages
# =============================================================================
echo_step "Step 5: Fixing API Gateway Stages"

echo "  Checking and creating missing stages..."

# Get all REST APIs
apis=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis \
    --query "items[*].[id,name]" --output text 2>/dev/null)

if [ -z "$apis" ]; then
    echo_warning "No API Gateways found"
else
    while IFS=$'\t' read -r api_id api_name; do
        # Check if stage exists
        stage_exists=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-stages \
            --rest-api-id "$api_id" \
            --query "item[?stageName=='$STAGE_NAME'].stageName" \
            --output text 2>/dev/null)
        
        if [ -z "$stage_exists" ] || [ "$stage_exists" = "None" ]; then
            # Get the latest deployment ID
            deployment_id=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-deployments \
                --rest-api-id "$api_id" \
                --query "items[0].id" \
                --output text 2>/dev/null)
            
            if [ -n "$deployment_id" ] && [ "$deployment_id" != "None" ]; then
                echo "    Creating stage '$STAGE_NAME' for $api_name..."
                aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway create-stage \
                    --rest-api-id "$api_id" \
                    --stage-name "$STAGE_NAME" \
                    --deployment-id "$deployment_id" > /dev/null 2>&1
                
                if [ $? -eq 0 ]; then
                    echo "    ✓ Stage created for $api_name"
                else
                    echo_warning "Failed to create stage for $api_name"
                fi
            else
                echo_warning "No deployment found for $api_name"
            fi
        else
            echo "    ✓ Stage exists for $api_name"
        fi
    done <<< "$apis"
fi

echo_success "API Gateway stages fixed"

# =============================================================================
# Step 6: Fix Lambda Event Source Mappings
# =============================================================================
echo_step "Step 6: Fixing Lambda Event Source Mappings"

# Define SQS consumer functions and their queue mappings
declare -a SQS_MAPPINGS=(
    "qshelter-notifications-localstack-sqsConsumer:qshelter-localstack-notifications"
)

for mapping in "${SQS_MAPPINGS[@]}"; do
    function_name="${mapping%%:*}"
    queue_name="${mapping##*:}"
    queue_arn="arn:aws:sqs:us-east-1:000000000000:$queue_name"
    
    # Check if function exists
    if ! aws --endpoint-url="$LOCALSTACK_ENDPOINT" lambda get-function \
        --function-name "$function_name" &>/dev/null; then
        echo "    Skipping $function_name (not deployed)"
        continue
    fi
    
    # Check if event source mapping already exists
    existing_mapping=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" lambda list-event-source-mappings \
        --function-name "$function_name" \
        --event-source-arn "$queue_arn" \
        --query "EventSourceMappings[0].UUID" \
        --output text 2>/dev/null)
    
    if [ -n "$existing_mapping" ] && [ "$existing_mapping" != "None" ]; then
        echo "    ✓ Event source mapping exists for $function_name"
    else
        echo "    Creating event source mapping for $function_name..."
        aws --endpoint-url="$LOCALSTACK_ENDPOINT" lambda create-event-source-mapping \
            --function-name "$function_name" \
            --event-source-arn "$queue_arn" \
            --batch-size 10 \
            --function-response-types ReportBatchItemFailures > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo "    ✓ Event source mapping created"
        else
            echo_warning "Failed to create event source mapping"
        fi
    fi
done

echo_success "Event source mappings fixed"

# =============================================================================
# Step 7: Install Test Dependencies
# =============================================================================
echo_step "Step 7: Installing Test Dependencies"

cd "$TESTS_LOCALSTACK_DIR"

echo "  Installing test dependencies..."
npm install

echo_success "Test dependencies installed"

# =============================================================================
# Step 8: Final Verification
# =============================================================================
echo_step "Step 8: Final Verification"

echo "  Checking deployed API Gateways..."
echo ""
aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis \
    --query "items[*].[name, id]" --output table 2>/dev/null

echo ""
echo "  Verifying service connectivity..."

get_api_url() {
    local service_name=$1
    local api_id=$(aws --endpoint-url="$LOCALSTACK_ENDPOINT" apigateway get-rest-apis \
        --query "items[?name=='$service_name'].id" \
        --output text 2>/dev/null)
    
    if [ -z "$api_id" ] || [ "$api_id" == "None" ]; then
        echo ""
        return 1
    fi
    
    echo "http://${api_id}.execute-api.localhost.localstack.cloud:4566/localstack"
}

USER_SERVICE_URL=$(get_api_url "qshelter-user-service-localstack")
PROPERTY_SERVICE_URL=$(get_api_url "qshelter-property-service-localstack")
MORTGAGE_SERVICE_URL=$(get_api_url "qshelter-mortgage-service-localstack")

if [ -n "$USER_SERVICE_URL" ]; then
    echo "    ✓ user-service: $USER_SERVICE_URL"
else
    echo_error "user-service not found"
fi

if [ -n "$PROPERTY_SERVICE_URL" ]; then
    echo "    ✓ property-service: $PROPERTY_SERVICE_URL"
else
    echo_error "property-service not found"
fi

if [ -n "$MORTGAGE_SERVICE_URL" ]; then
    echo "    ✓ mortgage-service: $MORTGAGE_SERVICE_URL"
else
    echo_error "mortgage-service not found"
fi

# =============================================================================
# Done!
# =============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "You can now run the E2E tests:"
echo ""
echo "  cd $TESTS_LOCALSTACK_DIR"
echo "  ./scripts/run-full-e2e-localstack.sh"
echo ""
echo "Or use npm:"
echo ""
echo "  npm run run:full-e2e"
echo ""

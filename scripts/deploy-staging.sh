#!/bin/bash
# Deploy QShelter to AWS Staging Environment
# Usage: ./deploy-staging.sh [step]
# Steps: clean, bootstrap, infra, migrations, authorizer, services, seed, test, all
#
# CRITICAL LEARNINGS (from deployment debugging):
# 1. CDK bootstrap can fail if orphaned resources exist from previous failed deployments
#    - Orphaned S3 bucket: cdk-hnb659fds-assets-{account}-{region}
#    - Orphaned IAM role: cdk-hnb659fds-cfn-exec-role-{account}-{region}
#    - CDKToolkit stack stuck in REVIEW_IN_PROGRESS
# 2. CloudFormation does NOT support SSM SecureString parameters - use Secrets Manager instead
# 3. The http-api-id SSM parameter is created by user-service (not CDK infra)
# 4. RDS security group needs ingress rule for local IP to run migrations
# 5. Authorizer ARN must be stored in SSM after deploying authorizer-service
# 6. SSM pagination: ConfigService MUST paginate (MaxResults default=10, we have 20+ params)
# 7. AWS_PROFILE conflicts: Serverless Framework may use different credentials than AWS CLI
#    - Always export AWS_PROFILE to ensure consistent credentials
# 8. npm husky errors: Use --ignore-scripts if postinstall fails
# 9. Health endpoints: Add explicit /health route in serverless.yml (not prefixed with service path)
# 10. esbuild: Output must match serverless.yml handler exactly (outfile: 'dist/lambda.mjs')
# 11. Policy sync: SNS topic/queue/subscription created by CDK (not policy-sync-service)
#     - SSM params: policy-sync-topic-arn, policy-sync-queue-arn, policy-sync-queue-url
#     - Services reference via SSM, policy-sync-service just subscribes to existing queue
# 12. Async policy sync: After bootstrap, wait ~3s for SNS->SQS->Lambda->DynamoDB sync

set -e

# CRITICAL: Export AWS_PROFILE to ensure Serverless Framework uses same credentials as AWS CLI
export AWS_PROFILE="${AWS_PROFILE:-default}"

STAGE="staging"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGION="us-east-1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}========================================${NC}\n"; }

# Check AWS credentials
check_aws() {
    log_info "Checking AWS credentials..."
    log_info "Using AWS_PROFILE=$AWS_PROFILE"
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        log_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    log_info "Deploying to AWS Account: $ACCOUNT_ID (Region: $REGION)"
}

# Install dependencies for a service
# Uses --ignore-scripts to avoid husky postinstall errors
install_deps() {
    local service_path=$1
    if [ -f "$service_path/package.json" ]; then
        log_info "Installing dependencies in $service_path..."
        cd "$service_path"
        npm install --silent --ignore-scripts || {
            log_warn "npm install with --ignore-scripts still failed, trying without --silent..."
            npm install --ignore-scripts
        }
    fi
}

# ============================================================================
# STEP 0: Clean up orphaned CDK resources from failed deployments
# ============================================================================
clean_cdk_orphans() {
    log_step "Step 0: Cleaning up orphaned CDK resources"
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Delete any stuck CDKToolkit stack
    if aws cloudformation describe-stacks --stack-name CDKToolkit &>/dev/null; then
        STACK_STATUS=$(aws cloudformation describe-stacks --stack-name CDKToolkit --query "Stacks[0].StackStatus" --output text 2>/dev/null)
        if [[ "$STACK_STATUS" == "REVIEW_IN_PROGRESS" || "$STACK_STATUS" == "ROLLBACK_COMPLETE" || "$STACK_STATUS" == "ROLLBACK_FAILED" ]]; then
            log_warn "CDKToolkit in bad state ($STACK_STATUS), deleting..."
            aws cloudformation delete-stack --stack-name CDKToolkit
            log_info "Waiting for CDKToolkit deletion..."
            aws cloudformation wait stack-delete-complete --stack-name CDKToolkit 2>/dev/null || true
        fi
    fi
    
    # Clean up orphaned CDK S3 bucket (versioned bucket needs special handling)
    CDK_BUCKET="cdk-hnb659fds-assets-${ACCOUNT_ID}-${REGION}"
    if aws s3api head-bucket --bucket "$CDK_BUCKET" 2>/dev/null; then
        log_warn "Found orphaned CDK bucket: $CDK_BUCKET, cleaning..."
        
        # Delete all object versions
        VERSIONS=$(aws s3api list-object-versions --bucket "$CDK_BUCKET" --query '{Objects: Versions[].{Key: Key, VersionId: VersionId}}' --output json 2>/dev/null)
        if [[ "$VERSIONS" != '{"Objects": null}' && "$VERSIONS" != '{"Objects": []}' ]]; then
            echo "$VERSIONS" | aws s3api delete-objects --bucket "$CDK_BUCKET" --delete file:///dev/stdin 2>/dev/null || true
        fi
        
        # Delete all delete markers
        MARKERS=$(aws s3api list-object-versions --bucket "$CDK_BUCKET" --query '{Objects: DeleteMarkers[].{Key: Key, VersionId: VersionId}}' --output json 2>/dev/null)
        if [[ "$MARKERS" != '{"Objects": null}' && "$MARKERS" != '{"Objects": []}' ]]; then
            echo "$MARKERS" | aws s3api delete-objects --bucket "$CDK_BUCKET" --delete file:///dev/stdin 2>/dev/null || true
        fi
        
        aws s3 rb "s3://$CDK_BUCKET" --force 2>/dev/null || true
        log_info "CDK bucket deleted"
    fi
    
    # Clean up orphaned CDK IAM roles
    CDK_ROLE="cdk-hnb659fds-cfn-exec-role-${ACCOUNT_ID}-${REGION}"
    if aws iam get-role --role-name "$CDK_ROLE" &>/dev/null; then
        log_warn "Found orphaned CDK role: $CDK_ROLE, deleting..."
        # Detach all policies first
        for policy_arn in $(aws iam list-attached-role-policies --role-name "$CDK_ROLE" --query "AttachedPolicies[].PolicyArn" --output text 2>/dev/null); do
            aws iam detach-role-policy --role-name "$CDK_ROLE" --policy-arn "$policy_arn" 2>/dev/null || true
        done
        aws iam delete-role --role-name "$CDK_ROLE" 2>/dev/null || true
        log_info "CDK role deleted"
    fi
    
    # Clean up stuck RealEstateStack
    if aws cloudformation describe-stacks --stack-name RealEstateStack &>/dev/null; then
        STACK_STATUS=$(aws cloudformation describe-stacks --stack-name RealEstateStack --query "Stacks[0].StackStatus" --output text)
        if [[ "$STACK_STATUS" == "REVIEW_IN_PROGRESS" || "$STACK_STATUS" == "ROLLBACK_COMPLETE" ]]; then
            log_warn "RealEstateStack in bad state ($STACK_STATUS), deleting..."
            aws cloudformation delete-stack --stack-name RealEstateStack
            log_info "Waiting for RealEstateStack deletion..."
            aws cloudformation wait stack-delete-complete --stack-name RealEstateStack
        fi
    fi
    
    log_info "✅ CDK cleanup complete!"
}

# ============================================================================
# STEP 1: Bootstrap CDK
# ============================================================================
bootstrap_cdk() {
    log_step "Step 1: Bootstrapping CDK"
    cd "$ROOT_DIR/infrastructure"
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Check if the CDK assets bucket exists - if not, force a fresh bootstrap
    CDK_BUCKET="cdk-hnb659fds-assets-${ACCOUNT_ID}-${REGION}"
    if ! aws s3api head-bucket --bucket "$CDK_BUCKET" 2>/dev/null; then
        log_warn "CDK assets bucket does not exist. Forcing fresh bootstrap..."
        # Delete CDKToolkit stack if it exists to force complete re-bootstrap
        if aws cloudformation describe-stacks --stack-name CDKToolkit &>/dev/null; then
            log_info "Deleting existing CDKToolkit stack to force fresh bootstrap..."
            aws cloudformation delete-stack --stack-name CDKToolkit
            aws cloudformation wait stack-delete-complete --stack-name CDKToolkit 2>/dev/null || true
        fi
    fi
    
    log_info "Bootstrapping CDK for account $ACCOUNT_ID in region $REGION..."
    npx cdk bootstrap "aws://${ACCOUNT_ID}/${REGION}" --context stage=$STAGE
    
    # Verify bucket was created
    if ! aws s3api head-bucket --bucket "$CDK_BUCKET" 2>/dev/null; then
        log_error "CDK bootstrap failed - assets bucket not created"
        exit 1
    fi
    
    log_info "✅ CDK bootstrap complete!"
}

# ============================================================================
# STEP 2: Deploy CDK infrastructure
# ============================================================================
deploy_infra() {
    log_step "Step 2: Deploying CDK Infrastructure"
    cd "$ROOT_DIR/infrastructure"
    
    # Ensure .env has correct stage
    if [ -f .env ]; then
        sed -i.bak "s/^STAGE=.*/STAGE=$STAGE/" .env
        rm -f .env.bak
    else
        echo "STAGE=$STAGE" > .env
    fi
    
    install_deps "$ROOT_DIR/infrastructure"
    
    # Deploy stack
    log_info "Deploying RealEstateStack..."
    npx cdk deploy --all --context stage=$STAGE --require-approval never --outputs-file cdk-outputs.json
    
    log_info "✅ Infrastructure deployed!"
    
    # Show key outputs
    if [ -f cdk-outputs.json ]; then
        log_info "CDK Outputs saved to infrastructure/cdk-outputs.json"
        cat cdk-outputs.json | jq '.RealEstateStack' 2>/dev/null || true
    fi
}

# ============================================================================
# STEP 3: Run database migrations
# ============================================================================
run_migrations() {
    log_step "Step 3: Running Database Migrations"
    cd "$ROOT_DIR/shared/common"
    
    install_deps "$ROOT_DIR/shared/common"
    
    # Get database credentials from Secrets Manager
    log_info "Fetching database credentials from AWS..."
    DB_SECRET_ARN=$(aws ssm get-parameter --name "/qshelter/$STAGE/database-secret-arn" --query "Parameter.Value" --output text)
    DB_SECRET=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ARN" --query "SecretString" --output text)
    
    DB_HOST=$(echo "$DB_SECRET" | jq -r '.host')
    DB_PORT=$(echo "$DB_SECRET" | jq -r '.port')
    DB_USER=$(echo "$DB_SECRET" | jq -r '.username')
    DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password')
    DB_NAME=$(echo "$DB_SECRET" | jq -r '.dbname')
    
    # CRITICAL: Add security group ingress rule for local IP
    log_info "Adding current IP to RDS security group for local access..."
    MY_IP=$(curl -s ifconfig.me)
    SG_ID=$(aws ssm get-parameter --name "/qshelter/$STAGE/db-security-group-id" --query "Parameter.Value" --output text)
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 3306 --cidr "${MY_IP}/32" 2>/dev/null || log_warn "Security group rule may already exist (this is OK)"
    
    # Build DATABASE_URL
    export DATABASE_URL="mysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    
    log_info "Running Prisma migrations against Aurora MySQL at $DB_HOST..."
    npx prisma migrate deploy
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    npx prisma generate
    
    log_info "✅ Migrations complete!"
}

# ============================================================================
# STEP 3.5: Update common package in all services (ensures latest fixes)
# ============================================================================
update_common_package() {
    log_step "Step 3.5: Updating @valentine-efagene/qshelter-common in all services"
    
    SERVICES=(
        "authorizer-service"
        "user-service"
        "property-service"
        "mortgage-service"
        "documents-service"
        "notification-service"
        "payment-service"
        "policy-sync-service"
    )
    
    for service in "${SERVICES[@]}"; do
        if [ -d "$ROOT_DIR/services/$service" ]; then
            log_info "Updating common package in $service..."
            cd "$ROOT_DIR/services/$service"
            npm install @valentine-efagene/qshelter-common@latest --ignore-scripts --save 2>/dev/null || \
                log_warn "$service: Could not update common package (may not use it)"
        fi
    done
    
    log_info "✅ Common package updated in all services!"
}

# ============================================================================
# STEP 4: Deploy authorizer service (must be first, before other services)
# ============================================================================
deploy_authorizer() {
    log_step "Step 4: Deploying Authorizer Service"
    cd "$ROOT_DIR/services/authorizer-service"
    
    install_deps "$ROOT_DIR/services/authorizer-service"
    
    log_info "Deploying authorizer-service to AWS..."
    npx serverless deploy --stage $STAGE
    
    # CRITICAL: Store authorizer Lambda ARN in SSM for other services to reference
    log_info "Storing authorizer Lambda ARN in SSM..."
    AUTHORIZER_ARN=$(aws lambda get-function --function-name "qshelter-authorizer-$STAGE" --query "Configuration.FunctionArn" --output text)
    aws ssm put-parameter --name "/qshelter/$STAGE/authorizer-lambda-arn" --value "$AUTHORIZER_ARN" --type String --overwrite
    
    log_info "Authorizer ARN: $AUTHORIZER_ARN"
    log_info "✅ Authorizer deployed!"
}

# ============================================================================
# STEP 5: Deploy all other services
# ============================================================================
deploy_services() {
    log_step "Step 5: Deploying Application Services"
    
    # Order matters: user-service creates the HTTP API Gateway
    # Other services attach to it via the http-api-id SSM parameter
    SERVICES=(
        "user-service"
        "property-service"
        "mortgage-service"
        "documents-service"
        "notification-service"
        "payment-service"
        "policy-sync-service"
    )
    
    FAILED_SERVICES=()
    
    for service in "${SERVICES[@]}"; do
        if [ -d "$ROOT_DIR/services/$service" ]; then
            log_info "Deploying $service..."
            cd "$ROOT_DIR/services/$service"
            
            install_deps "$ROOT_DIR/services/$service"
            
            # Deploy (skip build - serverless handles bundling)
            if npx serverless deploy --stage $STAGE; then
                log_info "✅ $service deployed!"
            else
                log_error "❌ $service deployment failed!"
                FAILED_SERVICES+=("$service")
            fi
        else
            log_warn "Skipping $service (directory not found)"
        fi
    done
    
    if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
        log_error "Failed services: ${FAILED_SERVICES[*]}"
        return 1
    fi
    
    # Display API endpoint
    API_ID=$(aws ssm get-parameter --name "/qshelter/$STAGE/http-api-id" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    if [[ -n "$API_ID" && "$API_ID" != "None" ]]; then
        log_info "API Endpoint: https://${API_ID}.execute-api.${REGION}.amazonaws.com"
    fi
    
    log_info "✅ All services deployed!"
}

# ============================================================================
# STEP 6: Seed initial data (roles, policies)
# ============================================================================
seed_data() {
    log_step "Step 6: Seeding Initial Data"
    cd "$ROOT_DIR/infrastructure"
    
    if [ -f "scripts/seed-role-policies.mjs" ]; then
        log_info "Seeding role policies to DynamoDB..."
        
        # Get the DynamoDB table name from SSM
        TABLE_NAME=$(aws ssm get-parameter --name "/qshelter/$STAGE/role-policies-table" --query "Parameter.Value" --output text 2>/dev/null || echo "")
        if [[ -z "$TABLE_NAME" || "$TABLE_NAME" == "None" ]]; then
            log_warn "Role policies table name not found in SSM, using default..."
            TABLE_NAME="qshelter-${STAGE}-role-policies"
        fi
        
        log_info "Using DynamoDB table: $TABLE_NAME"
        ROLE_POLICIES_TABLE_NAME="$TABLE_NAME" node scripts/seed-role-policies.mjs --stage $STAGE
    else
        log_warn "Seed script not found, skipping..."
    fi
    
    log_info "✅ Data seeded!"
}

# ============================================================================
# STEP 6.5: Wait for services to be ready
# ============================================================================
wait_for_services() {
    log_step "Waiting for Services to be Ready"
    
    # Get API endpoint
    API_ID=$(aws ssm get-parameter --name "/qshelter/$STAGE/http-api-id" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    if [[ -z "$API_ID" || "$API_ID" == "None" ]]; then
        log_warn "HTTP API ID not found in SSM, skipping health check polling"
        return 0
    fi
    
    local API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"
    local MAX_ATTEMPTS=30
    local WAIT_SECONDS=5
    local attempt=1
    
    log_info "Polling health endpoint: $API_URL/health"
    log_info "Max attempts: $MAX_ATTEMPTS (${WAIT_SECONDS}s interval)"
    
    while [ $attempt -le $MAX_ATTEMPTS ]; do
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
        
        if [ "$HTTP_STATUS" = "200" ]; then
            log_info "✅ Services are healthy (HTTP 200) after $((attempt * WAIT_SECONDS))s"
            return 0
        else
            if [ $attempt -eq $MAX_ATTEMPTS ]; then
                log_warn "⚠️ Services not healthy after $((attempt * WAIT_SECONDS))s (HTTP $HTTP_STATUS)"
                log_warn "Proceeding anyway - tests may fail if services aren't ready"
                return 1
            fi
            echo -n "."
            sleep $WAIT_SECONDS
            attempt=$((attempt + 1))
        fi
    done
}

# Print service endpoints
print_endpoints() {
    echo ""
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}  QShelter Staging Deployment Complete${NC}"
    echo -e "${GREEN}==========================================${NC}"
    echo ""
    
    log_info "Fetching service endpoints..."
    
    SERVICES=(
        "authorizer-service"
        "user-service"
        "property-service"
        "mortgage-service"
        "documents-service"
        "notification-service"
    )
    
    for service in "${SERVICES[@]}"; do
        if [ -d "$ROOT_DIR/services/$service" ]; then
            cd "$ROOT_DIR/services/$service"
            ENDPOINT=$(npx sls info --stage $STAGE 2>/dev/null | grep -o 'https://[^[:space:]]*' | head -1 || echo "N/A")
            echo "  $service: $ENDPOINT"
        fi
    done
    
    echo ""
    echo -e "${GREEN}Stage: $STAGE${NC}"
    echo -e "${GREEN}Region: ${REGION:-us-east-1}${NC}"
    echo -e "${GREEN}==========================================${NC}"
}

# Show usage
show_usage() {
    echo "Usage: $0 [step]"
    echo ""
    echo "Steps:"
    echo "  clean         - Clean up orphaned CDK resources from failed deployments"
    echo "  bootstrap     - Bootstrap CDK in AWS account"
    echo "  infra         - Deploy CDK infrastructure (VPC, RDS, DynamoDB, etc.)"
    echo "  migrations    - Run Prisma database migrations"
    echo "  update-common - Update @valentine-efagene/qshelter-common in all services"
    echo "  authorizer    - Deploy authorizer service"
    echo "  services      - Deploy all application services"
    echo "  seed          - Seed initial data (roles, policies)"
    echo "  all           - Run ALL deployment steps (clean → bootstrap → infra → migrations → authorizer → services → seed → health check)"
    echo ""
    echo "Examples:"
    echo "  $0 all             # Full deployment (recommended for first time)"
    echo "  $0 services        # Redeploy services only"
    echo "  $0 update-common   # Update common package in all services"
    echo ""
    echo "Note: Tests are separate. After deployment, run: cd tests/aws && bash scripts/run-full-e2e-staging.sh"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_PROFILE  - AWS profile to use (default: 'default')"
}

# Main
STEP="${1:-all}"

case $STEP in
    clean)
        check_aws
        clean_cdk_orphans
        ;;
    bootstrap)
        check_aws
        bootstrap_cdk
        ;;
    infra)
        check_aws
        deploy_infra
        ;;
    migrations)
        check_aws
        run_migrations
        ;;
    update-common)
        check_aws
        update_common_package
        ;;
    authorizer)
        check_aws
        deploy_authorizer
        ;;
    services)
        check_aws
        deploy_services
        ;;
    seed)
        check_aws
        seed_data
        ;;
    all)
        check_aws
        clean_cdk_orphans
        bootstrap_cdk
        deploy_infra
        run_migrations
        update_common_package
        deploy_authorizer
        deploy_services
        seed_data
        wait_for_services
        print_endpoints
        
        log_success "🎉 Full deployment complete!"
        log_info ""
        log_info "To run E2E tests, execute: cd tests/aws && bash scripts/run-full-e2e-staging.sh"
        ;;
    -h|--help|help)
        show_usage
        exit 0
        ;;
    *)
        log_error "Unknown step: $STEP"
        show_usage
        exit 1
        ;;
esac
        log_error "Unknown step: $STEP"
        show_usage
        exit 1
        ;;
esac

echo ""
log_info "🎉 Deployment step '$STEP' complete!"

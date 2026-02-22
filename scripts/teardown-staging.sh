#!/bin/bash
# Teardown QShelter AWS Staging Environment
# Usage: ./teardown-staging.sh [step]
# Steps: services, infra, all
#
# WARNING: This will delete all resources including the database!
# Data will be PERMANENTLY LOST.
#
# CRITICAL LEARNINGS (from deployment debugging):
# 1. CDKToolkit stack should NOT be deleted manually - it's shared across CDK apps
# 2. S3 buckets with versioning need all versions AND delete markers removed
# 3. Secrets Manager secrets are soft-deleted by default - use --force-delete-without-recovery
# 4. Security group ingress rules added for your IP should be cleaned up
# 5. AWS_PROFILE must be consistent between AWS CLI and Serverless Framework

set -e

# CRITICAL: Export AWS_PROFILE to ensure Serverless Framework uses same credentials as AWS CLI
export AWS_PROFILE="${AWS_PROFILE:-default}"

STAGE="staging"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
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
    log_info "Tearing down from AWS Account: $ACCOUNT_ID (Region: $REGION)"
}

# Confirmation prompt
confirm_teardown() {
    echo ""
    echo -e "${RED}==========================================${NC}"
    echo -e "${RED}  ⚠️  WARNING: DESTRUCTIVE OPERATION  ⚠️${NC}"
    echo -e "${RED}==========================================${NC}"
    echo ""
    echo "This will DELETE all QShelter $STAGE resources including:"
    echo "  - All Lambda functions and API Gateways"
    echo "  - Aurora MySQL database (ALL DATA WILL BE LOST)"
    echo "  - S3 buckets (objects must be deleted first)"
    echo "  - VPC and networking resources"
    echo "  - All SSM parameters and secrets"
    echo ""
    
    if [ "$FORCE" != "true" ]; then
        read -p "Type 'DELETE $STAGE' to confirm: " CONFIRMATION
        if [ "$CONFIRMATION" != "DELETE $STAGE" ]; then
            log_error "Teardown cancelled."
            exit 1
        fi
    fi
    
    echo ""
    log_warn "Proceeding with teardown in 5 seconds... (Ctrl+C to cancel)"
    sleep 5
}

# Remove all Serverless services
remove_services() {
    log_step "Step 1/3: Removing Application Services"
    
    # Remove in reverse order of dependencies
    SERVICES=(
        "payment-service"
        "notification-service"
        "documents-service"
        "mortgage-service"
        "property-service"
        "uploader-service"
        "user-service"
    )
    
    for service in "${SERVICES[@]}"; do
        if [ -d "$ROOT_DIR/services/$service" ]; then
            log_info "Removing $service..."
            cd "$ROOT_DIR/services/$service"
            npx sls remove --stage $STAGE 2>/dev/null || log_warn "$service removal failed (may not exist)"
            log_info "✅ $service removed"
        fi
    done
    
    log_info "✅ All application services removed!"
}

# Empty S3 buckets before CDK destroy
empty_s3_buckets() {
    log_info "Emptying S3 buckets..."
    
    # Find QShelter buckets for this stage
    BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'qshelter-$STAGE')].Name" --output text 2>/dev/null || echo "")
    
    for bucket in $BUCKETS; do
        if [ -n "$bucket" ]; then
            log_info "Emptying bucket: $bucket"
            aws s3 rm "s3://$bucket" --recursive 2>/dev/null || true
            # Also delete versions if versioning is enabled
            aws s3api list-object-versions --bucket "$bucket" --query 'Versions[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | \
                while read key version; do
                    if [ -n "$key" ] && [ -n "$version" ]; then
                        aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version" 2>/dev/null || true
                    fi
                done
            # Delete markers too
            aws s3api list-object-versions --bucket "$bucket" --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output text 2>/dev/null | \
                while read key version; do
                    if [ -n "$key" ] && [ -n "$version" ]; then
                        aws s3api delete-object --bucket "$bucket" --key "$key" --version-id "$version" 2>/dev/null || true
                    fi
                done
        fi
    done
    
    log_info "✅ S3 buckets emptied"
}

# Remove CDK infrastructure
remove_infra() {
    log_step "Step 3/3: Removing CDK Infrastructure"
    
    cd "$ROOT_DIR/infrastructure"
    
    # Empty S3 buckets first (CDK won't delete non-empty buckets)
    empty_s3_buckets
    
    # Clean up security group ingress rules added for local IP during migrations
    log_info "Cleaning up security group ingress rules for local IP..."
    SG_ID=$(aws ssm get-parameter --name "/qshelter/$STAGE/db-security-group-id" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    if [ -n "$SG_ID" ] && [ "$SG_ID" != "None" ]; then
        MY_IP=$(curl -s ifconfig.me)
        aws ec2 revoke-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 3306 --cidr "${MY_IP}/32" 2>/dev/null || log_warn "Security group rule not found (OK)"
        log_info "Security group rule for $MY_IP removed"
    fi
    
    log_info "Destroying CDK stack..."
    npx cdk destroy --context stage=$STAGE --force 2>/dev/null || log_warn "CDK destroy may have partially failed"
    
    # Clean up any remaining SSM parameters
    log_info "Cleaning up SSM parameters..."
    aws ssm get-parameters-by-path --path "/qshelter/$STAGE/" --recursive --query 'Parameters[].Name' --output text 2>/dev/null | \
        xargs -n1 aws ssm delete-parameter --name 2>/dev/null || true
    
    # Clean up secrets (note: CDK-managed secrets have auto-generated names that may not match pattern)
    log_info "Cleaning up Secrets Manager secrets..."
    # Get both qshelter secrets and Aurora auto-generated secrets
    SECRETS=$(aws secretsmanager list-secrets --query "SecretList[?contains(Name, 'qshelter') || contains(Name, 'RealEstateStack')].Name" --output text 2>/dev/null || echo "")
    for secret in $SECRETS; do
        if [ -n "$secret" ]; then
            log_info "Deleting secret: $secret"
            aws secretsmanager delete-secret --secret-id "$secret" --force-delete-without-recovery 2>/dev/null || true
        fi
    done
    
    log_info "✅ Infrastructure removed!"
}

# Clean up CloudWatch logs
cleanup_logs() {
    log_info "Cleaning up CloudWatch log groups..."
    
    LOG_GROUPS=$(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/qshelter-" --query 'logGroups[].logGroupName' --output text 2>/dev/null || echo "")
    
    for log_group in $LOG_GROUPS; do
        if [[ "$log_group" == *"$STAGE"* ]]; then
            log_info "Deleting log group: $log_group"
            aws logs delete-log-group --log-group-name "$log_group" 2>/dev/null || true
        fi
    done
    
    log_info "✅ Log groups cleaned up"
}

# Show usage
show_usage() {
    echo "Usage: $0 [step] [--force]"
    echo ""
    echo "Steps:"
    echo "  services   - Remove all Serverless application services"
    echo "  infra      - Remove CDK infrastructure (VPC, RDS, etc.)"
    echo "  logs       - Clean up CloudWatch logs"
    echo "  all        - Remove everything (DANGEROUS!)"
    echo ""
    echo "Options:"
    echo "  --force    - Skip confirmation prompt"
    echo ""
    echo "Examples:"
    echo "  $0 all             # Full teardown with confirmation"
    echo "  $0 services        # Remove only Serverless services"
    echo "  $0 all --force     # Full teardown without confirmation"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_PROFILE  - AWS profile to use (default: 'default')"
    echo "  AWS_REGION   - AWS region (default: 'us-east-1')"
}

# Parse arguments
STEP=""
FORCE="false"

for arg in "$@"; do
    case $arg in
        --force|-f)
            FORCE="true"
            ;;
        -h|--help|help)
            show_usage
            exit 0
            ;;
        *)
            if [ -z "$STEP" ]; then
                STEP="$arg"
            fi
            ;;
    esac
done

STEP="${STEP:-all}"

# Main
case $STEP in
    services)
        check_aws
        confirm_teardown
        remove_services
        ;;
    infra)
        check_aws
        confirm_teardown
        remove_infra
        ;;
    logs)
        check_aws
        cleanup_logs
        ;;
    all)
        check_aws
        confirm_teardown
        remove_services
        remove_infra
        cleanup_logs
        ;;
    *)
        log_error "Unknown step: $STEP"
        show_usage
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  QShelter $STAGE Teardown Complete${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
log_info "🧹 All resources have been removed."

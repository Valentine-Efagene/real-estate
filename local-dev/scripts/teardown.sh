#!/bin/bash
# =============================================================================
# QShelter LocalStack Teardown Script
# =============================================================================
# This script completely tears down the local development environment:
# 1. Stops and removes all Docker containers
# 2. Removes Docker volumes (MySQL data, LocalStack state)
# 3. Clears LocalStack persistent data
# 4. Optionally resets the database schema
#
# Usage:
#   ./scripts/teardown.sh          # Full teardown
#   ./scripts/teardown.sh --keep-db  # Keep MySQL data, reset LocalStack only
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

# Parse arguments
KEEP_DB=false
for arg in "$@"; do
  case $arg in
    --keep-db)
      KEEP_DB=true
      shift
      ;;
  esac
done

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     🧹 QShelter LocalStack Teardown                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ "$KEEP_DB" = true ]; then
  log_warning "Keeping MySQL data (--keep-db flag set)"
else
  log_warning "This will DELETE all local data including MySQL!"
  echo ""
  read -p "Are you sure you want to continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Teardown cancelled"
    exit 0
  fi
fi

echo ""

# =============================================================================
# STEP 1: Stop Docker containers
# =============================================================================
log_info "Stopping Docker containers..."
cd "$LOCAL_DEV_DIR"

if [ "$KEEP_DB" = true ]; then
  # Stop only LocalStack, keep MySQL running
  docker compose stop localstack 2>/dev/null || true
  docker compose rm -f localstack 2>/dev/null || true
else
  # Stop all containers and remove volumes
  docker compose down -v 2>/dev/null || true
fi

log_success "Docker containers stopped"

# =============================================================================
# STEP 2: Clear LocalStack persistent data
# =============================================================================
log_info "Clearing LocalStack persistent data..."

if [ -d "$LOCAL_DEV_DIR/localstack-data" ]; then
  rm -rf "$LOCAL_DEV_DIR/localstack-data"/*
  log_success "LocalStack data cleared"
else
  log_info "No LocalStack data directory found"
fi

# =============================================================================
# STEP 3: Clear serverless deployment caches
# =============================================================================
log_info "Clearing serverless deployment caches..."

for service_dir in "$REPO_ROOT/services"/*; do
  if [ -d "$service_dir/.serverless" ]; then
    rm -rf "$service_dir/.serverless"
    log_info "  Cleared $(basename "$service_dir")/.serverless"
  fi
done

log_success "Serverless caches cleared"

# =============================================================================
# STEP 4: Reset database (if not keeping)
# =============================================================================
if [ "$KEEP_DB" = false ]; then
  log_info "Database will be recreated on next setup"
else
  log_info "MySQL data preserved"
fi

# =============================================================================
# DONE!
# =============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     🧹 Teardown Complete!                                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "To start fresh, run:"
echo "  cd local-dev && ./scripts/setup.sh"
echo ""

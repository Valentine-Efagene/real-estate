# MediaCraft API Docker Management
.PHONY: help build up down logs shell test clean dev prod

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development commands
dev: ## Start development environment
	docker compose --profile dev up

dev-build: ## Build and start development environment
	docker compose --profile dev up --build

dev-bg: ## Start development environment in background
	docker compose --profile dev up -d

# Production commands
prod: ## Start production environment
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-build: ## Build and start production environment
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# General commands
build: ## Build all services
	docker compose build

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

restart: ## Restart all services
	$(MAKE) down
	$(MAKE) up

# Utility commands
logs: ## Show logs for all services
	docker compose logs -f

logs-app: ## Show logs for app service
	docker compose logs -f app-dev

logs-db: ## Show logs for database service
	docker compose logs -f mysql

logs-redis: ## Show logs for redis service
	docker compose logs -f redis

shell: ## Access app container shell
	docker compose exec app-dev sh

shell-db: ## Access database shell
	docker compose exec mysql mysql -u root -p

# Testing commands
test: ## Run tests in container
	docker compose exec app-dev npm run test

test-e2e: ## Run e2e tests in container
	docker compose exec app-dev npm run test:e2e

test-cov: ## Run test coverage in container
	docker compose exec app-dev npm run test:cov

# Database commands
db-migrate: ## Run database migrations
	docker compose exec app-dev npm run migration:run

db-generate: ## Generate new migration (use name=MigrationName)
	docker compose exec app-dev npm run migration:generate -- $(name)

db-reset: ## Reset database (WARNING: destroys data)
	docker compose down
	docker volume rm mediacraft-api_mysql_data
	docker compose up -d mysql
	sleep 30
	$(MAKE) db-migrate

# Maintenance commands
clean: ## Remove all containers and volumes (WARNING: destroys data)
	docker compose down -v
	docker system prune -f

clean-build: ## Clean build cache and rebuild
	docker compose build --no-cache

ps: ## Show running containers
	docker compose ps

status: ## Show service status and health
	docker compose ps
	@echo "\nContainer Stats:"
	docker stats --no-stream

# Setup commands
setup: ## Initial setup (copy env file)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file from template. Please edit it with your configuration."; \
	else \
		echo ".env file already exists."; \
	fi

# Development helpers
watch: ## Watch logs for all services
	docker compose logs -f

install: ## Install new npm packages (use pkg=package-name)
	docker compose exec app-dev npm install $(pkg)
	docker compose restart app-dev

lint: ## Run linting
	docker compose exec app-dev npm run lint

format: ## Format code
	docker compose exec app-dev npm run format
# Docker Setup Guide

This guide explains how to run the MediaCraft API using Docker and Docker Compose.

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

## Quick Start

1. **Clone the repository and navigate to the project directory**

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```
3. **Edit the .env file with your configuration values**

   - Set secure passwords for `DB_PASSWORD`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
   - Configure AWS S3 credentials if using file uploads
   - Set encryption keys for `ENCRYPTION_PASSWORD` and `ENCRYPTION_SALT`

4. **Start the development environment**
   ```bash
   docker-compose up -d
   ```

## Available Commands

### Development Environment

```bash
# Start development environment with hot reloading
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f app-dev

# Stop services
docker-compose down
```

### Production Environment

```bash
# Start production environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Stop production services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
```

### Database Operations

```bash
# Run database migrations
docker-compose exec app-dev npm run migration:run

# Generate new migration
docker-compose exec app-dev npm run migration:generate -- MigrationName

# Access MySQL database
docker-compose exec mysql mysql -u root -p mediacraft
```

### Utility Commands

```bash
# View container status
docker-compose ps

# Execute commands in running container
docker-compose exec app-dev npm run test

# Rebuild specific service
docker-compose build app-dev

# Remove all containers and volumes (WARNING: destroys data)
docker-compose down -v
```

## Services

### Application Service

- **Port**: 3000
- **Development**: Hot reloading enabled with source code mounted
- **Production**: Optimized build with multi-stage Docker build

### MySQL Database

- **Port**: 3307 (external), 3306 (internal)
- **Database**: mediacraft
- **Persistent storage**: Docker volume `mysql_data`

### Redis Cache

- **Port**: 6379
- **Persistent storage**: Docker volume `redis_data`
- **Used for**: Job queues, caching

## Environment Variables

Key environment variables you need to configure:

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=mysql
DB_NAME=mediacraft
DB_USERNAME=mediacraft_user
DB_PASSWORD=your_secure_password

# Authentication
JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret

# Encryption
ENCRYPTION_PASSWORD=your_encryption_password
ENCRYPTION_SALT=your_encryption_salt

# AWS S3 (for file uploads)
AWS_S3_BUCKET_NAME=your-bucket
AWS_S3_ACCESS_KEY_ID=your-key
AWS_S3_SECRET_ACCESS_KEY=your-secret
AWS_S3_REGION=us-east-1

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

## Troubleshooting

### Common Issues

1. **Port conflicts**

   ```bash
   # Change ports in docker-compose.yml if 3000, 3307, or 6379 are in use
   ```

2. **Permission issues**

   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

3. **Database connection issues**

   ```bash
   # Check if MySQL is ready
   docker-compose logs mysql

   # Wait for MySQL to be fully initialized
   docker-compose exec mysql mysqladmin ping -h localhost -u root -p
   ```

4. **Clean restart**

   ```bash
   # Stop all services and remove containers
   docker-compose down

   # Remove volumes (WARNING: destroys data)
   docker-compose down -v

   # Rebuild and start
   docker-compose build --no-cache
   docker-compose up
   ```

### Performance Optimization

For production environments:

1. **Resource limits**: Configure container resource limits
2. **Database tuning**: Adjust MySQL configuration for your workload
3. **Redis optimization**: Configure Redis memory policies
4. **Load balancing**: Consider using nginx for load balancing multiple app instances

### Monitoring

- Health checks are configured for all services
- Check service health: `docker-compose ps`
- View logs: `docker-compose logs -f [service-name]`
- Monitor resource usage: `docker stats`

## Security Considerations

1. **Use strong passwords** for all services
2. **Don't commit .env files** to version control
3. **Use secrets management** in production
4. **Keep images updated** regularly
5. **Run containers as non-root** users (already configured)
6. **Use HTTPS** in production with reverse proxy

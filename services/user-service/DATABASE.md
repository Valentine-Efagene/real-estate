# Database Management

This service uses Prisma ORM with MariaDB/MySQL for data persistence.

## Local Development Setup

### 1. Environment Configuration

Create a `.env.local` file for local development:

```bash
cp .env.local.example .env.local
```

Update the database credentials in `.env.local`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=qshelter_local
DATABASE_URL="mysql://root:your-password@localhost:3306/qshelter_local"
```

### 2. Database Setup

#### Option A: Using Docker (Recommended)

```bash
# Start MariaDB container
docker run --name qshelter-db \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=qshelter_local \
  -p 3306:3306 \
  -d mariadb:latest
```

#### Option B: Local Installation

Install MariaDB/MySQL on your machine and create the database:

```sql
CREATE DATABASE qshelter_local;
```

### 3. Run Migrations

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
NODE_ENV=local npm run prisma:migrate

# Or push schema without migrations (for rapid development)
npm run db:push:local
```

### 4. Seed Database

```bash
# Seed with initial data (roles, tenants, etc.)
npm run db:seed:local
```

## Available Scripts

### Database Operations

- `npm run db:seed` - Seed database (uses current NODE_ENV)
- `npm run db:seed:local` - Seed local database
- `npm run db:reset` - Reset database (drop all data and re-run migrations)
- `npm run db:reset:local` - Reset local database
- `npm run db:push` - Push schema changes without migrations
- `npm run db:push:local` - Push schema changes to local DB
- `npm run db:studio` - Open Prisma Studio (visual database editor)

### Prisma Operations

- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run migrations in development mode

## Testing

E2E tests automatically handle database setup and cleanup:

```bash
# Run all e2e tests (uses .env.local)
npm run test:e2e
```

The test suite:

- Cleans the database before each test suite
- Seeds required data (roles, tenants)
- Cleans up after all tests

## Database Structure

The database schema is defined in the shared common package:

- Location: `shared/common/prisma/schema.prisma`
- Entities: User, Role, Tenant, RefreshToken, PasswordReset, OAuthState, etc.

## Stage-Based Configuration

The service adapts its database connection based on `NODE_ENV`:

- **local**: Uses environment variables from `.env.local`
- **dev/staging/production**: Uses AWS Secrets Manager for credentials

## Common Tasks

### View Database in Browser

```bash
npm run db:studio
```

### Reset Database and Start Fresh

```bash
npm run db:reset:local
npm run db:seed:local
```

### Create a New Migration

```bash
# After modifying schema.prisma
npx prisma migrate dev --name describe_your_changes
```

### Inspect Database

```bash
# Connect to local database
mysql -u root -p qshelter_local

# Or using Docker
docker exec -it qshelter-db mysql -u root -p qshelter_local
```

## Troubleshooting

### Connection Refused

- Ensure MariaDB/MySQL is running
- Check credentials in `.env.local`
- Verify port 3306 is not blocked

### Migration Errors

```bash
# Reset migrations
npm run db:reset:local

# Re-run migrations
NODE_ENV=local npm run prisma:migrate
```

### Prisma Client Out of Sync

```bash
npm run prisma:generate
```

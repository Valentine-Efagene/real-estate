# Database Module

Centralized database configuration and entity management for the Real Estate application.

## Overview

The Database Module provides:

- ✅ Centralized entity exports for all Lambda functions
- ✅ TypeORM configuration with environment-based settings
- ✅ Migration management and CLI tools
- ✅ Database health checks and connection management
- ✅ Optimized for Lambda cold starts with connection pooling

## Directory Structure

```
src/database/
├── database.module.ts         # Main module with TypeORM configuration
├── database.service.ts        # Service for migrations and health checks
├── database.config.ts         # TypeORM configuration factory
├── migration.cli.ts           # CLI for running migrations
├── entities/
│   └── index.ts              # Re-exports all entities from their original locations
└── index.ts                  # Main export file
```

## Usage

### In Your Feature Modules

Import entities from the database module:

```typescript
import { User, Property, Mortgage } from '../database';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([User, Property, Mortgage])],
  // ...
})
export class YourFeatureModule {}
```

### In Separate Lambda Functions

Create a minimal Lambda function with database access:

```typescript
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { DatabaseModule, User } from '../database';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([User])],
  // Add your services/controllers
})
class NotificationLambdaModule {}

export const handler = async (event, context) => {
  const app = await NestFactory.createApplicationContext(
    NotificationLambdaModule,
  );
  // Your Lambda logic here
  await app.close();
};
```

## Migration Management

### Generate a Migration

```bash
npm run migration:generate -- -n YourMigrationName
```

### Run Migrations

```bash
npm run migration:run
```

### Revert Last Migration

```bash
npm run migration:revert
```

### Show Pending Migrations

```bash
npm run migration:show
```

## Configuration

The module automatically configures itself based on environment variables:

### Required Environment Variables

```env
DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=your-database-name
DB_USERNAME=your-username
DB_PASSWORD=your-password
NODE_ENV=production|development
```

### Lambda-Specific Configuration

For Lambda deployments, the module automatically:

- Runs migrations on cold start (in production)
- Uses optimized connection pool settings (5 connections)
- Extends connection timeouts to 60s
- Disables auto-synchronization (uses migrations only)

## Database Service API

```typescript
import { DatabaseService } from '../database';

// Check database connection
await databaseService.checkConnection();

// Run pending migrations
await databaseService.runMigrations();

// Revert last migration
await databaseService.revertLastMigration();

// Get pending migrations
const pending = await databaseService.getPendingMigrations();

// Get DataSource for raw queries
const dataSource = databaseService.getDataSource();

// Close connection (for Lambda cleanup)
await databaseService.closeConnection();
```

## Entities

All entities are exported from `src/database/entities/index.ts`:

- Tenant
- User
- Role
- Permission
- RefreshToken
- Property
- PropertyMedia
- PropertyDocument
- UserSuspension
- Mortgage
- MortgageDocument
- MortgageStep
- MortgageDownpaymentPlan
- MortgageDownpaymentInstallment
- MortgageDownpaymentPayment
- MortgageType
- Amenity
- PasswordResetToken
- Settings
- BulkInviteTask
- Wallet
- Transaction

## Microservices Architecture

When splitting into microservices, each Lambda function can import only the entities it needs:

```typescript
// Notification Lambda - only needs User
import { DatabaseModule, User } from '../database';

// Payment Lambda - only needs Transaction, Wallet
import { DatabaseModule, Transaction, Wallet } from '../database';

// Property Lambda - needs Property, PropertyMedia, PropertyDocument
import {
  DatabaseModule,
  Property,
  PropertyMedia,
  PropertyDocument,
} from '../database';
```

## Benefits

1. **Single Source of Truth**: All entities managed in one place
2. **Easy Migration Management**: Centralized migration CLI
3. **Lambda-Optimized**: Connection pooling and timeout handling
4. **Microservice-Ready**: Import only what you need
5. **Type Safety**: Full TypeScript support across all modules
6. **Auto-Migration**: Runs migrations automatically in production

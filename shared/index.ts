/**
 * Shared Modules Index
 * Export all shared modules for easy import in services
 */

// Database Module
export * from './database';

// Common Module
export * from './common/common.module';
export * from './common/common.service';
export * from './common/common.controller';
export * from './common/common.dto';
export * from './common/common.entity';
export * from './common/common.pure.entity';
export * from './common/common.type';
export * from './common/common.enum';
export * from './common/common.error';

// Guards
export * from './common/guard/permission.guard';
export * from './common/guard/tenant.guard';

// Decorators
export * from './common/decorator/current-user.decorator';
export * from './common/decorator/permissions.decorator';
export * from './common/decorator/tenant.decorator';
export * from './common/decorator/public.decorator';

// Middleware
export * from './common/middleware/TenantMiddleware';
export * from './common/middleware/AuthenticationMiddleware';
export * from './common/middleware/AccessLoggerMiddleware';

// Helpers
export * from './common/helpers/BaseEntity';
export * from './common/helpers/CustomNamingStrategy';
export * from './common/helpers/TenantAwareEntity';
export * from './common/helpers/TenantAwareRepository';

// Event Bus
export * from './event-bus';

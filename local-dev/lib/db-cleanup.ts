/**
 * Database Cleanup Utilities for E2E Tests
 *
 * Provides functions to clean the database between tests
 * while respecting foreign key constraints.
 */

import { PrismaClient } from '@valentine-efagene/qshelter-common';

/**
 * Model delegate names in deletion order (dependents first, then parents)
 * These correspond to prisma.modelName (camelCase)
 */
const MODEL_DELEGATES_IN_DELETION_ORDER = [
    // Payment/Contract domain (most dependent)
    'propertyPaymentMethodLink',
    'propertyPaymentMethod',
    'paymentPlan',

    // Property domain
    'propertyVariantAmenity',
    'propertyVariantMedia',
    'propertyAmenity',
    'propertyUnit',
    'propertyVariant',
    'propertyDocument',
    'propertyMedia',
    'amenity',
    'property',

    // User domain (dependent tables first)
    'transaction',
    'wallet',
    'deviceEndpoint',
    'emailPreference',
    'settings',
    'social',
    'oAuthState',
    'userSuspension',
    'passwordReset',
    'refreshToken',
    'userRole',
    'rolePermission',

    // Core tables (parents)
    'permission',
    'role',
    'user',
    'tenant',
] as const;

type ModelDelegateName = (typeof MODEL_DELEGATES_IN_DELETION_ORDER)[number];

/**
 * Clean all tables in the database using Prisma's deleteMany
 * (use with caution - deletes everything)
 *
 * @param prisma - Prisma client instance from @valentine-efagene/qshelter-common
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
    // Disable foreign key checks for faster deletion
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

    try {
        for (const modelName of MODEL_DELEGATES_IN_DELETION_ORDER) {
            try {
                // Access the model delegate dynamically
                const delegate = (prisma as unknown as Record<string, unknown>)[modelName];
                if (delegate && typeof (delegate as Record<string, unknown>).deleteMany === 'function') {
                    await (delegate as { deleteMany: () => Promise<unknown> }).deleteMany();
                }
            } catch {
                // Model might not exist in this schema version, skip it
                console.warn(`Could not clean model ${modelName}`);
            }
        }
    } finally {
        // Re-enable foreign key checks
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    }
}

/**
 * Clean specific models by delegate name
 *
 * @param prisma - Prisma client instance
 * @param models - Array of model delegate names to clean (e.g., ['user', 'property'])
 */
export async function cleanModels(
    prisma: PrismaClient,
    models: ModelDelegateName[]
): Promise<void> {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

    try {
        for (const modelName of models) {
            const delegate = (prisma as unknown as Record<string, unknown>)[modelName];
            if (delegate && typeof (delegate as Record<string, unknown>).deleteMany === 'function') {
                await (delegate as { deleteMany: () => Promise<unknown> }).deleteMany();
            }
        }
    } finally {
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    }
}

/**
 * Delete test data by pattern (e.g., emails containing "test")
 * Useful for cleaning up after specific test runs
 *
 * @param prisma - Prisma client instance
 */
export async function cleanTestData(prisma: PrismaClient): Promise<void> {
    // Delete users with test emails
    await prisma.user.deleteMany({
        where: {
            email: {
                contains: '@test.',
            },
        },
    });

    // Delete properties with test titles
    await prisma.property.deleteMany({
        where: {
            title: {
                startsWith: 'Test ',
            },
        },
    });
}

/**
 * Seed minimal required data for tests
 * (tenants, roles, permissions)
 *
 * @param prisma - Prisma client instance
 */
export async function seedTestData(prisma: PrismaClient): Promise<void> {
    // Create default tenant
    await prisma.tenant.upsert({
        where: { subdomain: 'test-tenant' },
        update: {},
        create: {
            name: 'Test Tenant',
            subdomain: 'test-tenant',
            isActive: true,
        },
    });

    // Create roles
    const roles = ['admin', 'buyer', 'agent', 'landlord'];
    for (const roleName of roles) {
        await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: {
                name: roleName,
                description: `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role`,
            },
        });
    }

    // Create basic permissions
    const permissions = [
        { name: 'user:read', description: 'Read user data', resource: 'user', action: 'read' },
        { name: 'user:write', description: 'Write user data', resource: 'user', action: 'write' },
        { name: 'property:read', description: 'Read property data', resource: 'property', action: 'read' },
        { name: 'property:write', description: 'Write property data', resource: 'property', action: 'write' },
        { name: 'contract:read', description: 'Read contract data', resource: 'contract', action: 'read' },
        { name: 'contract:write', description: 'Write contract data', resource: 'contract', action: 'write' },
    ];

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: perm,
        });
    }
}

/**
 * Create a test-scoped database cleaner
 * Usage in Jest:
 *
 * const cleaner = createDatabaseCleaner(prisma);
 * beforeEach(() => cleaner.clean());
 * afterAll(() => cleaner.disconnect());
 */
export function createDatabaseCleaner(prisma: PrismaClient) {
    return {
        clean: () => cleanDatabase(prisma),
        cleanModels: (models: ModelDelegateName[]) => cleanModels(prisma, models),
        seed: () => seedTestData(prisma),
        disconnect: () => prisma.$disconnect(),
    };
}

import { prisma, cleanDatabase, seedRoles, seedTenants } from '../../lib/db';

/**
 * Create test roles in database
 */
export async function seedTestRoles() {
    await seedTenants();
    await seedRoles();
}

/**
 * Global setup for e2e tests
 */
export async function setupTests() {
    await cleanDatabase();
    await seedTestRoles();
}

/**
 * Global teardown for e2e tests
 */
export async function teardownTests() {
    await cleanDatabase();
    await prisma.$disconnect();
}

// Re-export for convenience
export { cleanDatabase, prisma };

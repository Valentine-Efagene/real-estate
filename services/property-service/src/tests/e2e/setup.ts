import { prisma } from '../../lib/prisma';

// Test tenant and user that will be created in each test
export let testTenant: any;
export let testUser: any;

/**
 * Clean all data from database
 */
export async function cleanDatabase() {
    // Delete in order to respect foreign key constraints
    await prisma.$transaction([
        prisma.propertyAmenity.deleteMany(),
        prisma.propertyMedia.deleteMany(),
        prisma.propertyDocument.deleteMany(),
        prisma.property.deleteMany(),
        prisma.amenity.deleteMany(),
    ]);
}

/**
 * Seed test data - create tenant and user for property tests
 */
export async function seedTestData() {
    // Create or get a test tenant
    testTenant = await prisma.tenant.upsert({
        where: { subdomain: 'test-property' },
        update: {},
        create: {
            name: 'Test Tenant',
            subdomain: 'test-property',
        },
    });

    // Create or get a test user
    testUser = await prisma.user.upsert({
        where: { email: 'test-property@example.com' },
        update: {},
        create: {
            email: 'test-property@example.com',
            firstName: 'Test',
            lastName: 'User',
            password: 'test_password_hash',
            tenantId: testTenant.id,
        },
    });
}

/**
 * Global setup for e2e tests
 */
export async function setupTests() {
    await cleanDatabase();
    await seedTestData();
}

/**
 * Global teardown for e2e tests
 */
export async function teardownTests() {
    await cleanDatabase();
    await prisma.$disconnect();
}

// Re-export for convenience
export { prisma };

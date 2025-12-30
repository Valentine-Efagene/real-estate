import { prisma } from '../../lib/prisma';

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
 * Global setup for e2e tests
 */
export async function setupTests() {
    await cleanDatabase();
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

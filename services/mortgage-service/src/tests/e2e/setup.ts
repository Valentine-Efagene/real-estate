import { prisma } from '../../lib/prisma';

/**
 * Clean all data from database
 */
export async function cleanDatabase() {
    // Delete in order to respect foreign key constraints
    // Using the new application-based schema
    await prisma.$transaction([
        prisma.applicationPayment.deleteMany(),
        prisma.applicationDocument.deleteMany(),
        prisma.documentationStepApproval.deleteMany(),
        prisma.documentationStep.deleteMany(),
        prisma.paymentInstallment.deleteMany(),
        prisma.applicationPhase.deleteMany(),
        prisma.application.deleteMany(),
        prisma.propertyPaymentMethod.deleteMany(),
        prisma.paymentPlan.deleteMany(),
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

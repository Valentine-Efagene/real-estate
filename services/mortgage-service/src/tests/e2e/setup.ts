import { prisma } from '../../lib/prisma';

/**
 * Clean all data from database
 */
export async function cleanDatabase() {
    // Delete in order to respect foreign key constraints
    // Using the new Contract-based schema
    await prisma.$transaction([
        prisma.contractPayment.deleteMany(),
        prisma.contractDocument.deleteMany(),
        prisma.documentationStepApproval.deleteMany(),
        prisma.documentationStep.deleteMany(),
        prisma.contractInstallment.deleteMany(),
        prisma.contractPhase.deleteMany(),
        prisma.contract.deleteMany(),
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

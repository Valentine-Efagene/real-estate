import { prisma } from '../../lib/prisma.js';

/**
 * Clean all data from database
 */
export async function cleanDatabase() {
    // Delete in order to respect foreign key constraints
    await prisma.$transaction([
        prisma.payment.deleteMany(),
        prisma.mortgageDownpaymentPayment.deleteMany(),
        prisma.mortgageDownpaymentInstallment.deleteMany(),
        prisma.mortgageDownpaymentPlan.deleteMany(),
        prisma.mortgageDocument.deleteMany(),
        prisma.mortgageStep.deleteMany(),
        prisma.mortgage.deleteMany(),
        prisma.mortgageType.deleteMany(),
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

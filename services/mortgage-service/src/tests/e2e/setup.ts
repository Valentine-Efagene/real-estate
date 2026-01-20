import { prisma } from '../../lib/prisma';

/**
 * Clean all data from database
 */
export async function cleanDatabase() {
    // Delete in order to respect foreign key constraints
    // Using the new approval-stage-based schema
    await prisma.$transaction([
        prisma.applicationPayment.deleteMany(),
        prisma.documentApproval.deleteMany(),
        prisma.documentReview.deleteMany(),
        prisma.applicationDocument.deleteMany(),
        prisma.approvalStageProgress.deleteMany(),
        prisma.paymentInstallment.deleteMany(),
        prisma.applicationPhase.deleteMany(),
        prisma.application.deleteMany(),
        prisma.documentDefinition.deleteMany(),
        prisma.approvalStage.deleteMany(),
        prisma.documentationPlan.deleteMany(),
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

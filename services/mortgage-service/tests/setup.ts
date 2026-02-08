import { config } from 'dotenv';
config({ path: '.env.test' });

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient, destroyAllEventPublishers } from '@valentine-efagene/qshelter-common';
import { faker } from '@faker-js/faker';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { app as propertyApp } from '../../property-service/src/app.js';
import { destroySNSClient } from '../src/lib/outbox.js';

// Note: notification-service import removed - tests should use the deployed service or mock

/**
 * E2E Test Mode Configuration
 * 
 * Set API_BASE_URL to test against deployed LocalStack APIs:
 *   API_BASE_URL=http://vf7kbi2plw.execute-api.localhost.localstack.cloud:4566/test pnpm test:e2e
 * 
 * Leave unset for fast in-process testing with supertest(app)
 */
export const API_BASE_URL = process.env.API_BASE_URL;
export const NOTIFICATION_API_BASE_URL = process.env.NOTIFICATION_API_BASE_URL;
export const PROPERTY_API_BASE_URL = process.env.PROPERTY_API_BASE_URL;
export const isDeployedMode = !!API_BASE_URL;

// Create a supertest instance that works with both modes
export const api = API_BASE_URL ? supertest(API_BASE_URL) : supertest(app);
// Property API - uses property service app in local mode, or deployed URL
export const propertyApi = PROPERTY_API_BASE_URL
    ? supertest(PROPERTY_API_BASE_URL)
    : supertest(propertyApp);
// Notification API requires NOTIFICATION_API_BASE_URL to be set for tests
export const notificationApi = NOTIFICATION_API_BASE_URL
    ? supertest(NOTIFICATION_API_BASE_URL)
    : null; // Will be null when not in deployed mode

// Log the test mode on startup
console.log(`[E2E] Mode: ${isDeployedMode ? 'DEPLOYED' : 'LOCAL'}`);
if (isDeployedMode) {
    console.log(`[E2E] API Base URL: ${API_BASE_URL}`);
}

// Create adapter for test database
const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3307'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_NAME || 'qshelter_test',
    connectionLimit: 10,
    allowPublicKeyRetrieval: true,
});

// Database client for tests
export const prisma = new PrismaClient({ adapter });

// Before all tests - ensure database is connected
beforeAll(async () => {
    await prisma.$connect();
});

// After all tests - disconnect and clean up
afterAll(async () => {
    // Destroy AWS SDK clients to allow Jest to exit cleanly
    destroySNSClient();
    destroyAllEventPublishers();
    await prisma.$disconnect();
});

// Helper to create test data
export const testData = {
    userId: () => faker.string.uuid(),

    // Create a user in the database
    async createUser() {
        return prisma.user.create({
            data: {
                id: faker.string.uuid(),
                email: faker.internet.email(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            },
        });
    },

    // Create a property with variant and units
    async createPropertyWithUnits(tenantId: string, userId: string, options?: {
        variantCount?: number;
        unitsPerVariant?: number;
        price?: number;
    }) {
        const variantCount = options?.variantCount ?? 1;
        const unitsPerVariant = options?.unitsPerVariant ?? 5;
        const price = options?.price ?? 500000;

        const property = await prisma.property.create({
            data: {
                tenantId,
                userId,
                title: faker.location.streetAddress() + ' Estate',
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: faker.location.country(),
                currency: 'USD',
                city: faker.location.city(),
                description: faker.lorem.paragraph(),
                status: 'PUBLISHED',
                publishedAt: new Date(),
            },
        });

        const variants = [];
        for (let v = 0; v < variantCount; v++) {
            const variant = await prisma.propertyVariant.create({
                data: {
                    tenantId,
                    propertyId: property.id,
                    name: `${v + 2}-Bedroom ${faker.helpers.arrayElement(['Standard', 'Corner Piece', 'Penthouse'])}`,
                    nBedrooms: v + 2,
                    nBathrooms: v + 1,
                    nParkingSpots: 1,
                    area: 100 + (v * 20),
                    price: price + (v * 50000),
                    totalUnits: unitsPerVariant,
                    availableUnits: unitsPerVariant,
                    status: 'AVAILABLE',
                },
            });

            // Create units for this variant
            for (let u = 0; u < unitsPerVariant; u++) {
                await prisma.propertyUnit.create({
                    data: {
                        tenantId,
                        variantId: variant.id,
                        unitNumber: `${String.fromCharCode(65 + v)}${u + 1}`, // A1, A2, ... B1, B2
                        floorNumber: Math.floor(u / 2) + 1,
                        status: 'AVAILABLE',
                    },
                });
            }

            variants.push(variant);
        }

        return { property, variants };
    },

    paymentPlan: () => ({
        name: faker.commerce.productName() + ' Payment Plan',
        description: faker.lorem.sentence(),
        frequency: 'MONTHLY' as const,
        numberOfInstallments: 12,
        interestRate: 5.0,
        gracePeriodDays: 7,
    }),

    paymentMethod: (paymentPlanId?: string) => ({
        name: faker.commerce.productName() + ' Method',
        description: faker.lorem.sentence(),
        phases: paymentPlanId ? [
            {
                name: 'Documentation',
                phaseCategory: 'DOCUMENTATION' as const,
                phaseType: 'KYC' as const,
                order: 1,
                percentageOfTotal: 0,
                stepDefinitions: [
                    { name: 'Upload ID', stepType: 'UPLOAD' as const, order: 1 },
                    { name: 'Verify Address', stepType: 'REVIEW' as const, order: 2 },
                    { name: 'Sign Application', stepType: 'SIGNATURE' as const, order: 3 },
                ],
            },
            {
                name: 'Downpayment',
                phaseCategory: 'PAYMENT' as const,
                phaseType: 'DOWNPAYMENT' as const,
                order: 2,
                percentageOfTotal: 20,
                paymentPlanId,
            },
            {
                name: 'Mortgage',
                phaseCategory: 'PAYMENT' as const,
                phaseType: 'MORTGAGE' as const,
                order: 3,
                percentageOfTotal: 80,
                paymentPlanId,
            },
        ] : [],
    }),
};

// Cleanup helper - removes all test data
export async function cleanupTestData() {
    // Delete in correct order to respect foreign keys
    await prisma.approvalRequest.deleteMany();
    await prisma.propertyTransferRequest.deleteMany();
    await prisma.applicationTermination.deleteMany();
    await prisma.applicationEvent.deleteMany();
    await prisma.applicationPayment.deleteMany();
    await prisma.paymentInstallment.deleteMany();
    // Document approval system (new architecture)
    await prisma.documentApproval.deleteMany();
    await prisma.documentReview.deleteMany();
    await prisma.applicationDocument.deleteMany();
    // Approval stage tracking
    await prisma.approvalStageProgress.deleteMany();
    // Delete polymorphic phase extensions before base ApplicationPhase
    await prisma.questionnaireField.deleteMany();
    await prisma.questionnairePhase.deleteMany();
    await prisma.documentationPhase.deleteMany();
    await prisma.paymentPhase.deleteMany();
    await prisma.applicationPhase.deleteMany();
    await prisma.paymentMethodChangeRequest.deleteMany();
    await prisma.application.deleteMany();
    await prisma.propertyUnit.deleteMany();
    await prisma.propertyVariantAmenity.deleteMany();
    await prisma.propertyVariantMedia.deleteMany();
    await prisma.propertyVariant.deleteMany();
    await prisma.propertyPaymentMethodLink.deleteMany();
    await prisma.phaseEventAttachment.deleteMany();
    await prisma.stepEventAttachment.deleteMany();
    await prisma.paymentMethodPhaseStep.deleteMany();
    await prisma.paymentMethodPhaseDocument.deleteMany();
    await prisma.propertyPaymentMethodPhase.deleteMany();
    await prisma.documentRequirementRule.deleteMany();
    await prisma.propertyPaymentMethod.deleteMany();
    await prisma.paymentPlan.deleteMany();
    // Documentation plans with definitions and stages
    await prisma.documentDefinition.deleteMany();
    await prisma.approvalStage.deleteMany();
    await prisma.documentationPlan.deleteMany();
    // Clean up event system (handler -> type -> channel)
    await prisma.eventHandler.deleteMany();
    await prisma.eventType.deleteMany();
    await prisma.eventChannel.deleteMany();
    await prisma.domainEvent.deleteMany();
    await prisma.property.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
}

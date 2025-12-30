import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@valentine-efagene/qshelter-common';
import { faker } from '@faker-js/faker';

// Create adapter for test database
const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qshelter_test',
    connectionLimit: 5,
});

// Database client for tests
export const prisma = new PrismaClient({ adapter });

// Before all tests - ensure database is connected
beforeAll(async () => {
    await prisma.$connect();
});

// After all tests - disconnect and clean up
afterAll(async () => {
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
    async createPropertyWithUnits(userId: string, options?: {
        variantCount?: number;
        unitsPerVariant?: number;
        price?: number;
    }) {
        const variantCount = options?.variantCount ?? 1;
        const unitsPerVariant = options?.unitsPerVariant ?? 5;
        const price = options?.price ?? 500000;

        const property = await prisma.property.create({
            data: {
                userId,
                title: faker.location.streetAddress() + ' Estate',
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: faker.location.country(),
                currency: 'USD',
                city: faker.location.city(),
                description: faker.lorem.paragraph(),
                status: 'PUBLISHED',
                isPublished: true,
                publishedAt: new Date(),
            },
        });

        const variants = [];
        for (let v = 0; v < variantCount; v++) {
            const variant = await prisma.propertyVariant.create({
                data: {
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
                phaseType: 'KYC',
                order: 1,
                percentageOfTotal: 0,
                stepDefinitions: 'UPLOAD_ID,VERIFY_ADDRESS,SIGN_CONTRACT',
            },
            {
                name: 'Downpayment',
                phaseCategory: 'PAYMENT' as const,
                phaseType: 'DOWNPAYMENT',
                order: 2,
                percentageOfTotal: 20,
                paymentPlanId,
            },
            {
                name: 'Mortgage',
                phaseCategory: 'PAYMENT' as const,
                phaseType: 'MORTGAGE',
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
    await prisma.contractEvent.deleteMany();
    await prisma.contractTransition.deleteMany();
    await prisma.contractPayment.deleteMany();
    await prisma.contractInstallment.deleteMany();
    await prisma.contractPhaseStepApproval.deleteMany();
    await prisma.contractPhaseStep.deleteMany();
    await prisma.contractDocument.deleteMany();
    await prisma.contractPhase.deleteMany();
    await prisma.contract.deleteMany();
    await prisma.propertyUnit.deleteMany();
    await prisma.propertyVariantAmenity.deleteMany();
    await prisma.propertyVariantMedia.deleteMany();
    await prisma.propertyVariant.deleteMany();
    await prisma.propertyPaymentMethodLink.deleteMany();
    await prisma.propertyPaymentMethodPhase.deleteMany();
    await prisma.propertyPaymentMethod.deleteMany();
    await prisma.paymentPlan.deleteMany();
    await prisma.domainEvent.deleteMany();
    // Note: Not deleting properties and users - they may be shared
}

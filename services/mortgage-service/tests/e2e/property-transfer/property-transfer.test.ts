import { api, prisma, cleanupTestData } from '../../setup.js';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import { authHeaders, ROLES } from '@valentine-efagene/qshelter-common';

// Helper functions for auth headers with proper roles
function adminHeaders(userId: string, tenantId: string) {
    return authHeaders(userId, tenantId, { roles: [ROLES.TENANT_ADMIN] });
}

function customerHeaders(userId: string, tenantId: string) {
    return authHeaders(userId, tenantId, { roles: [ROLES.CUSTOMER] });
}

/**
 * E2E Test: Property Transfer with Progress Preservation
 * 
 * Scenario: Chidi has an active 10/90 mortgage application where the 10% downpayment
 * is paid in 12 monthly instalments. After receiving a provisional offer and paying
 * 6 instalments, Chidi requests to transfer to a different property while preserving
 * all payments, completed workflow steps, and progress.
 * 
 * See: docs/PROPERTY_TRANSFER_SCENARIO.md
 */

const TEST_RUN_ID = randomUUID();

function idempotencyKey(operation: string): string {
    return `${TEST_RUN_ID}:${operation}`;
}

describe('Property Transfer with Progress Preservation', () => {
    // Actors
    let jinxId: string;  // Admin
    let chidiId: string; // Buyer

    // Tenant
    let tenantId: string;

    // Properties
    let propertyXId: string; // Original property - Lekki Gardens
    let propertyYId: string; // Target property - Victoria Island
    let variantXId: string;
    let variantYId: string;
    let unitXId: string;  // Chidi's current unit
    let unitYId: string;  // Target unit

    // Payment setup
    let downpaymentPlanId: string;
    let mortgagePlanId: string;
    let paymentMethodId: string;

    // Chidi's application
    let applicationAId: string;
    let applicationANumber: string;

    // Transfer request
    let transferRequestId: string;

    // New application after transfer
    let applicationBId: string;

    // Test constants
    const PROPERTY_X_PRICE = 10_000_000; // ₦10M
    const PROPERTY_Y_PRICE = 11_000_000; // ₦11M
    const DOWNPAYMENT_PERCENT = 10;
    const DOWNPAYMENT_INSTALMENTS = 12;
    const INSTALMENT_AMOUNT = (PROPERTY_X_PRICE * DOWNPAYMENT_PERCENT / 100) / DOWNPAYMENT_INSTALMENTS; // ₦83,333.33

    beforeAll(async () => {
        await cleanupTestData();

        // Create tenant
        const tenant = await prisma.tenant.create({
            data: {
                id: faker.string.uuid(),
                name: 'QShelter Real Estate',
                subdomain: 'qshelter-transfer-test',
                isActive: true,
            },
        });
        tenantId = tenant.id;

        // Create Jinx (Admin)
        const jinx = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'jinx-transfer@qshelter.com',
                firstName: 'Jinx',
                lastName: 'Okafor',
            },
        });
        jinxId = jinx.id;

        // Create Chidi (Buyer) - using real email for notification testing
        const chidi = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'efagenevalentine@gmail.com',
                firstName: 'Chidi',
                lastName: 'Eze',
            },
        });
        chidiId = chidi.id;

        // Create Property X - Lekki Gardens
        const propertyX = await prisma.property.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                userId: jinxId,
                title: 'Lekki Gardens Estate',
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: 'Nigeria',
                currency: 'NGN',
                city: 'Lagos',
                district: 'Lekki',
                status: 'PUBLISHED',
                isPublished: true,
                publishedAt: new Date(),
            },
        });
        propertyXId = propertyX.id;

        // Create variant for Property X
        const variantX = await prisma.propertyVariant.create({
            data: {
                tenantId,
                propertyId: propertyXId,
                name: '3-Bedroom Standard',
                nBedrooms: 3,
                nBathrooms: 2,
                nParkingSpots: 1,
                area: 120,
                price: PROPERTY_X_PRICE,
                totalUnits: 10,
                availableUnits: 8,
                status: 'AVAILABLE',
            },
        });
        variantXId = variantX.id;

        // Create unit A1 for Chidi
        const unitX = await prisma.propertyUnit.create({
            data: {
                tenantId,
                variantId: variantXId,
                unitNumber: 'A1',
                floorNumber: 1,
                status: 'AVAILABLE',
            },
        });
        unitXId = unitX.id;

        // Create Property Y - Victoria Island Towers
        const propertyY = await prisma.property.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                userId: jinxId,
                title: 'Victoria Island Towers',
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: 'Nigeria',
                currency: 'NGN',
                city: 'Lagos',
                district: 'Victoria Island',
                status: 'PUBLISHED',
                isPublished: true,
                publishedAt: new Date(),
            },
        });
        propertyYId = propertyY.id;

        // Create variant for Property Y
        const variantY = await prisma.propertyVariant.create({
            data: {
                tenantId,
                propertyId: propertyYId,
                name: '3-Bedroom Premium',
                nBedrooms: 3,
                nBathrooms: 3,
                nParkingSpots: 2,
                area: 150,
                price: PROPERTY_Y_PRICE,
                totalUnits: 5,
                availableUnits: 3,
                status: 'AVAILABLE',
            },
        });
        variantYId = variantY.id;

        // Create unit B3 as transfer target
        const unitY = await prisma.propertyUnit.create({
            data: {
                tenantId,
                variantId: variantYId,
                unitNumber: 'B3',
                floorNumber: 3,
                status: 'AVAILABLE',
            },
        });
        unitYId = unitY.id;
    });

    afterAll(async () => {
        await cleanupTestData();
        // Delete in correct order to avoid foreign key constraints
        await prisma.propertyTransferRequest.deleteMany({ where: { tenantId } });
        await prisma.propertyUnit.deleteMany({ where: { variantId: { in: [variantXId, variantYId] } } });
        await prisma.propertyVariant.deleteMany({ where: { id: { in: [variantXId, variantYId] } } });
        await prisma.property.deleteMany({ where: { id: { in: [propertyXId, propertyYId] } } });
        await prisma.user.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => { });
    });

    // ================================================================
    // STEP 0: Jinx creates payment plans and method
    // ================================================================
    describe('Step 0: Setup Payment Method', () => {
        it('Jinx creates a downpayment plan (12 instalments)', async () => {
            const response = await api
                .post('/payment-plans')
                .set(adminHeaders(jinxId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-downpayment-plan'))
                .send({
                    name: 'Downpayment - 12 Months',
                    description: '10% downpayment split into 12 monthly instalments',
                    frequency: 'MONTHLY',
                    numberOfInstallments: DOWNPAYMENT_INSTALMENTS,
                    interestRate: 0,
                    gracePeriodDays: 7,
                });

            expect(response.status).toBe(201);
            downpaymentPlanId = response.body.data.id;
        });

        it('Jinx creates a 20-year mortgage plan', async () => {
            const response = await api
                .post('/payment-plans')
                .set(adminHeaders(jinxId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-mortgage-plan'))
                .send({
                    name: 'Mortgage - 20 Years Monthly',
                    description: '20 year mortgage at 9.5% p.a.',
                    frequency: 'MONTHLY',
                    numberOfInstallments: 240,
                    interestRate: 9.5,
                    gracePeriodDays: 15,
                });

            expect(response.status).toBe(201);
            mortgagePlanId = response.body.data.id;
        });

        it('Jinx creates a 10/90 payment method template', async () => {
            const response = await api
                .post('/payment-methods')
                .set(adminHeaders(jinxId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-payment-method'))
                .send({
                    name: '10/90 Mortgage - 12 Instalment Downpayment',
                    description: '10% downpayment in 12 monthly instalments, 90% mortgage over 20 years',
                });

            expect(response.status).toBe(201);
            paymentMethodId = response.body.data.id;
        });

        it('Jinx adds the documentation phase', async () => {
            const response = await api
                .post(`/payment-methods/${paymentMethodId}/phases`)
                .set(adminHeaders(jinxId, tenantId))
                .send({
                    name: 'KYC & Documentation',
                    phaseCategory: 'DOCUMENTATION',
                    phaseType: 'KYC',
                    order: 1,
                    percentageOfTotal: 0,
                });

            expect(response.status).toBe(201);
        });

        it('Jinx adds the downpayment phase (10%, 12 instalments)', async () => {
            const response = await api
                .post(`/payment-methods/${paymentMethodId}/phases`)
                .set(adminHeaders(jinxId, tenantId))
                .send({
                    name: 'Downpayment',
                    phaseCategory: 'PAYMENT',
                    phaseType: 'DOWNPAYMENT',
                    order: 2,
                    percentageOfTotal: DOWNPAYMENT_PERCENT,
                    paymentPlanId: downpaymentPlanId,
                });

            expect(response.status).toBe(201);
        });

        it('Jinx adds the mortgage phase (90%)', async () => {
            const response = await api
                .post(`/payment-methods/${paymentMethodId}/phases`)
                .set(adminHeaders(jinxId, tenantId))
                .send({
                    name: 'Mortgage',
                    phaseCategory: 'PAYMENT',
                    phaseType: 'MORTGAGE',
                    order: 3,
                    percentageOfTotal: 90,
                    paymentPlanId: mortgagePlanId,
                });

            expect(response.status).toBe(201);
        });

        it('Jinx links payment method to Property X', async () => {
            const response = await api
                .post(`/payment-methods/${paymentMethodId}/properties`)
                .set(adminHeaders(jinxId, tenantId))
                .send({ propertyId: propertyXId });

            expect(response.status).toBe(201);
        });
    });

    // ================================================================
    // STEP 1: Chidi applies for a mortgage on Property X
    // ================================================================
    describe('Step 1: Chidi Creates Application', () => {
        it('Chidi creates a application for Property X Unit A1', async () => {
            const response = await api
                .post('/applications')
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-application'))
                .send({
                    propertyUnitId: unitXId,
                    paymentMethodId: paymentMethodId,
                    title: 'Lekki Gardens A1 Purchase',
                    applicationType: 'MORTGAGE',
                });

            expect(response.status).toBe(201);
            expect(response.body.data.propertyUnitId).toBe(unitXId);
            expect(response.body.data.totalAmount).toBe(PROPERTY_X_PRICE);

            applicationAId = response.body.data.id;
            applicationANumber = response.body.data.applicationNumber;
        });

        it('Application A has correct phase structure', async () => {
            const response = await api
                .get(`/applications/${applicationAId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.phases).toHaveLength(3);
            expect(response.body.data.phases[0].name).toBe('KYC & Documentation');
            expect(response.body.data.phases[1].name).toBe('Downpayment');
            expect(response.body.data.phases[2].name).toBe('Mortgage');
        });
    });

    // ================================================================
    // STEP 2: Simulate progress - KYC completed, 6 payments made
    // ================================================================
    describe('Step 2: Simulate Progress', () => {
        it('Mark KYC phase as completed', async () => {
            // Get the KYC phase
            const application = await prisma.application.findUnique({
                where: { id: applicationAId },
                include: { phases: { orderBy: { order: 'asc' } } },
            });

            expect(application).not.toBeNull();
            const kycPhase = application!.phases[0];

            // Update phase status directly (simulating completed workflow)
            await prisma.applicationPhase.update({
                where: { id: kycPhase.id },
                data: { status: 'COMPLETED' },
            });

            // Update application status to ACTIVE
            await prisma.application.update({
                where: { id: applicationAId },
                data: { status: 'ACTIVE' },
            });
        });

        it('Record 6 downpayment instalments', async () => {
            const application = await prisma.application.findUnique({
                where: { id: applicationAId },
                include: { phases: { orderBy: { order: 'asc' } } },
            });

            const downpaymentPhase = application!.phases[1];

            // Create 6 payment records
            for (let i = 1; i <= 6; i++) {
                await prisma.applicationPayment.create({
                    data: {
                        tenantId,
                        applicationId: applicationAId,
                        phaseId: downpaymentPhase.id,
                        payerId: chidiId,
                        amount: INSTALMENT_AMOUNT,
                        paymentMethod: 'BANK_TRANSFER',
                        status: 'COMPLETED',
                        reference: `PAY-${applicationANumber}-${i}`,
                        processedAt: new Date(Date.now() - (6 - i) * 30 * 24 * 60 * 60 * 1000), // Staggered dates
                    },
                });
            }

            // Update payment phase totals
            const totalPaid = INSTALMENT_AMOUNT * 6;

            // Find the PaymentPhase extension and update it
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: downpaymentPhase.id },
                include: { paymentPhase: true },
            });

            if (phase?.paymentPhase) {
                await prisma.paymentPhase.update({
                    where: { id: phase.paymentPhase.id },
                    data: { paidAmount: totalPaid },
                });
            }
        });

        it('Verify Chidi has 6 payments recorded', async () => {
            const payments = await prisma.applicationPayment.findMany({
                where: { applicationId: applicationAId },
                orderBy: { createdAt: 'asc' },
            });

            expect(payments).toHaveLength(6);
            expect(payments.every(p => p.status === 'COMPLETED')).toBe(true);

            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
            expect(totalPaid).toBeCloseTo(INSTALMENT_AMOUNT * 6, 2);
        });
    });

    // ================================================================
    // STEP 3: Chidi requests transfer to Property Y
    // ================================================================
    describe('Step 3: Chidi Requests Transfer', () => {
        it('Chidi submits a transfer request to Property Y Unit B3', async () => {
            const response = await api
                .post(`/applications/${applicationAId}/transfer-requests`)
                .set(customerHeaders(chidiId, tenantId))
                .send({
                    targetPropertyUnitId: unitYId,
                    reason: 'Prefer location closer to workplace in Victoria Island',
                });

            expect(response.status).toBe(201);
            expect(response.body.data.status).toBe('PENDING');
            expect(response.body.data.sourceApplicationId).toBe(applicationAId);
            expect(response.body.data.targetPropertyUnitId).toBe(unitYId);
            expect(response.body.data.priceAdjustment).toBe(PROPERTY_Y_PRICE - PROPERTY_X_PRICE);

            transferRequestId = response.body.data.id;
        });

        it('Transfer request shows correct price difference', async () => {
            const response = await api
                .get(`/transfer-requests/${transferRequestId}`)
                .set(adminHeaders(jinxId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.sourceTotalAmount).toBe(PROPERTY_X_PRICE);
            expect(response.body.data.targetTotalAmount).toBe(PROPERTY_Y_PRICE);
            expect(response.body.data.priceAdjustment).toBe(1_000_000); // ₦1M difference
        });

        it('Cannot create duplicate transfer request', async () => {
            const response = await api
                .post(`/applications/${applicationAId}/transfer-requests`)
                .set(customerHeaders(chidiId, tenantId))
                .send({
                    targetPropertyUnitId: unitYId,
                    reason: 'Another attempt',
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('already pending');
        });
    });

    // ================================================================
    // STEP 4: Jinx reviews and approves the transfer
    // ================================================================
    describe('Step 4: Jinx Approves Transfer', () => {
        it('Jinx sees the pending transfer request', async () => {
            const response = await api
                .get('/transfer-requests')
                .set(adminHeaders(jinxId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.length).toBeGreaterThanOrEqual(1);

            const request = response.body.data.find((r: any) => r.id === transferRequestId);
            expect(request).toBeDefined();
            expect(request.status).toBe('PENDING');
        });

        it('Jinx approves the transfer with price adjustment handling', async () => {
            const response = await api
                .patch(`/transfer-requests/${transferRequestId}/approve`)
                .set(adminHeaders(jinxId, tenantId))
                .send({
                    reviewNotes: 'Approved - price difference will be added to mortgage principal',
                    priceAdjustmentHandling: 'ADD_TO_MORTGAGE',
                });

            expect(response.status).toBe(200);
            expect(response.body.data.message).toBe('Transfer approved successfully');
            expect(response.body.data.request.status).toBe('COMPLETED');
            expect(response.body.data.newApplication).toBeDefined();
            // New business rule: refundedAmount instead of paymentsMigrated
            expect(response.body.data.refundedAmount).toBeCloseTo(INSTALMENT_AMOUNT * 6, 2);

            applicationBId = response.body.data.newApplication.id;
        });
    });

    // ================================================================
    // STEP 5: Verify transfer results
    // ================================================================
    describe('Step 5: Verify Transfer Results', () => {
        it('Application A is marked as TRANSFERRED', async () => {
            const response = await api
                .get(`/applications/${applicationAId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('TRANSFERRED');
        });

        it('Application B exists with correct property', async () => {
            const response = await api
                .get(`/applications/${applicationBId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.propertyUnitId).toBe(unitYId);
            expect(response.body.data.totalAmount).toBe(PROPERTY_Y_PRICE);
            expect(response.body.data.transferredFromId).toBe(applicationAId);
        });

        it('Application B has no payments (fresh start)', async () => {
            // With new business rule, payments are refunded to wallet
            // New application starts without any payment records
            const payments = await prisma.applicationPayment.findMany({
                where: { applicationId: applicationBId },
            });

            expect(payments).toHaveLength(0);
        });

        it('Transfer request shows refund amount', async () => {
            const transferRequest = await prisma.propertyTransferRequest.findUnique({
                where: { id: transferRequestId },
            });

            expect(transferRequest).not.toBeNull();
            expect(transferRequest!.refundedAmount).toBeCloseTo(INSTALMENT_AMOUNT * 6, 2);
            expect(transferRequest!.refundedAt).not.toBeNull();
        });

        it('Application B starts fresh with zero payments (refund to wallet)', async () => {
            // With the new business rule, payments are refunded to wallet
            // The new application starts fresh with zero paid amount
            const application = await prisma.application.findUnique({
                where: { id: applicationBId },
                include: {
                    phases: {
                        include: {
                            paymentPhase: true,
                        },
                        orderBy: { order: 'asc' },
                    },
                },
            });

            expect(application).not.toBeNull();

            // All payment phases should start at zero
            for (const phase of application!.phases) {
                if (phase.paymentPhase) {
                    expect(phase.paymentPhase.paidAmount).toBe(0);
                }
            }
        });

        it('Target unit B3 is now RESERVED', async () => {
            const unit = await prisma.propertyUnit.findUnique({
                where: { id: unitYId },
            });

            expect(unit).not.toBeNull();
            expect(unit!.status).toBe('RESERVED');
            expect(unit!.reservedById).toBe(chidiId);
        });

        it('Transfer request shows completion details', async () => {
            const response = await api
                .get(`/transfer-requests/${transferRequestId}`)
                .set(adminHeaders(jinxId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
            expect(response.body.data.targetApplicationId).toBe(applicationBId);
            // New business rule: refundedAmount instead of paymentsMigrated
            expect(response.body.data.refundedAmount).toBeCloseTo(INSTALMENT_AMOUNT * 6, 2);
            expect(response.body.data.completedAt).not.toBeNull();
        });
    });

    // ================================================================
    // STEP 6: Chidi can continue with the new application
    // ================================================================
    describe('Step 6: Chidi Continues on Application B', () => {
        it('Application B has the same phase structure', async () => {
            const response = await api
                .get(`/applications/${applicationBId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.phases).toHaveLength(3);
            expect(response.body.data.phases[0].name).toBe('KYC & Documentation');
            expect(response.body.data.phases[1].name).toBe('Downpayment');
            expect(response.body.data.phases[2].name).toBe('Mortgage');
        });

        it('KYC phase starts fresh (new application rule)', async () => {
            const application = await prisma.application.findUnique({
                where: { id: applicationBId },
                include: { phases: { orderBy: { order: 'asc' } } },
            });

            expect(application).not.toBeNull();
            const kycPhase = application!.phases[0];
            // With new business rule, new application starts fresh - phases are PENDING
            expect(kycPhase.status).toBe('PENDING');
        });

        it('Downpayment phase starts fresh (zero paid)', async () => {
            const application = await prisma.application.findUnique({
                where: { id: applicationBId },
                include: {
                    phases: {
                        include: { paymentPhase: true },
                        orderBy: { order: 'asc' },
                    },
                },
            });

            expect(application).not.toBeNull();
            const downpaymentPhase = application!.phases.find(p => p.name === 'Downpayment');
            expect(downpaymentPhase).toBeDefined();

            // With new business rule, new application starts fresh
            expect(downpaymentPhase!.paymentPhase?.paidAmount).toBe(0);
        });
    });
});

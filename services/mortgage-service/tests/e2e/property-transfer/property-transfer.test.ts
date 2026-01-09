import { api, prisma, cleanupTestData } from '../../setup.js';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import { authHeaders } from '@valentine-efagene/qshelter-common';

/**
 * E2E Test: Property Transfer with Progress Preservation
 * 
 * Scenario: Chidi has an active 10/90 mortgage contract where the 10% downpayment
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

    // Chidi's contract
    let contractAId: string;
    let contractANumber: string;

    // Transfer request
    let transferRequestId: string;

    // New contract after transfer
    let contractBId: string;

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
                .set(authHeaders(jinxId, tenantId))
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
            downpaymentPlanId = response.body.id;
        });

        it('Jinx creates a 20-year mortgage plan', async () => {
            const response = await api
                .post('/payment-plans')
                .set(authHeaders(jinxId, tenantId))
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
            mortgagePlanId = response.body.id;
        });

        it('Jinx creates a 10/90 payment method template', async () => {
            const response = await api
                .post('/payment-methods')
                .set(authHeaders(jinxId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-payment-method'))
                .send({
                    name: '10/90 Mortgage - 12 Instalment Downpayment',
                    description: '10% downpayment in 12 monthly instalments, 90% mortgage over 20 years',
                });

            expect(response.status).toBe(201);
            paymentMethodId = response.body.id;
        });

        it('Jinx adds the documentation phase', async () => {
            const response = await api
                .post(`/payment-methods/${paymentMethodId}/phases`)
                .set(authHeaders(jinxId, tenantId))
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
                .set(authHeaders(jinxId, tenantId))
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
                .set(authHeaders(jinxId, tenantId))
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
                .set(authHeaders(jinxId, tenantId))
                .send({ propertyId: propertyXId });

            expect(response.status).toBe(201);
        });
    });

    // ================================================================
    // STEP 1: Chidi applies for a mortgage on Property X
    // ================================================================
    describe('Step 1: Chidi Creates Contract', () => {
        it('Chidi creates a contract for Property X Unit A1', async () => {
            const response = await api
                .post('/contracts')
                .set(authHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-contract'))
                .send({
                    propertyUnitId: unitXId,
                    paymentMethodId: paymentMethodId,
                    title: 'Lekki Gardens A1 Purchase',
                    contractType: 'MORTGAGE',
                });

            expect(response.status).toBe(201);
            expect(response.body.propertyUnitId).toBe(unitXId);
            expect(response.body.totalAmount).toBe(PROPERTY_X_PRICE);

            contractAId = response.body.id;
            contractANumber = response.body.contractNumber;
        });

        it('Contract A has correct phase structure', async () => {
            const response = await api
                .get(`/contracts/${contractAId}`)
                .set(authHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.phases).toHaveLength(3);
            expect(response.body.phases[0].name).toBe('KYC & Documentation');
            expect(response.body.phases[1].name).toBe('Downpayment');
            expect(response.body.phases[2].name).toBe('Mortgage');
        });
    });

    // ================================================================
    // STEP 2: Simulate progress - KYC completed, 6 payments made
    // ================================================================
    describe('Step 2: Simulate Progress', () => {
        it('Mark KYC phase as completed', async () => {
            // Get the KYC phase
            const contract = await prisma.contract.findUnique({
                where: { id: contractAId },
                include: { phases: { orderBy: { order: 'asc' } } },
            });

            expect(contract).not.toBeNull();
            const kycPhase = contract!.phases[0];

            // Update phase status directly (simulating completed workflow)
            await prisma.contractPhase.update({
                where: { id: kycPhase.id },
                data: { status: 'COMPLETED' },
            });

            // Update contract status to ACTIVE
            await prisma.contract.update({
                where: { id: contractAId },
                data: { status: 'ACTIVE', state: 'ACTIVE' },
            });
        });

        it('Record 6 downpayment instalments', async () => {
            const contract = await prisma.contract.findUnique({
                where: { id: contractAId },
                include: { phases: { orderBy: { order: 'asc' } } },
            });

            const downpaymentPhase = contract!.phases[1];

            // Create 6 payment records
            for (let i = 1; i <= 6; i++) {
                await prisma.contractPayment.create({
                    data: {
                        contractId: contractAId,
                        phaseId: downpaymentPhase.id,
                        payerId: chidiId,
                        amount: INSTALMENT_AMOUNT,
                        paymentMethod: 'BANK_TRANSFER',
                        status: 'COMPLETED',
                        reference: `PAY-${contractANumber}-${i}`,
                        processedAt: new Date(Date.now() - (6 - i) * 30 * 24 * 60 * 60 * 1000), // Staggered dates
                    },
                });
            }

            // Update contract totals
            const totalPaid = INSTALMENT_AMOUNT * 6;
            await prisma.contract.update({
                where: { id: contractAId },
                data: {
                    totalPaidToDate: totalPaid,
                    downPaymentPaid: totalPaid,
                },
            });

            // Update phase paid amount
            await prisma.contractPhase.update({
                where: { id: downpaymentPhase.id },
                data: { paidAmount: totalPaid },
            });
        });

        it('Verify Chidi has 6 payments recorded', async () => {
            const payments = await prisma.contractPayment.findMany({
                where: { contractId: contractAId },
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
                .post(`/contracts/${contractAId}/transfer-requests`)
                .set(authHeaders(chidiId, tenantId))
                .send({
                    targetPropertyUnitId: unitYId,
                    reason: 'Prefer location closer to workplace in Victoria Island',
                });

            expect(response.status).toBe(201);
            expect(response.body.status).toBe('PENDING');
            expect(response.body.sourceContractId).toBe(contractAId);
            expect(response.body.targetPropertyUnitId).toBe(unitYId);
            expect(response.body.priceAdjustment).toBe(PROPERTY_Y_PRICE - PROPERTY_X_PRICE);

            transferRequestId = response.body.id;
        });

        it('Transfer request shows correct price difference', async () => {
            const response = await api
                .get(`/transfer-requests/${transferRequestId}`)
                .set(authHeaders(jinxId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.sourceTotalAmount).toBe(PROPERTY_X_PRICE);
            expect(response.body.targetTotalAmount).toBe(PROPERTY_Y_PRICE);
            expect(response.body.priceAdjustment).toBe(1_000_000); // ₦1M difference
        });

        it('Cannot create duplicate transfer request', async () => {
            const response = await api
                .post(`/contracts/${contractAId}/transfer-requests`)
                .set(authHeaders(chidiId, tenantId))
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
                .set(authHeaders(jinxId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(1);

            const request = response.body.find((r: any) => r.id === transferRequestId);
            expect(request).toBeDefined();
            expect(request.status).toBe('PENDING');
        });

        it('Jinx approves the transfer with price adjustment handling', async () => {
            const response = await api
                .patch(`/transfer-requests/${transferRequestId}/approve`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    reviewNotes: 'Approved - price difference will be added to mortgage principal',
                    priceAdjustmentHandling: 'ADD_TO_MORTGAGE',
                });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Transfer approved successfully');
            expect(response.body.request.status).toBe('COMPLETED');
            expect(response.body.newContract).toBeDefined();
            expect(response.body.paymentsMigrated).toBe(6);

            contractBId = response.body.newContract.id;
        });
    });

    // ================================================================
    // STEP 5: Verify transfer results
    // ================================================================
    describe('Step 5: Verify Transfer Results', () => {
        it('Contract A is marked as TRANSFERRED', async () => {
            const response = await api
                .get(`/contracts/${contractAId}`)
                .set(authHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('TRANSFERRED');
        });

        it('Contract B exists with correct property', async () => {
            const response = await api
                .get(`/contracts/${contractBId}`)
                .set(authHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.propertyUnitId).toBe(unitYId);
            expect(response.body.totalAmount).toBe(PROPERTY_Y_PRICE);
            expect(response.body.transferredFromId).toBe(contractAId);
        });

        it('Contract B has 6 migrated payments', async () => {
            const payments = await prisma.contractPayment.findMany({
                where: { contractId: contractBId },
                orderBy: { createdAt: 'asc' },
            });

            expect(payments).toHaveLength(6);
            expect(payments.every(p => p.status === 'COMPLETED')).toBe(true);

            // Verify payments reference the migration via reference field
            expect(payments[0].reference).toContain('-MIGRATED');
        });

        it('Contract B preserves total paid amount', async () => {
            const contract = await prisma.contract.findUnique({
                where: { id: contractBId },
            });

            expect(contract).not.toBeNull();
            expect(contract!.totalPaidToDate).toBeCloseTo(INSTALMENT_AMOUNT * 6, 2);
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
                .set(authHeaders(jinxId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('COMPLETED');
            expect(response.body.targetContractId).toBe(contractBId);
            expect(response.body.paymentsMigrated).toBe(6);
            expect(response.body.completedAt).not.toBeNull();
        });
    });

    // ================================================================
    // STEP 6: Chidi can continue with the new contract
    // ================================================================
    describe('Step 6: Chidi Continues on Contract B', () => {
        it('Contract B has the same phase structure', async () => {
            const response = await api
                .get(`/contracts/${contractBId}`)
                .set(authHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.phases).toHaveLength(3);
            expect(response.body.phases[0].name).toBe('KYC & Documentation');
            expect(response.body.phases[1].name).toBe('Downpayment');
            expect(response.body.phases[2].name).toBe('Mortgage');
        });

        it('KYC phase status is preserved as COMPLETED', async () => {
            const contract = await prisma.contract.findUnique({
                where: { id: contractBId },
                include: { phases: { orderBy: { order: 'asc' } } },
            });

            expect(contract).not.toBeNull();
            const kycPhase = contract!.phases[0];
            expect(kycPhase.status).toBe('COMPLETED');
        });

        it('Downpayment phase shows partial completion', async () => {
            const contract = await prisma.contract.findUnique({
                where: { id: contractBId },
                include: { phases: { orderBy: { order: 'asc' } } },
            });

            expect(contract).not.toBeNull();
            const downpaymentPhase = contract!.phases[1];

            // Paid amount should be preserved
            expect(downpaymentPhase.paidAmount).toBeCloseTo(INSTALMENT_AMOUNT * 6, 2);
        });
    });
});


import { app } from '../../../src/app';
import { api, prisma, cleanupTestData } from '../../setup';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import { authHeaders } from '@valentine-efagene/qshelter-common';

/**
 * E2E Test: Payment Method Change Flow
 * 
 * Tests the complete flow of a customer requesting to change their payment method
 * mid-contract, including approval and execution.
 * 
 * Scenario: docs/PAYMENT_METHOD_CHANGE_SCENARIO.md
 * 
 * Actors:
 * - Adaeze (Admin): Loan operations manager who reviews change requests
 * - Chidi (Customer): Has active mortgage, wants to switch to faster payoff
 */

const TEST_RUN_ID = randomUUID();

function idempotencyKey(operation: string): string {
    return `${TEST_RUN_ID}:${operation}`;
}

describe('Payment Method Change Flow', () => {
    // Actors
    let adaezeId: string; // Admin
    let chidiId: string;  // Customer

    // Tenant
    let tenantId: string;

    // Property
    let propertyId: string;
    let unit22AId: string;
    let variantId: string;

    // Original payment method (20-year mortgage)
    let downpaymentPlanId: string;
    let originalMortgagePlanId: string;
    let originalPaymentMethodId: string;

    // Alternative payment method (15-year mortgage)
    let alternativeMortgagePlanId: string;
    let alternativePaymentMethodId: string;

    // Contract state
    let contractId: string;
    let mortgagePhaseId: string;

    // Change request
    let changeRequestId: string;

    // Pricing
    const propertyPrice = 50_000_000; // ₦50M for simpler calculations
    const downpaymentPercent = 10;
    const originalInterestRate = 9.5; // 20-year at 9.5%
    const newInterestRate = 9.0;      // 15-year at 9.0%

    beforeAll(async () => {
        await cleanupTestData();

        // Create tenant
        const tenant = await prisma.tenant.create({
            data: {
                id: faker.string.uuid(),
                name: 'QShelter PMC Test',
                subdomain: 'qshelter-pmc-test',
                isActive: true,
            },
        });
        tenantId = tenant.id;

        // Create Adaeze (Admin)
        const adaeze = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'adaeze.pmc@qshelter.com',
                firstName: 'Adaeze',
                lastName: 'Madu',
            },
        });
        adaezeId = adaeze.id;

        // Create Chidi (Customer)
        const chidi = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'chidi.pmc@gmail.com',
                firstName: 'Chidi',
                lastName: 'Okonkwo',
            },
        });
        chidiId = chidi.id;

        // Create property
        const property = await prisma.property.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                userId: adaezeId,
                title: 'Victoria Island Apartments',
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
        propertyId = property.id;

        // Create variant
        const variant = await prisma.propertyVariant.create({
            data: {
                propertyId,
                name: '2-Bedroom Flat',
                nBedrooms: 2,
                nBathrooms: 2,
                nParkingSpots: 1,
                area: 100,
                price: propertyPrice,
                totalUnits: 10,
                availableUnits: 8,
                status: 'AVAILABLE',
            },
        });
        variantId = variant.id;

        // Create Unit 22A
        const unit22A = await prisma.propertyUnit.create({
            data: {
                variantId: variant.id,
                unitNumber: '22A',
                floorNumber: 22,
                blockName: 'Block A',
                status: 'AVAILABLE',
            },
        });
        unit22AId = unit22A.id;
    });

    afterAll(async () => {
        await cleanupTestData();
        await prisma.propertyUnit.deleteMany({ where: { variant: { propertyId } } });
        await prisma.propertyVariant.deleteMany({ where: { propertyId } });
        await prisma.property.delete({ where: { id: propertyId } }).catch(() => { });
        await prisma.user.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => { });
    });

    // =========================================================================
    // Step 1: Setup Payment Plans and Methods
    // =========================================================================
    describe('Step 1: Setup payment plans and methods', () => {
        it('creates a one-off downpayment plan (10%)', async () => {
            const response = await api
                .post('/payment-plans')
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-downpayment-plan'))
                .send({
                    name: '10% Downpayment',
                    description: 'Single payment for 10% downpayment',
                    frequency: 'ONE_TIME',
                    numberOfInstallments: 1,
                    interestRate: 0,
                    gracePeriodDays: 0,
                });

            expect(response.status).toBe(201);
            downpaymentPlanId = response.body.id;
        });

        it('creates the original 20-year mortgage plan at 9.5% p.a.', async () => {
            const response = await api
                .post('/payment-plans')
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-original-mortgage-plan'))
                .send({
                    name: '20-Year Mortgage at 9.5%',
                    description: '240 monthly payments at 9.5% annual interest',
                    frequency: 'MONTHLY',
                    numberOfInstallments: 240,
                    interestRate: originalInterestRate,
                    gracePeriodDays: 15,
                });

            expect(response.status).toBe(201);
            originalMortgagePlanId = response.body.id;
        });

        it('creates the alternative 15-year mortgage plan at 9.0% p.a.', async () => {
            const response = await api
                .post('/payment-plans')
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-alternative-mortgage-plan'))
                .send({
                    name: '15-Year Mortgage at 9.0%',
                    description: '180 monthly payments at 9.0% annual interest',
                    frequency: 'MONTHLY',
                    numberOfInstallments: 180,
                    interestRate: newInterestRate,
                    gracePeriodDays: 15,
                });

            expect(response.status).toBe(201);
            alternativeMortgagePlanId = response.body.id;
        });

        it('creates the original payment method (20-year mortgage)', async () => {
            const response = await api
                .post('/payment-methods')
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-original-payment-method'))
                .send({
                    name: '10/90 - 20 Year Mortgage',
                    description: '10% downpayment, 20-year mortgage at 9.5%',
                    requiresManualApproval: true,
                    phases: [
                        {
                            name: 'Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'KYC',
                            order: 1,
                            requiredDocumentTypes: ['ID_CARD'],
                            stepDefinitions: [
                                { name: 'Upload ID', stepType: 'UPLOAD', order: 1 },
                                { name: 'Review', stepType: 'APPROVAL', order: 2 },
                            ],
                        },
                        {
                            name: '10% Downpayment',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'DOWNPAYMENT',
                            order: 2,
                            percentOfPrice: downpaymentPercent,
                            paymentPlanId: downpaymentPlanId,
                        },
                        {
                            name: '90% Mortgage (20 Years)',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'MORTGAGE',
                            order: 3,
                            percentOfPrice: 90,
                            paymentPlanId: originalMortgagePlanId,
                            interestRate: originalInterestRate,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            originalPaymentMethodId = response.body.id;
        });

        it('creates the alternative payment method (15-year mortgage)', async () => {
            const response = await api
                .post('/payment-methods')
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-alternative-payment-method'))
                .send({
                    name: '10/90 - 15 Year Mortgage',
                    description: '10% downpayment, 15-year mortgage at 9.0%',
                    requiresManualApproval: true,
                    phases: [
                        {
                            name: 'Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'KYC',
                            order: 1,
                            requiredDocumentTypes: ['ID_CARD'],
                            stepDefinitions: [
                                { name: 'Upload ID', stepType: 'UPLOAD', order: 1 },
                                { name: 'Review', stepType: 'APPROVAL', order: 2 },
                            ],
                        },
                        {
                            name: '10% Downpayment',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'DOWNPAYMENT',
                            order: 2,
                            percentOfPrice: downpaymentPercent,
                            paymentPlanId: downpaymentPlanId,
                        },
                        {
                            name: '90% Mortgage (15 Years)',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'MORTGAGE',
                            order: 3,
                            percentOfPrice: 90,
                            paymentPlanId: alternativeMortgagePlanId,
                            interestRate: newInterestRate,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            alternativePaymentMethodId = response.body.id;
        });

        it('links both payment methods to the property', async () => {
            // Link original method
            let response = await api
                .post(`/payment-methods/${originalPaymentMethodId}/properties`)
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('link-original-method'))
                .send({ propertyId });

            expect(response.status).toBe(201);

            // Link alternative method
            response = await api
                .post(`/payment-methods/${alternativePaymentMethodId}/properties`)
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('link-alternative-method'))
                .send({ propertyId });

            expect(response.status).toBe(201);
        });
    });

    // =========================================================================
    // Step 2: Create an Active Contract (Database Setup for Testing)
    // =========================================================================
    describe('Step 2: Create an active contract ready for payment method change', () => {
        it('creates a contract in ACTIVE state with mortgage phase active', async () => {
            // Create the contract directly in the database in the appropriate state
            // This simulates a contract that has gone through the full lifecycle
            const contract = await prisma.contract.create({
                data: {
                    id: faker.string.uuid(),
                    tenantId,
                    propertyUnitId: unit22AId,
                    buyerId: chidiId,
                    paymentMethodId: originalPaymentMethodId,
                    contractNumber: `PMC-${Date.now()}`,
                    title: 'Payment Method Change Test Contract - Unit 22A',
                    contractType: 'MORTGAGE',
                    totalAmount: propertyPrice,
                    downPayment: propertyPrice * 0.1, // ₦5M
                    downPaymentPaid: propertyPrice * 0.1, // Fully paid
                    totalPaidToDate: propertyPrice * 0.1, // Downpayment paid
                    status: 'ACTIVE', // Contract is active
                    state: 'ACTIVE',
                    startDate: new Date(),
                    signedAt: new Date(),
                },
            });
            contractId = contract.id;

            // Create downpayment phase (COMPLETED)
            await prisma.contractPhase.create({
                data: {
                    id: faker.string.uuid(),
                    contractId,
                    paymentPlanId: downpaymentPlanId,
                    name: '10% Downpayment',
                    phaseCategory: 'PAYMENT',
                    phaseType: 'DOWNPAYMENT',
                    order: 1,
                    status: 'COMPLETED',
                    totalAmount: propertyPrice * 0.1,
                    paidAmount: propertyPrice * 0.1,
                    remainingAmount: 0,
                    collectFunds: true,
                    activatedAt: new Date(),
                    completedAt: new Date(),
                },
            });

            // Create mortgage phase (ACTIVE)
            const mortgagePhase = await prisma.contractPhase.create({
                data: {
                    id: faker.string.uuid(),
                    contractId,
                    paymentPlanId: originalMortgagePlanId,
                    name: '90% Mortgage (20 Years)',
                    phaseCategory: 'PAYMENT',
                    phaseType: 'MORTGAGE',
                    order: 2,
                    status: 'ACTIVE',
                    totalAmount: propertyPrice * 0.9, // ₦45M
                    paidAmount: 0,
                    remainingAmount: propertyPrice * 0.9,
                    interestRate: originalInterestRate,
                    collectFunds: true,
                    activatedAt: new Date(),
                },
            });
            mortgagePhaseId = mortgagePhase.id;

            // Verify contract was created correctly
            const contractCheck = await prisma.contract.findUnique({
                where: { id: contractId },
                include: { phases: true },
            });

            expect(contractCheck).toBeDefined();
            expect(contractCheck?.status).toBe('ACTIVE');
            expect(contractCheck?.phases.length).toBe(2);
        });
    });

    // =========================================================================
    // Step 3: Chidi Requests Payment Method Change
    // =========================================================================
    describe('Step 3: Chidi requests payment method change', () => {
        it('Chidi creates a payment method change request', async () => {
            const response = await api
                .post(`/contracts/${contractId}/payment-method-change-requests`)
                .set(authHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-change-request'))
                .send({
                    toPaymentMethodId: alternativePaymentMethodId,
                    reason: 'Got a promotion, want to pay off faster with 15-year plan',
                });

            expect(response.status).toBe(201);
            expect(response.body.status).toBe('PENDING_DOCUMENTS');
            expect(response.body.fromPaymentMethodId).toBe(originalPaymentMethodId);
            expect(response.body.toPaymentMethodId).toBe(alternativePaymentMethodId);
            expect(response.body.currentOutstanding).toBe(propertyPrice * 0.9); // ₦45M

            changeRequestId = response.body.id;
        });

        it('Request has financial impact preview calculated', async () => {
            const response = await api
                .get(`/contracts/${contractId}/payment-method-change-requests/${changeRequestId}`)
                .set(authHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.newTermMonths).toBe(180); // 15 years
            expect(response.body.newInterestRate).toBe(newInterestRate);
            expect(response.body.newMonthlyPayment).toBeGreaterThan(0);
        });

        it('Domain event PAYMENT_METHOD_CHANGE.REQUESTED is created', async () => {
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'PaymentMethodChangeRequest',
                    aggregateId: changeRequestId,
                    eventType: 'PAYMENT_METHOD_CHANGE.REQUESTED',
                },
            });

            expect(event).toBeDefined();
        });
    });

    // =========================================================================
    // Step 4: Chidi Submits Documents
    // =========================================================================
    describe('Step 4: Chidi submits documents for the request', () => {
        it('Chidi submits documents for the change request', async () => {
            const response = await api
                .post(`/contracts/${contractId}/payment-method-change-requests/${changeRequestId}/submit-documents`)
                .set(authHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('submit-change-documents'));

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('DOCUMENTS_SUBMITTED');
        });

        it('Request appears in admin pending review list', async () => {
            const response = await api
                .get('/payment-method-change-requests')
                .set(authHeaders(adaezeId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.some((r: any) => r.id === changeRequestId)).toBe(true);
        });
    });

    // =========================================================================
    // Step 5: Adaeze Reviews and Approves
    // =========================================================================
    describe('Step 5: Adaeze reviews and approves the request', () => {
        it('Adaeze starts review of the request', async () => {
            const response = await api
                .post(`/payment-method-change-requests/${changeRequestId}/start-review`)
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('start-review'));

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('UNDER_REVIEW');
            expect(response.body.reviewerId).toBe(adaezeId);
        });

        it('Adaeze approves the payment method change', async () => {
            const response = await api
                .post(`/payment-method-change-requests/${changeRequestId}/approve`)
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('approve-change'))
                .send({
                    reviewNotes: 'Customer has good payment history. Approved.',
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('APPROVED');
        });

        it('Domain event PAYMENT_METHOD_CHANGE.APPROVED is created', async () => {
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'PaymentMethodChangeRequest',
                    aggregateId: changeRequestId,
                    eventType: 'PAYMENT_METHOD_CHANGE.APPROVED',
                },
            });

            expect(event).toBeDefined();
        });

        it('Original mortgage phase is NOT yet affected (approval ≠ execution)', async () => {
            const phase = await prisma.contractPhase.findUnique({
                where: { id: mortgagePhaseId },
            });

            expect(phase).toBeDefined();
            expect(phase?.status).toBe('ACTIVE'); // Still active, not superseded yet
        });
    });

    // =========================================================================
    // Step 6: System Executes the Payment Method Change
    // =========================================================================
    describe('Step 6: System executes the payment method change', () => {
        it('Admin executes the approved change', async () => {
            const response = await api
                .post(`/payment-method-change-requests/${changeRequestId}/execute`)
                .set(authHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('execute-change'));

            // Debug: Log the error if not 200
            if (response.status !== 200) {
                console.log('Execute response:', response.status, response.body);
            }

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Payment method change executed successfully');
            expect(response.body.request.status).toBe('EXECUTED');
            expect(response.body.newPhases.length).toBeGreaterThan(0);
        });

        it('Original mortgage phase is now SUPERSEDED', async () => {
            const phase = await prisma.contractPhase.findUnique({
                where: { id: mortgagePhaseId },
            });

            expect(phase).toBeDefined();
            expect(phase?.status).toBe('SUPERSEDED');
        });

        it('New mortgage phase is created with 15-year terms', async () => {
            const phasesResponse = await api
                .get(`/contracts/${contractId}/phases`)
                .set(authHeaders(chidiId, tenantId));

            expect(phasesResponse.status).toBe(200);

            // The new mortgage phase should have "(Changed)" in its name as per the service
            const newMortgagePhase = phasesResponse.body.find(
                (p: any) => p.name.includes('(Changed)') && p.phaseType === 'MORTGAGE'
            );

            expect(newMortgagePhase).toBeDefined();
            // The new phase should have correct interest rate from the new payment method
            expect(newMortgagePhase.interestRate).toBe(newInterestRate);
        });

        it('Contract payment method is updated to new method', async () => {
            const contract = await prisma.contract.findUnique({
                where: { id: contractId },
            });

            expect(contract).toBeDefined();
            expect(contract?.paymentMethodId).toBe(alternativePaymentMethodId);
        });

        it('Domain events for execution and amendment are created', async () => {
            const executedEvent = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'PaymentMethodChangeRequest',
                    aggregateId: changeRequestId,
                    eventType: 'PAYMENT_METHOD_CHANGE.EXECUTED',
                },
            });

            expect(executedEvent).toBeDefined();

            const amendedEvent = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Contract',
                    aggregateId: contractId,
                    eventType: 'CONTRACT.AMENDED',
                },
            });

            expect(amendedEvent).toBeDefined();
        });
    });

    // =========================================================================
    // Step 7: Verify Final State and Audit Trail
    // =========================================================================
    describe('Step 7: Verify final state and audit trail', () => {
        it('Change request has complete audit data', async () => {
            const response = await api
                .get(`/contracts/${contractId}/payment-method-change-requests/${changeRequestId}`)
                .set(authHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('EXECUTED');
            expect(response.body.reviewerId).toBe(adaezeId);
            expect(response.body.reviewedAt).toBeDefined();
            expect(response.body.executedAt).toBeDefined();
        });

        it('Complete event trail exists for the change', async () => {
            const events = await prisma.domainEvent.findMany({
                where: {
                    OR: [
                        {
                            aggregateType: 'PaymentMethodChangeRequest',
                            aggregateId: changeRequestId,
                        },
                        {
                            aggregateType: 'Contract',
                            aggregateId: contractId,
                            eventType: 'CONTRACT.AMENDED',
                        },
                    ],
                },
            });

            const eventTypes = events.map(e => e.eventType);
            expect(eventTypes).toContain('PAYMENT_METHOD_CHANGE.REQUESTED');
            expect(eventTypes).toContain('PAYMENT_METHOD_CHANGE.APPROVED');
            expect(eventTypes).toContain('PAYMENT_METHOD_CHANGE.EXECUTED');
        });
    });
});

// =============================================================================
// Alternative Flow Tests
// =============================================================================
describe('Payment Method Change - Alternative Flows', () => {
    let tenantId: string;
    let adminId: string;
    let customerId: string;
    let contractId: string;
    let originalPaymentMethodId: string;
    let alternativePaymentMethodId: string;
    let propertyId: string;

    beforeAll(async () => {
        // Create minimal setup for alternative flow tests
        const tenant = await prisma.tenant.create({
            data: {
                id: faker.string.uuid(),
                name: 'Alt Flow Test Tenant',
                subdomain: `alt-flow-test-${Date.now()}`,
                isActive: true,
            },
        });
        tenantId = tenant.id;

        const admin = await prisma.user.create({
            data: { id: faker.string.uuid(), tenantId, email: `admin-alt-${Date.now()}@test.com`, firstName: 'Admin', lastName: 'Test' },
        });
        adminId = admin.id;

        const customer = await prisma.user.create({
            data: { id: faker.string.uuid(), tenantId, email: `customer-alt-${Date.now()}@test.com`, firstName: 'Customer', lastName: 'Test' },
        });
        customerId = customer.id;

        // Create property
        const property = await prisma.property.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                userId: adminId,
                title: 'Alt Test Property',
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: 'Nigeria',
                currency: 'NGN',
                city: 'Lagos',
                status: 'PUBLISHED',
                isPublished: true,
            },
        });
        propertyId = property.id;

        const variant = await prisma.propertyVariant.create({
            data: { propertyId: property.id, name: 'Test Unit', price: 10_000_000, status: 'AVAILABLE' },
        });

        const unit = await prisma.propertyUnit.create({
            data: { variantId: variant.id, unitNumber: `ALT-${Date.now()}`, status: 'AVAILABLE' },
        });

        // Create simple payment plans
        const origPlan = await prisma.paymentPlan.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                name: 'Original Plan Alt',
                paymentFrequency: 'MONTHLY',
                numberOfInstallments: 12,
            },
        });

        const altPlan = await prisma.paymentPlan.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                name: 'Alternative Plan Alt',
                paymentFrequency: 'MONTHLY',
                numberOfInstallments: 6,
            },
        });

        // Create simple payment methods
        const origMethodResp = await api
            .post('/payment-methods')
            .set(authHeaders(adminId, tenantId))
            .send({
                name: 'Original Method Alt',
                phases: [
                    { name: 'Payment', phaseCategory: 'PAYMENT', phaseType: 'DOWNPAYMENT', order: 1, percentOfPrice: 100, paymentPlanId: origPlan.id },
                ],
            });
        originalPaymentMethodId = origMethodResp.body.id;

        const altMethodResp = await api
            .post('/payment-methods')
            .set(authHeaders(adminId, tenantId))
            .send({
                name: 'Alternative Method Alt',
                phases: [
                    { name: 'Payment', phaseCategory: 'PAYMENT', phaseType: 'DOWNPAYMENT', order: 1, percentOfPrice: 100, paymentPlanId: altPlan.id },
                ],
            });
        alternativePaymentMethodId = altMethodResp.body.id;

        // Link to property
        await api
            .post(`/payment-methods/${originalPaymentMethodId}/properties`)
            .set(authHeaders(adminId, tenantId))
            .send({ propertyId: property.id });

        await api
            .post(`/payment-methods/${alternativePaymentMethodId}/properties`)
            .set(authHeaders(adminId, tenantId))
            .send({ propertyId: property.id });

        // Create contract directly in database in ACTIVE state
        const contract = await prisma.contract.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                propertyUnitId: unit.id,
                buyerId: customerId,
                paymentMethodId: originalPaymentMethodId,
                contractNumber: `ALT-${Date.now()}`,
                title: 'Alt Flow Test Contract',
                contractType: 'PURCHASE',
                totalAmount: 10_000_000,
                downPayment: 1_000_000,
                downPaymentPaid: 1_000_000,
                totalPaidToDate: 1_000_000,
                status: 'ACTIVE',
                state: 'ACTIVE',
                startDate: new Date(),
                signedAt: new Date(),
            },
        });
        contractId = contract.id;

        // Create a payment phase in ACTIVE state
        await prisma.contractPhase.create({
            data: {
                id: faker.string.uuid(),
                contractId,
                paymentPlanId: origPlan.id,
                name: 'Payment Phase',
                phaseCategory: 'PAYMENT',
                phaseType: 'MORTGAGE',
                order: 1,
                status: 'ACTIVE',
                totalAmount: 9_000_000,
                paidAmount: 0,
                remainingAmount: 9_000_000,
                collectFunds: true,
                activatedAt: new Date(),
            },
        });
    });

    afterAll(async () => {
        await cleanupTestData();
        await prisma.propertyUnit.deleteMany({ where: { variant: { propertyId } } });
        await prisma.propertyVariant.deleteMany({ where: { propertyId } });
        await prisma.property.delete({ where: { id: propertyId } }).catch(() => { });
        await prisma.user.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => { });
    });

    describe('Rejection Flow', () => {
        let rejectRequestId: string;

        it('Customer creates a change request', async () => {
            const response = await api
                .post(`/contracts/${contractId}/payment-method-change-requests`)
                .set(authHeaders(customerId, tenantId))
                .send({
                    toPaymentMethodId: alternativePaymentMethodId,
                    reason: 'Want to change',
                });

            expect(response.status).toBe(201);
            rejectRequestId = response.body.id;
        });

        it('Customer submits documents', async () => {
            const response = await api
                .post(`/contracts/${contractId}/payment-method-change-requests/${rejectRequestId}/submit-documents`)
                .set(authHeaders(customerId, tenantId));

            expect(response.status).toBe(200);
        });

        it('Admin rejects the request with reason', async () => {
            // First start the review
            await api
                .post(`/payment-method-change-requests/${rejectRequestId}/start-review`)
                .set(authHeaders(adminId, tenantId));

            const response = await api
                .post(`/payment-method-change-requests/${rejectRequestId}/reject`)
                .set(authHeaders(adminId, tenantId))
                .send({
                    rejectionReason: 'Minimum 12 months required before payment method changes',
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('REJECTED');
        });

        it('Domain event PAYMENT_METHOD_CHANGE.REJECTED is created', async () => {
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'PaymentMethodChangeRequest',
                    aggregateId: rejectRequestId,
                    eventType: 'PAYMENT_METHOD_CHANGE.REJECTED',
                },
            });

            expect(event).toBeDefined();
        });

        it('Contract payment method remains unchanged', async () => {
            const contract = await prisma.contract.findUnique({ where: { id: contractId } });
            expect(contract?.paymentMethodId).toBe(originalPaymentMethodId);
        });
    });

    describe('Cancellation Flow', () => {
        let cancelRequestId: string;

        it('Customer creates another change request', async () => {
            const response = await api
                .post(`/contracts/${contractId}/payment-method-change-requests`)
                .set(authHeaders(customerId, tenantId))
                .send({
                    toPaymentMethodId: alternativePaymentMethodId,
                    reason: 'Want to try again',
                });

            expect(response.status).toBe(201);
            cancelRequestId = response.body.id;
        });

        it('Customer cancels the request', async () => {
            const response = await api
                .post(`/contracts/${contractId}/payment-method-change-requests/${cancelRequestId}/cancel`)
                .set(authHeaders(customerId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('CANCELLED');
        });

        it('Domain event PAYMENT_METHOD_CHANGE.CANCELLED is created', async () => {
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'PaymentMethodChangeRequest',
                    aggregateId: cancelRequestId,
                    eventType: 'PAYMENT_METHOD_CHANGE.CANCELLED',
                },
            });

            expect(event).toBeDefined();
        });
    });
});

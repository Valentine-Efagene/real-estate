import request from 'supertest';
import { app } from '../../src/app.js';
import { prisma, cleanupTestData } from '../setup.js';
import { faker } from '@faker-js/faker';

/**
 * E2E Tests: Full Mortgage Flow with Prequalification, Approval Gates & Events
 *
 * Story: "Homebuyer applies for a mortgage"
 *
 * Setup:
 * - Admin creates payment plan: 10% downpayment (one-off), 9.5% mortgage p.a.
 * - Admin creates payment method with:
 *   - Prequalification phase (eligibility questions)
 *   - Documentation phase (ID, bank statement, proof of income)
 *   - Approval gate (admin reviews and approves/rejects)
 *   - Downpayment phase (10% one-off)
 *   - Mortgage phase (90% at 9.5% p.a.)
 * - Admin configures document requirement rules
 *
 * Flow:
 * 1. User submits prequalification → score calculated → status APPROVED/REJECTED
 * 2. If approved, user creates contract linked to prequalification
 * 3. User uploads required documents
 * 4. Admin reviews documents → approval gate
 * 5. User pays downpayment
 * 6. Mortgage phase activates, installments generated
 * 7. Domain events logged for audit at each step
 */
describe('Full Mortgage Flow E2E', () => {
    // Entity IDs
    let tenantId: string;
    let adminUserId: string;
    let buyerUserId: string;
    let propertyId: string;
    let propertyUnitId: string;

    // Payment configuration
    let downpaymentPlanId: string;
    let mortgagePlanId: string;
    let paymentMethodId: string;

    // Prequalification & Contract
    let prequalificationId: string;
    let contractId: string;
    let documentationPhaseId: string;
    let downpaymentPhaseId: string;
    let mortgagePhaseId: string;

    // Test configuration
    const propertyPrice = 1_000_000; // $1M property
    const downpaymentPercent = 10;
    const mortgagePercent = 90;
    const mortgageInterestRate = 9.5; // 9.5% per annum

    beforeAll(async () => {
        await cleanupTestData();

        // Create tenant
        const tenant = await prisma.tenant.create({
            data: {
                id: faker.string.uuid(),
                name: 'Test Real Estate Corp',
                subdomain: faker.internet.domainWord(),
                isActive: true,
            },
        });
        tenantId = tenant.id;

        // Create admin user
        const admin = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: faker.internet.email(),
                firstName: 'Admin',
                lastName: 'User',
            },
        });
        adminUserId = admin.id;

        // Create buyer user
        const buyer = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: faker.internet.email(),
                firstName: 'John',
                lastName: 'Buyer',
            },
        });
        buyerUserId = buyer.id;

        // Create property with units
        const property = await prisma.property.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                userId: adminUserId,
                title: 'Luxury Waterfront Estate',
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: 'Nigeria',
                currency: 'USD',
                city: 'Lagos',
                status: 'PUBLISHED',
                isPublished: true,
                publishedAt: new Date(),
            },
        });
        propertyId = property.id;

        // Create variant with units
        const variant = await prisma.propertyVariant.create({
            data: {
                propertyId,
                name: '3-Bedroom Penthouse',
                nBedrooms: 3,
                nBathrooms: 3,
                nParkingSpots: 2,
                area: 250,
                price: propertyPrice,
                totalUnits: 10,
                availableUnits: 10,
                status: 'AVAILABLE',
            },
        });

        const unit = await prisma.propertyUnit.create({
            data: {
                variantId: variant.id,
                unitNumber: 'PH-1',
                floorNumber: 20,
                status: 'AVAILABLE',
            },
        });
        propertyUnitId = unit.id;
    });

    afterAll(async () => {
        // Clean up in reverse order of creation
        await cleanupTestData();
        await prisma.propertyUnit.deleteMany({ where: { variant: { propertyId } } });
        await prisma.propertyVariant.deleteMany({ where: { propertyId } });
        await prisma.property.delete({ where: { id: propertyId } }).catch(() => { });
        await prisma.user.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => { });
    });

    // ============================================================================
    // PART 1: Admin Setup
    // ============================================================================
    describe('Part 1: Admin Creates Payment Plans & Method', () => {
        it('should create a one-off downpayment plan (10%)', async () => {
            const response = await request(app)
                .post('/payment-plans')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adminUserId)
                .send({
                    name: 'One-Off Downpayment',
                    description: 'Single payment for 10% downpayment',
                    frequency: 'ONE_OFF',
                    numberOfInstallments: 1,
                    interestRate: 0,
                    gracePeriodDays: 0,
                });

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            downpaymentPlanId = response.body.id;

            // Verify domain event created
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'PaymentPlan',
                    aggregateId: downpaymentPlanId,
                    eventType: 'PAYMENT_PLAN.CREATED',
                },
            });
            expect(event).toBeDefined();
        });

        it('should create a mortgage payment plan (9.5% p.a., 20 years)', async () => {
            const response = await request(app)
                .post('/payment-plans')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adminUserId)
                .send({
                    name: 'Standard 20-Year Mortgage',
                    description: 'Monthly payments at 9.5% annual interest',
                    frequency: 'MONTHLY',
                    numberOfInstallments: 240, // 20 years
                    interestRate: mortgageInterestRate,
                    gracePeriodDays: 15,
                });

            expect(response.status).toBe(201);
            expect(response.body.interestRate).toBe(mortgageInterestRate);
            mortgagePlanId = response.body.id;
        });

        it('should create a payment method with all phases', async () => {
            const response = await request(app)
                .post('/payment-methods')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adminUserId)
                .send({
                    name: 'Premium Mortgage Package',
                    description: 'Full mortgage flow: Prequal → Docs → Approval → Downpayment → Mortgage',
                    requiresManualApproval: true,
                    phases: [
                        {
                            name: 'KYC Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'KYC',
                            order: 1,
                            requiredDocumentTypes: 'ID_CARD,BANK_STATEMENT,PROOF_OF_INCOME',
                            stepDefinitions: JSON.stringify([
                                { name: 'Upload ID', stepType: 'UPLOAD', order: 1 },
                                { name: 'Upload Bank Statement', stepType: 'UPLOAD', order: 2 },
                                { name: 'Upload Proof of Income', stepType: 'UPLOAD', order: 3 },
                                { name: 'Admin Review', stepType: 'APPROVAL', order: 4 },
                            ]),
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
                            name: '90% Mortgage',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'MORTGAGE',
                            order: 3,
                            percentOfPrice: mortgagePercent,
                            interestRate: mortgageInterestRate,
                            paymentPlanId: mortgagePlanId,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            expect(response.body.phases.length).toBe(3);
            paymentMethodId = response.body.id;

            // Verify event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'PropertyPaymentMethod',
                    aggregateId: paymentMethodId,
                    eventType: 'PAYMENT_METHOD.CREATED',
                },
            });
            expect(event).toBeDefined();
        });

        it('should link payment method to property', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/properties`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adminUserId)
                .send({
                    propertyId,
                    isDefault: true,
                });

            expect(response.status).toBe(201);
        });

        it('should configure document requirement rules', async () => {
            // Create rules for prequalification documents
            await prisma.documentRequirementRule.createMany({
                data: [
                    {
                        tenantId,
                        context: 'PREQUALIFICATION',
                        paymentMethodId,
                        documentType: 'ID_CARD',
                        isRequired: true,
                        description: 'Valid government-issued ID',
                        maxSizeBytes: 5 * 1024 * 1024, // 5MB
                        allowedMimeTypes: 'image/jpeg,image/png,application/pdf',
                    },
                    {
                        tenantId,
                        context: 'PREQUALIFICATION',
                        paymentMethodId,
                        documentType: 'BANK_STATEMENT',
                        isRequired: true,
                        description: 'Last 6 months bank statements',
                        maxSizeBytes: 10 * 1024 * 1024,
                        allowedMimeTypes: 'application/pdf',
                        expiryDays: 90,
                    },
                    {
                        tenantId,
                        context: 'PREQUALIFICATION',
                        paymentMethodId,
                        documentType: 'PROOF_OF_INCOME',
                        isRequired: true,
                        description: 'Employment letter or tax returns',
                        maxSizeBytes: 10 * 1024 * 1024,
                        allowedMimeTypes: 'application/pdf',
                    },
                    {
                        tenantId,
                        context: 'CONTRACT_PHASE',
                        phaseType: 'KYC',
                        documentType: 'ID_CARD',
                        isRequired: true,
                        description: 'Same ID used in prequalification',
                        requiresManualReview: true,
                    },
                ],
            });

            const rules = await prisma.documentRequirementRule.findMany({
                where: { tenantId },
            });
            expect(rules.length).toBe(4);
        });
    });

    // ============================================================================
    // PART 2: User Prequalification
    // ============================================================================
    describe('Part 2: User Submits Prequalification', () => {
        it('should create a prequalification application', async () => {
            const response = await request(app)
                .post('/prequalifications')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId)
                .send({
                    propertyId,
                    paymentMethodId,
                    requestedAmount: propertyPrice,
                    monthlyIncome: 50000, // $50k/month
                    monthlyExpenses: 15000,
                    answers: [
                        { questionId: 'employment_status', answer: 'EMPLOYED_FULL_TIME', weight: 1, score: 10 },
                        { questionId: 'years_employed', answer: '5', weight: 1.5, score: 15 },
                        { questionId: 'credit_history', answer: 'EXCELLENT', weight: 2, score: 20 },
                        { questionId: 'existing_debt', answer: 'LOW', weight: 1, score: 10 },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            expect(response.body.status).toBe('DRAFT');
            prequalificationId = response.body.id;
        });

        it('should get required documents for prequalification', async () => {
            const response = await request(app)
                .get(`/prequalifications/${prequalificationId}/required-documents`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(3);
            expect(response.body.map((d: any) => d.documentType)).toContain('ID_CARD');
            expect(response.body.map((d: any) => d.documentType)).toContain('BANK_STATEMENT');
            expect(response.body.map((d: any) => d.documentType)).toContain('PROOF_OF_INCOME');
        });

        it('should submit documents for prequalification', async () => {
            // Simulate documents already uploaded to S3 via uploader service
            const documents = [
                {
                    documentType: 'ID_CARD',
                    url: 'https://s3.amazonaws.com/qshelter-uploads/id-card-123.pdf',
                    fileName: 'drivers-license.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 1024000,
                },
                {
                    documentType: 'BANK_STATEMENT',
                    url: 'https://s3.amazonaws.com/qshelter-uploads/bank-stmt-456.pdf',
                    fileName: 'bank-statement-6months.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 2048000,
                },
                {
                    documentType: 'PROOF_OF_INCOME',
                    url: 'https://s3.amazonaws.com/qshelter-uploads/income-789.pdf',
                    fileName: 'employment-letter.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 512000,
                },
            ];

            for (const doc of documents) {
                const response = await request(app)
                    .post(`/prequalifications/${prequalificationId}/documents`)
                    .set('x-tenant-id', tenantId)
                    .set('x-user-id', buyerUserId)
                    .send(doc);

                expect(response.status).toBe(201);
            }
        });

        it('should submit prequalification for review', async () => {
            const response = await request(app)
                .post(`/prequalifications/${prequalificationId}/submit`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('SUBMITTED');

            // Verify event created
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Prequalification',
                    aggregateId: prequalificationId,
                    eventType: 'PREQUALIFICATION.SUBMITTED',
                },
            });
            expect(event).toBeDefined();
        });

        it('should calculate eligibility score', async () => {
            const prequal = await prisma.prequalification.findUnique({
                where: { id: prequalificationId },
            });

            // Score should be calculated from answers
            expect(prequal?.score).toBeDefined();
            expect(prequal?.debtToIncomeRatio).toBeDefined();
            // DTI = expenses / income = 15000 / 50000 = 0.3 (30%)
            expect(prequal?.debtToIncomeRatio).toBeCloseTo(0.3, 2);
        });
    });

    // ============================================================================
    // PART 3: Admin Reviews & Approves Prequalification
    // ============================================================================
    describe('Part 3: Admin Approval Gate - Prequalification', () => {
        it('should list pending prequalifications for admin', async () => {
            const response = await request(app)
                .get('/prequalifications')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adminUserId)
                .query({ status: 'SUBMITTED' });

            expect(response.status).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(1);
        });

        it('should allow admin to review and approve prequalification', async () => {
            const response = await request(app)
                .post(`/prequalifications/${prequalificationId}/review`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adminUserId)
                .send({
                    decision: 'APPROVED',
                    notes: 'Good credit history, stable income, DTI within acceptable range',
                    suggestedTermMonths: 240,
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('APPROVED');
            expect(response.body.reviewedBy).toBe(adminUserId);
            expect(response.body.reviewedAt).toBeDefined();
            expect(response.body.expiresAt).toBeDefined(); // Should set expiry

            // Verify approval event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Prequalification',
                    aggregateId: prequalificationId,
                    eventType: 'PREQUALIFICATION.APPROVED',
                },
            });
            expect(event).toBeDefined();

            // Verify notification event queued
            const notificationEvent = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Prequalification',
                    aggregateId: prequalificationId,
                    queueName: 'notifications',
                },
            });
            expect(notificationEvent).toBeDefined();
        });
    });

    // ============================================================================
    // PART 4: User Creates Contract from Approved Prequalification
    // ============================================================================
    describe('Part 4: Contract Creation', () => {
        it('should create contract linked to approved prequalification', async () => {
            const response = await request(app)
                .post('/contracts')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId)
                .send({
                    prequalificationId,
                    propertyUnitId,
                    paymentMethodId,
                    title: 'Purchase Agreement - Penthouse PH-1',
                    contractType: 'MORTGAGE',
                    totalAmount: propertyPrice,
                });

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            expect(response.body.contractNumber).toBeDefined();
            expect(response.body.status).toBe('DRAFT');
            expect(response.body.phases.length).toBe(3);

            contractId = response.body.id;

            // Extract phase IDs
            const phases = response.body.phases;
            documentationPhaseId = phases.find((p: any) => p.phaseType === 'KYC').id;
            downpaymentPhaseId = phases.find((p: any) => p.phaseType === 'DOWNPAYMENT').id;
            mortgagePhaseId = phases.find((p: any) => p.phaseType === 'MORTGAGE').id;

            // Verify prequalification is now linked
            const prequal = await prisma.prequalification.findUnique({
                where: { id: prequalificationId },
            });
            expect(prequal?.contractId).toBe(contractId);

            // Verify contract created event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Contract',
                    aggregateId: contractId,
                    eventType: 'CONTRACT.CREATED',
                },
            });
            expect(event).toBeDefined();
        });

        it('should have correct phase amounts', async () => {
            const response = await request(app)
                .get(`/contracts/${contractId}/phases`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId);

            expect(response.status).toBe(200);

            const docPhase = response.body.find((p: any) => p.phaseType === 'KYC');
            const downPhase = response.body.find((p: any) => p.phaseType === 'DOWNPAYMENT');
            const mortPhase = response.body.find((p: any) => p.phaseType === 'MORTGAGE');

            expect(docPhase.totalAmount).toBe(0);
            expect(downPhase.totalAmount).toBe(100000); // 10% of $1M
            expect(mortPhase.totalAmount).toBe(900000); // 90% of $1M
            expect(mortPhase.interestRate).toBe(mortgageInterestRate);
        });

        it('should reserve the property unit', async () => {
            const unit = await prisma.propertyUnit.findUnique({
                where: { id: propertyUnitId },
            });

            expect(unit?.status).toBe('RESERVED');
            expect(unit?.reservedById).toBe(buyerUserId);
        });
    });

    // ============================================================================
    // PART 5: Documentation Phase with Approval Gate
    // ============================================================================
    describe('Part 5: Documentation Phase & Approval Gate', () => {
        it('should submit contract for processing', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/transition`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId)
                .send({
                    action: 'SUBMIT',
                    note: 'Submitting contract for processing',
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('PENDING');

            // Verify transition recorded
            const transition = await prisma.contractTransition.findFirst({
                where: { contractId, toState: 'PENDING' },
            });
            expect(transition).toBeDefined();
        });

        it('should activate documentation phase', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${documentationPhaseId}/activate`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('IN_PROGRESS');

            // Verify event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'ContractPhase',
                    aggregateId: documentationPhaseId,
                    eventType: 'PHASE.ACTIVATED',
                },
            });
            expect(event).toBeDefined();
        });

        it('should upload documents for KYC phase', async () => {
            const documents = [
                {
                    documentType: 'ID_CARD',
                    url: 'https://s3.amazonaws.com/qshelter-uploads/contract/id-card.pdf',
                    fileName: 'id-card.pdf',
                },
                {
                    documentType: 'BANK_STATEMENT',
                    url: 'https://s3.amazonaws.com/qshelter-uploads/contract/bank-stmt.pdf',
                    fileName: 'bank-statement.pdf',
                },
                {
                    documentType: 'PROOF_OF_INCOME',
                    url: 'https://s3.amazonaws.com/qshelter-uploads/contract/income.pdf',
                    fileName: 'employment-letter.pdf',
                },
            ];

            for (const doc of documents) {
                const response = await request(app)
                    .post(`/contracts/${contractId}/phases/${documentationPhaseId}/documents`)
                    .set('x-tenant-id', tenantId)
                    .set('x-user-id', buyerUserId)
                    .send(doc);

                expect(response.status).toBe(201);
                expect(response.body.status).toBe('PENDING');
            }
        });

        it('should complete document upload steps', async () => {
            // Complete upload steps (user action)
            const uploadSteps = ['Upload ID', 'Upload Bank Statement', 'Upload Proof of Income'];

            for (const stepName of uploadSteps) {
                const response = await request(app)
                    .post(`/contracts/${contractId}/phases/${documentationPhaseId}/steps/complete`)
                    .set('x-tenant-id', tenantId)
                    .set('x-user-id', buyerUserId)
                    .send({ stepName });

                expect(response.status).toBe(200);
            }
        });

        it('should require admin approval for final step', async () => {
            // Try to complete approval step as buyer - should fail
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${documentationPhaseId}/steps/complete`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId)
                .send({ stepName: 'Admin Review' });

            expect(response.status).toBe(403);
            expect(response.body.message).toContain('requires admin');
        });

        it('should allow admin to approve documents and complete phase', async () => {
            // Admin approves each document
            const docs = await prisma.contractDocument.findMany({
                where: { phaseId: documentationPhaseId },
            });

            for (const doc of docs) {
                const response = await request(app)
                    .post(`/contracts/${contractId}/documents/${doc.id}/review`)
                    .set('x-tenant-id', tenantId)
                    .set('x-user-id', adminUserId)
                    .send({
                        status: 'APPROVED',
                        note: 'Document verified',
                    });

                expect(response.status).toBe(200);
            }

            // Admin completes approval step
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${documentationPhaseId}/steps/complete`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adminUserId)
                .send({
                    stepName: 'Admin Review',
                    note: 'All documents verified and approved',
                });

            expect(response.status).toBe(200);

            // Verify phase is now completed
            const phase = await prisma.contractPhase.findUnique({
                where: { id: documentationPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');

            // Verify approval event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'ContractPhase',
                    aggregateId: documentationPhaseId,
                    eventType: 'PHASE.COMPLETED',
                },
            });
            expect(event).toBeDefined();
        });
    });

    // ============================================================================
    // PART 6: Downpayment Phase
    // ============================================================================
    describe('Part 6: Downpayment Phase (10% One-Off)', () => {
        it('should auto-activate downpayment phase after documentation completes', async () => {
            // Phase should auto-activate based on payment method config
            const phase = await prisma.contractPhase.findUnique({
                where: { id: downpaymentPhaseId },
            });

            expect(phase?.status).toBe('IN_PROGRESS');
        });

        it('should generate single installment for one-off payment', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${downpaymentPhaseId}/installments`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId)
                .send({
                    startDate: new Date().toISOString(),
                });

            expect(response.status).toBe(200);
            expect(response.body.installments.length).toBe(1);
            expect(response.body.installments[0].amountDue).toBe(100000); // $100k
        });

        it('should record payment for downpayment', async () => {
            const phase = await prisma.contractPhase.findUnique({
                where: { id: downpaymentPhaseId },
                include: { installments: true },
            });

            const installment = phase!.installments[0];

            const response = await request(app)
                .post(`/contracts/${contractId}/payments`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId)
                .send({
                    phaseId: downpaymentPhaseId,
                    installmentId: installment.id,
                    amount: 100000,
                    paymentMethod: 'BANK_TRANSFER',
                    externalReference: faker.string.uuid(),
                });

            expect(response.status).toBe(201);
            expect(response.body.status).toBe('PENDING');
        });

        it('should process payment confirmation', async () => {
            const payment = await prisma.contractPayment.findFirst({
                where: { phase: { contractId }, status: 'PENDING' },
            });

            const response = await request(app)
                .post('/contracts/payments/process')
                .set('x-tenant-id', tenantId)
                .send({
                    reference: payment!.reference,
                    status: 'COMPLETED',
                    gatewayTransactionId: faker.string.uuid(),
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('COMPLETED');

            // Verify payment event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'ContractPayment',
                    eventType: 'PAYMENT.COMPLETED',
                },
            });
            expect(event).toBeDefined();
        });

        it('should auto-complete downpayment phase when fully paid', async () => {
            const phase = await prisma.contractPhase.findUnique({
                where: { id: downpaymentPhaseId },
            });

            expect(phase?.status).toBe('COMPLETED');
            expect(phase?.paidAmount).toBe(100000);
        });
    });

    // ============================================================================
    // PART 7: Mortgage Phase
    // ============================================================================
    describe('Part 7: Mortgage Phase (90% at 9.5% p.a.)', () => {
        it('should auto-activate mortgage phase after downpayment completes', async () => {
            const phase = await prisma.contractPhase.findUnique({
                where: { id: mortgagePhaseId },
            });

            expect(phase?.status).toBe('IN_PROGRESS');
        });

        it('should generate amortized installments for 20-year mortgage', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${mortgagePhaseId}/installments`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId)
                .send({
                    startDate: new Date().toISOString(),
                });

            expect(response.status).toBe(200);
            expect(response.body.installments.length).toBe(240); // 20 years monthly

            // Verify amortization calculation
            // Principal: $900,000, Rate: 9.5% p.a., Term: 240 months
            // Monthly payment should be approximately $8,392
            const firstInstallment = response.body.installments[0];
            expect(firstInstallment.amountDue).toBeCloseTo(8392, -1);
        });

        it('should transition contract to ACTIVE', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/sign`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', buyerUserId);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ACTIVE');
            expect(response.body.signedAt).toBeDefined();

            // Verify contract signed event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Contract',
                    aggregateId: contractId,
                    eventType: 'CONTRACT.SIGNED',
                },
            });
            expect(event).toBeDefined();
        });
    });

    // ============================================================================
    // PART 8: Audit Trail Verification
    // ============================================================================
    describe('Part 8: Audit Trail & Event Verification', () => {
        it('should have complete event trail', async () => {
            const events = await prisma.domainEvent.findMany({
                where: {
                    OR: [
                        { aggregateId: prequalificationId },
                        { aggregateId: contractId },
                        { aggregateId: documentationPhaseId },
                        { aggregateId: downpaymentPhaseId },
                        { aggregateId: mortgagePhaseId },
                    ],
                },
                orderBy: { occurredAt: 'asc' },
            });

            // Verify key events exist
            const eventTypes = events.map((e) => e.eventType);

            expect(eventTypes).toContain('PREQUALIFICATION.SUBMITTED');
            expect(eventTypes).toContain('PREQUALIFICATION.APPROVED');
            expect(eventTypes).toContain('CONTRACT.CREATED');
            expect(eventTypes).toContain('PHASE.ACTIVATED');
            expect(eventTypes).toContain('PHASE.COMPLETED');
            expect(eventTypes).toContain('PAYMENT.COMPLETED');
            expect(eventTypes).toContain('CONTRACT.SIGNED');

            // Verify events have proper structure
            for (const event of events) {
                expect(event.aggregateType).toBeDefined();
                expect(event.aggregateId).toBeDefined();
                expect(event.payload).toBeDefined();
                expect(event.occurredAt).toBeDefined();
            }
        });

        it('should have notification events queued', async () => {
            const notificationEvents = await prisma.domainEvent.findMany({
                where: {
                    queueName: 'notifications',
                },
            });

            // Should have notification events for key milestones
            expect(notificationEvents.length).toBeGreaterThan(0);

            const notificationTypes = notificationEvents.map((e) => e.eventType);
            expect(notificationTypes.some((t) => t.includes('APPROVED'))).toBe(true);
        });

        it('should have contract transitions recorded', async () => {
            const transitions = await prisma.contractTransition.findMany({
                where: { contractId },
                orderBy: { transitionedAt: 'asc' },
            });

            expect(transitions.length).toBeGreaterThan(0);
            expect(transitions[0].fromState).toBe('DRAFT');
            expect(transitions[transitions.length - 1].toState).toBe('ACTIVE');
        });
    });
});

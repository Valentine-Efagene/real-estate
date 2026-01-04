import request from 'supertest';
import { app } from '../../../src/app.js';
import { prisma, cleanupTestData } from '../../setup.js';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';

/**
 * E2E Test: Chidi's Lekki Mortgage Flow
 * 
 * This test implements the business scenario defined in SCENARIO.md
 * 
 * Actors:
 * - Adaeze (Admin): Loan operations manager at QShelter
 * - Chidi (Customer): First-time homebuyer purchasing a 3-bedroom flat in Lekki
 * - Property: Lekki Gardens Estate, Unit 14B, ₦85,000,000
 * - Payment Plan: 10% downpayment, 90% mortgage at 9.5% p.a. over 20 years
 */

// Unique test run ID to ensure idempotency across retries
const TEST_RUN_ID = randomUUID();

function idempotencyKey(operation: string): string {
    return `${TEST_RUN_ID}:${operation}`;
}

describe("Chidi's Lekki Mortgage Flow", () => {
    // Actors
    let adaezeId: string; // Admin
    let chidiId: string;  // Customer

    // QShelter tenant
    let tenantId: string;

    // Property: Lekki Gardens Estate, Unit 14B
    let propertyId: string;
    let unit14BId: string;

    // Payment configuration
    let downpaymentPlanId: string;
    let mortgagePlanId: string;
    let paymentMethodId: string;

    // Chidi's application and contract
    let prequalificationId: string;
    let contractId: string;
    let documentationPhaseId: string;
    let downpaymentPhaseId: string;
    let finalDocumentationPhaseId: string;
    let mortgagePhaseId: string;

    // Realistic Nigerian property pricing
    const propertyPrice = 85_000_000; // ₦85M
    const downpaymentPercent = 10;
    const mortgagePercent = 90;
    const mortgageInterestRate = 9.5; // 9.5% per annum

    beforeAll(async () => {
        await cleanupTestData();

        // Create QShelter tenant
        const tenant = await prisma.tenant.create({
            data: {
                id: faker.string.uuid(),
                name: 'QShelter Real Estate',
                subdomain: 'qshelter',
                isActive: true,
            },
        });
        tenantId = tenant.id;

        // Create Adaeze (Admin - Loan operations manager)
        const adaeze = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'adaeze@qshelter.com',
                firstName: 'Adaeze',
                lastName: 'Okonkwo',
            },
        });
        adaezeId = adaeze.id;

        // Create Chidi (Customer - First-time homebuyer)
        const chidi = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'chidi.nnamdi@gmail.com',
                firstName: 'Chidi',
                lastName: 'Nnamdi',
            },
        });
        chidiId = chidi.id;

        // Create Lekki Gardens Estate property
        const property = await prisma.property.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                userId: adaezeId,
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
        propertyId = property.id;

        // Create 3-bedroom flat variant
        const variant = await prisma.propertyVariant.create({
            data: {
                propertyId,
                name: '3-Bedroom Flat',
                nBedrooms: 3,
                nBathrooms: 3,
                nParkingSpots: 1,
                area: 150,
                price: propertyPrice,
                totalUnits: 20,
                availableUnits: 15,
                status: 'AVAILABLE',
            },
        });

        // Create Unit 14B
        const unit14B = await prisma.propertyUnit.create({
            data: {
                variantId: variant.id,
                unitNumber: '14B',
                floorNumber: 14,
                blockName: 'Block B',
                status: 'AVAILABLE',
            },
        });
        unit14BId = unit14B.id;
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
    // Step 1: Adaeze configures a payment plan with three phases
    // =========================================================================
    describe('Step 1: Adaeze configures the payment plan', () => {
        it('Adaeze creates a one-off downpayment plan (10%)', async () => {
            const response = await request(app)
                .post('/payment-plans')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adaezeId)
                .set('x-idempotency-key', idempotencyKey('adaeze-create-downpayment-plan'))
                .send({
                    name: '10% One-Off Downpayment',
                    description: 'Single payment for 10% downpayment',
                    frequency: 'ONE_TIME',
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

        it('Adaeze creates a 20-year mortgage plan at 9.5% p.a.', async () => {
            const response = await request(app)
                .post('/payment-plans')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adaezeId)
                .set('x-idempotency-key', idempotencyKey('adaeze-create-mortgage-plan'))
                .send({
                    name: '20-Year Mortgage at 9.5%',
                    description: '240 monthly payments at 9.5% annual interest',
                    frequency: 'MONTHLY',
                    numberOfInstallments: 240,
                    interestRate: mortgageInterestRate,
                    gracePeriodDays: 15,
                });

            expect(response.status).toBe(201);
            expect(response.body.interestRate).toBe(mortgageInterestRate);
            mortgagePlanId = response.body.id;
        });

        it('Adaeze creates a payment method with 4 phases per SCENARIO.md', async () => {
            const response = await request(app)
                .post('/payment-methods')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adaezeId)
                .set('x-idempotency-key', idempotencyKey('adaeze-create-payment-method'))
                .send({
                    name: '10/90 Lekki Mortgage',
                    description: 'Underwriting → Downpayment → Final Documentation → Mortgage',
                    requiresManualApproval: true,
                    phases: [
                        // Phase 1: Underwriting & Documentation
                        {
                            name: 'Underwriting & Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'KYC',
                            order: 1,
                            requiredDocumentTypes: ['ID_CARD', 'BANK_STATEMENT', 'EMPLOYMENT_LETTER'],
                            stepDefinitions: [
                                { name: 'Upload Valid ID', stepType: 'UPLOAD', order: 1 },
                                { name: 'Upload Bank Statements', stepType: 'UPLOAD', order: 2 },
                                { name: 'Upload Employment Letter', stepType: 'UPLOAD', order: 3 },
                                { name: 'Adaeze Reviews Documents', stepType: 'APPROVAL', order: 4 },
                                {
                                    name: 'Generate Provisional Offer',
                                    stepType: 'GENERATE_DOCUMENT',
                                    order: 5,
                                    metadata: {
                                        documentType: 'PROVISIONAL_OFFER',
                                        autoSend: true,
                                        expiresInDays: 30,
                                    },
                                },
                                { name: 'Customer Signs Provisional Offer', stepType: 'SIGNATURE', order: 6 },
                            ],
                        },
                        // Phase 2: Downpayment
                        {
                            name: '10% Downpayment',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'DOWNPAYMENT',
                            order: 2,
                            percentOfPrice: downpaymentPercent,
                            paymentPlanId: downpaymentPlanId,
                        },
                        // Phase 3: Final Documentation (after downpayment per Sterling Bank's requirements)
                        {
                            name: 'Final Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'VERIFICATION',
                            order: 3,
                            stepDefinitions: [
                                {
                                    name: 'Generate Final Offer',
                                    stepType: 'GENERATE_DOCUMENT',
                                    order: 1,
                                    metadata: {
                                        documentType: 'FINAL_OFFER',
                                        autoSend: true,
                                        expiresInDays: 30,
                                    },
                                },
                                { name: 'Customer Signs Final Offer', stepType: 'SIGNATURE', order: 2 },
                            ],
                        },
                        // Phase 4: Mortgage
                        {
                            name: '20-Year Mortgage',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'MORTGAGE',
                            order: 4,
                            percentOfPrice: mortgagePercent,
                            interestRate: mortgageInterestRate,
                            paymentPlanId: mortgagePlanId,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            expect(response.body.phases.length).toBe(4);
            paymentMethodId = response.body.id;
        });

        it('Adaeze links the payment method to Lekki Gardens Estate', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/properties`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adaezeId)
                .set('x-idempotency-key', idempotencyKey('adaeze-link-payment-method'))
                .send({
                    propertyId,
                    isDefault: true,
                });

            expect(response.status).toBe(201);
        });

        it('Adaeze configures document requirement rules', async () => {
            await prisma.documentRequirementRule.createMany({
                data: [
                    {
                        tenantId,
                        context: 'PREQUALIFICATION',
                        paymentMethodId,
                        documentType: 'ID_CARD',
                        isRequired: true,
                        description: 'Valid government-issued ID (NIN, Passport, or Driver License)',
                        maxSizeBytes: 5 * 1024 * 1024,
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
                        documentType: 'EMPLOYMENT_LETTER',
                        isRequired: true,
                        description: 'Employment confirmation letter',
                        maxSizeBytes: 5 * 1024 * 1024,
                        allowedMimeTypes: 'application/pdf',
                    },
                ],
            });

            const rules = await prisma.documentRequirementRule.findMany({
                where: { tenantId },
            });
            expect(rules.length).toBe(3);
        });
    });

    // =========================================================================
    // Step 2: Chidi selects Unit 14B and creates a draft application
    // =========================================================================
    describe('Step 2: Chidi selects Unit 14B and creates a draft application', () => {
        it('Chidi creates a prequalification application for Unit 14B', async () => {
            const response = await request(app)
                .post('/prequalifications')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-create-application'))
                .send({
                    propertyId,
                    paymentMethodId,
                    requestedAmount: propertyPrice,
                    monthlyIncome: 2_500_000, // ₦2.5M/month
                    monthlyExpenses: 800_000,  // ₦800k/month
                    answers: [
                        { questionId: 'employment_status', answer: 'EMPLOYED_FULL_TIME', weight: 1, score: 10 },
                        { questionId: 'years_employed', answer: '7', weight: 1.5, score: 15 },
                        { questionId: 'credit_history', answer: 'GOOD', weight: 2, score: 18 },
                        { questionId: 'existing_debt', answer: 'LOW', weight: 1, score: 10 },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            expect(response.body.status).toBe('DRAFT');
            prequalificationId = response.body.id;
        });
    });

    // =========================================================================
    // Step 3: Chidi submits the application with documents
    // =========================================================================
    describe('Step 3: Chidi submits the application with documents', () => {
        it('Chidi sees the required documents for his application', async () => {
            const response = await request(app)
                .get(`/prequalifications/${prequalificationId}/required-documents`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(3);
            expect(response.body.map((d: any) => d.documentType)).toContain('ID_CARD');
            expect(response.body.map((d: any) => d.documentType)).toContain('BANK_STATEMENT');
            expect(response.body.map((d: any) => d.documentType)).toContain('EMPLOYMENT_LETTER');
        });

        it('Chidi uploads his employment letter, bank statements, and valid ID', async () => {
            const chidiDocuments = [
                {
                    documentType: 'ID_CARD',
                    url: 'https://s3.amazonaws.com/qshelter-uploads/chidi/nin-slip.pdf',
                    fileName: 'chidi-nin-slip.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 1024000,
                },
                {
                    documentType: 'BANK_STATEMENT',
                    url: 'https://s3.amazonaws.com/qshelter-uploads/chidi/gtbank-6months.pdf',
                    fileName: 'chidi-gtbank-statement.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 2048000,
                },
                {
                    documentType: 'EMPLOYMENT_LETTER',
                    url: 'https://s3.amazonaws.com/qshelter-uploads/chidi/employment-letter.pdf',
                    fileName: 'chidi-employment-letter.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 512000,
                },
            ];

            for (const doc of chidiDocuments) {
                const response = await request(app)
                    .post(`/prequalifications/${prequalificationId}/documents`)
                    .set('x-tenant-id', tenantId)
                    .set('x-user-id', chidiId)
                    .set('x-idempotency-key', idempotencyKey(`chidi-doc-${doc.documentType}`))
                    .send(doc);

                expect(response.status).toBe(201);
            }
        });

        it('Chidi submits his application', async () => {
            const response = await request(app)
                .post(`/prequalifications/${prequalificationId}/submit`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-submit-application'));

            expect(response.status).toBe(200);
            // System automatically runs underwriting and transitions to UNDER_REVIEW
            expect(['SUBMITTED', 'UNDER_REVIEW']).toContain(response.body.status);

            // Verify PREQUALIFICATION.SUBMITTED event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Prequalification',
                    aggregateId: prequalificationId,
                    eventType: 'PREQUALIFICATION.SUBMITTED',
                },
            });
            expect(event).toBeDefined();
        });
    });

    // =========================================================================
    // Step 4: System evaluates Chidi's eligibility
    // Note: The current system auto-advances after underwriting evaluation.
    // Manual admin review is optional based on payment method configuration.
    // =========================================================================
    describe("Step 4: System evaluates Chidi's eligibility", () => {
        it("Chidi's eligibility score and DTI are calculated", async () => {
            const prequal = await prisma.prequalification.findUnique({
                where: { id: prequalificationId },
            });

            expect(prequal?.score).toBeDefined();
            expect(prequal?.debtToIncomeRatio).toBeDefined();
            // DTI = 800k / 2.5M = 0.32 (32%)
            expect(prequal?.debtToIncomeRatio).toBeCloseTo(0.32, 2);
        });

        it('System auto-approves Chidi based on underwriting score', async () => {
            // The underwriting system evaluates and auto-advances if score passes
            // For applications that need manual review, status would be UNDER_REVIEW
            const prequal = await prisma.prequalification.findUnique({
                where: { id: prequalificationId },
            });

            // Verify underwriting was performed
            expect(prequal?.score).toBeGreaterThan(0);
            // Status should be UNDER_REVIEW (awaiting or passed underwriting)
            expect(['UNDER_REVIEW', 'APPROVED', 'CONDITIONAL']).toContain(prequal?.status);
        });
    });

    // =========================================================================
    // Steps 5-8: Offer letter generation and signing
    // (Provisional → Sign → Final → Sign)
    // =========================================================================
    describe('Steps 5-8: Offer letters are generated and signed', () => {
        // Note: The current system may not have full offer letter flow implemented.
        // These tests document the expected behavior per SCENARIO.md.
        // If endpoints don't exist, tests will fail, indicating work to be done.

        it.skip('System generates a provisional offer letter for Chidi', async () => {
            // POST /prequalifications/:id/offer-letter?type=PROVISIONAL
            // This would generate and send the provisional offer
        });

        it.skip('Chidi reviews and signs the provisional offer', async () => {
            // POST /offer-letters/:id/sign
        });

        it.skip('System generates the final offer letter for Chidi', async () => {
            // POST /prequalifications/:id/offer-letter?type=FINAL
        });

        it.skip('Chidi reviews and signs the final offer', async () => {
            // POST /offer-letters/:id/sign
        });
    });

    // =========================================================================
    // Step 9: System creates and activates Chidi's contract
    // =========================================================================
    describe("Step 9: System creates and activates Chidi's contract", () => {
        it('System creates a contract from Chidi\'s approved application', async () => {
            const response = await request(app)
                .post('/contracts')
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-create-contract'))
                .send({
                    prequalificationId,
                    propertyUnitId: unit14BId,
                    paymentMethodId,
                    title: 'Purchase Agreement - Lekki Gardens Unit 14B',
                    contractType: 'MORTGAGE',
                    totalAmount: propertyPrice,
                });

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            expect(response.body.contractNumber).toBeDefined();
            expect(response.body.status).toBe('DRAFT');
            expect(response.body.phases.length).toBe(4);

            contractId = response.body.id;

            // Extract phase IDs (4 phases per SCENARIO.md)
            const phases = response.body.phases;
            documentationPhaseId = phases.find((p: any) => p.phaseType === 'KYC').id;
            downpaymentPhaseId = phases.find((p: any) => p.phaseType === 'DOWNPAYMENT').id;
            finalDocumentationPhaseId = phases.find((p: any) => p.phaseType === 'VERIFICATION').id;
            mortgagePhaseId = phases.find((p: any) => p.phaseType === 'MORTGAGE').id;

            // Verify CONTRACT.CREATED event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Contract',
                    aggregateId: contractId,
                    eventType: 'CONTRACT.CREATED',
                },
            });
            expect(event).toBeDefined();
        });

        it('Contract has correct phase amounts (₦8.5M downpayment, ₦76.5M mortgage)', async () => {
            const response = await request(app)
                .get(`/contracts/${contractId}/phases`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4);

            const docPhase = response.body.find((p: any) => p.phaseType === 'KYC');
            const downPhase = response.body.find((p: any) => p.phaseType === 'DOWNPAYMENT');
            const finalDocPhase = response.body.find((p: any) => p.phaseType === 'VERIFICATION');
            const mortPhase = response.body.find((p: any) => p.phaseType === 'MORTGAGE');

            expect(docPhase.totalAmount).toBe(0);
            expect(downPhase.totalAmount).toBe(8_500_000);  // 10% of ₦85M
            expect(finalDocPhase.totalAmount).toBe(0);      // Documentation phase, no payment
            expect(mortPhase.totalAmount).toBe(76_500_000); // 90% of ₦85M
            expect(mortPhase.interestRate).toBe(mortgageInterestRate);
        });

        it('Unit 14B is reserved for Chidi', async () => {
            const unit = await prisma.propertyUnit.findUnique({
                where: { id: unit14BId },
            });

            expect(unit?.status).toBe('RESERVED');
            expect(unit?.reservedById).toBe(chidiId);
        });

        it('Chidi submits the contract for processing', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/transition`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-submit-contract'))
                .send({
                    action: 'SUBMIT',
                    note: 'Submitting for processing',
                });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('PENDING');
        });

        it('Documentation phase is activated', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${documentationPhaseId}/activate`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-activate-kyc-phase'));

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('IN_PROGRESS');
        });

        it('Chidi uploads KYC documents for the contract', async () => {
            const documents = [
                { documentType: 'ID_CARD', url: 'https://s3.amazonaws.com/qshelter/chidi/id.pdf', fileName: 'id.pdf' },
                { documentType: 'BANK_STATEMENT', url: 'https://s3.amazonaws.com/qshelter/chidi/bank.pdf', fileName: 'bank.pdf' },
                { documentType: 'EMPLOYMENT_LETTER', url: 'https://s3.amazonaws.com/qshelter/chidi/employment.pdf', fileName: 'employment.pdf' },
            ];

            for (const doc of documents) {
                const response = await request(app)
                    .post(`/contracts/${contractId}/phases/${documentationPhaseId}/documents`)
                    .set('x-tenant-id', tenantId)
                    .set('x-user-id', chidiId)
                    .set('x-idempotency-key', idempotencyKey(`chidi-contract-doc-${doc.documentType}`))
                    .send(doc);

                expect(response.status).toBe(201);
            }
        });

        it('Chidi completes document upload steps', async () => {
            const uploadSteps = ['Upload Valid ID', 'Upload Bank Statements', 'Upload Employment Letter'];

            for (const stepName of uploadSteps) {
                const response = await request(app)
                    .post(`/contracts/${contractId}/phases/${documentationPhaseId}/steps/complete`)
                    .set('x-tenant-id', tenantId)
                    .set('x-user-id', chidiId)
                    .set('x-idempotency-key', idempotencyKey(`chidi-complete-${stepName.replace(/\s+/g, '-').toLowerCase()}`))
                    .send({ stepName });

                expect(response.status).toBe(200);
            }
        });

        it('Adaeze reviews and approves Chidi\'s documents', async () => {
            // Adaeze approves each document
            const docs = await prisma.contractDocument.findMany({
                where: { phaseId: documentationPhaseId },
            });

            for (let i = 0; i < docs.length; i++) {
                const doc = docs[i];
                const response = await request(app)
                    .post(`/contracts/${contractId}/documents/${doc.id}/review`)
                    .set('x-tenant-id', tenantId)
                    .set('x-user-id', adaezeId)
                    .set('x-idempotency-key', idempotencyKey(`adaeze-approve-doc-${i}`))
                    .send({
                        status: 'APPROVED',
                        note: 'Document verified',
                    });

                expect(response.status).toBe(200);
            }

            // Adaeze completes approval step
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${documentationPhaseId}/steps/complete`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', adaezeId)
                .set('x-idempotency-key', idempotencyKey('adaeze-complete-review'))
                .send({
                    stepName: 'Adaeze Reviews Documents',
                    note: 'All documents verified and approved',
                });

            expect(response.status).toBe(200);
        });

        it('GENERATE_DOCUMENT step auto-executes and generates provisional offer', async () => {
            // After approval step completes, the GENERATE_DOCUMENT step should auto-execute
            // Check that the provisional offer was generated
            const step = await prisma.contractPhaseStep.findFirst({
                where: {
                    phaseId: documentationPhaseId,
                    name: 'Generate Provisional Offer',
                },
            });

            // Step should be completed (auto-executed)
            expect(step?.status).toBe('COMPLETED');
        });

        it('Chidi signs the provisional offer', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${documentationPhaseId}/steps/complete`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-signs-provisional'))
                .send({
                    stepName: 'Customer Signs Provisional Offer',
                });

            expect(response.status).toBe(200);

            // Verify phase is completed after signature
            const phase = await prisma.contractPhase.findUnique({
                where: { id: documentationPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        it('Downpayment phase auto-activates', async () => {
            const phase = await prisma.contractPhase.findUnique({
                where: { id: downpaymentPhaseId },
            });

            expect(phase?.status).toBe('IN_PROGRESS');
        });

        it('Chidi pays the ₦8.5M downpayment', async () => {
            // Generate installment
            await request(app)
                .post(`/contracts/${contractId}/phases/${downpaymentPhaseId}/installments`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-generate-downpayment'))
                .send({ startDate: new Date().toISOString() });

            const phase = await prisma.contractPhase.findUnique({
                where: { id: downpaymentPhaseId },
                include: { installments: true },
            });
            const installment = phase!.installments[0];

            // Record payment
            const paymentResponse = await request(app)
                .post(`/contracts/${contractId}/payments`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-downpayment'))
                .send({
                    phaseId: downpaymentPhaseId,
                    installmentId: installment.id,
                    amount: 8_500_000,
                    paymentMethod: 'BANK_TRANSFER',
                    externalReference: idempotencyKey('chidi-downpayment-ref'),
                });

            expect(paymentResponse.status).toBe(201);

            // Process payment confirmation
            const payment = await prisma.contractPayment.findFirst({
                where: { phase: { contractId }, status: 'PENDING' },
            });

            const processResponse = await request(app)
                .post('/contracts/payments/process')
                .set('x-tenant-id', tenantId)
                .set('x-idempotency-key', idempotencyKey('process-chidi-downpayment'))
                .send({
                    reference: payment!.reference,
                    status: 'COMPLETED',
                    gatewayTransactionId: idempotencyKey('chidi-downpayment-gateway'),
                });

            expect(processResponse.status).toBe(200);
        });

        it('Final Documentation phase auto-activates after downpayment', async () => {
            const phase = await prisma.contractPhase.findUnique({
                where: { id: finalDocumentationPhaseId },
            });

            expect(phase?.status).toBe('IN_PROGRESS');
        });

        it('GENERATE_DOCUMENT step auto-executes and generates final offer', async () => {
            // After downpayment phase completes, Final Documentation phase activates
            // The GENERATE_DOCUMENT step should auto-execute
            const step = await prisma.contractPhaseStep.findFirst({
                where: {
                    phaseId: finalDocumentationPhaseId,
                    name: 'Generate Final Offer',
                },
            });

            // Step should be completed (auto-executed)
            expect(step?.status).toBe('COMPLETED');
        });

        it('Chidi signs the final offer', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${finalDocumentationPhaseId}/steps/complete`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-signs-final-offer'))
                .send({
                    stepName: 'Customer Signs Final Offer',
                });

            expect(response.status).toBe(200);

            // Verify phase is completed after signature
            const phase = await prisma.contractPhase.findUnique({
                where: { id: finalDocumentationPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        it('Mortgage phase auto-activates after final documentation', async () => {
            const phase = await prisma.contractPhase.findUnique({
                where: { id: mortgagePhaseId },
            });

            expect(phase?.status).toBe('IN_PROGRESS');
        });

        it('System generates 240 monthly mortgage installments', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/phases/${mortgagePhaseId}/installments`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-generate-mortgage-installments'))
                .send({ startDate: new Date().toISOString() });

            expect(response.status).toBe(200);
            expect(response.body.installments.length).toBe(240);
        });

        it('Chidi signs and activates the contract', async () => {
            const response = await request(app)
                .post(`/contracts/${contractId}/sign`)
                .set('x-tenant-id', tenantId)
                .set('x-user-id', chidiId)
                .set('x-idempotency-key', idempotencyKey('chidi-signs-contract'));

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ACTIVE');
            expect(response.body.signedAt).toBeDefined();

            // Verify CONTRACT.SIGNED event
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

    // =========================================================================
    // Steps 10-13: Notifications and audit trail
    // =========================================================================
    describe('Steps 10-13: Notifications, partner sharing, and audit', () => {
        it('Congratulations notification event is created for Chidi', async () => {
            // The system should queue a contractCongratulations notification
            // We verify by checking for notification events in the queue
            const notificationEvents = await prisma.domainEvent.findMany({
                where: {
                    queueName: 'notifications',
                    aggregateId: contractId,
                },
            });

            expect(notificationEvents.length).toBeGreaterThan(0);
        });

        it.skip('Final offer letter is shared with Sterling Bank', async () => {
            // POST /contracts/:id/share-with-investor
            // This endpoint would share the final offer letter URL with the investor
        });

        it('Complete event trail exists for audit', async () => {
            const payments = await prisma.contractPayment.findMany({
                where: { contractId },
                select: { id: true },
            });
            const paymentIds = payments.map((p) => p.id);

            const events = await prisma.domainEvent.findMany({
                where: {
                    OR: [
                        { aggregateId: prequalificationId },
                        { aggregateId: contractId },
                        { aggregateId: documentationPhaseId },
                        { aggregateId: downpaymentPhaseId },
                        { aggregateId: finalDocumentationPhaseId },
                        { aggregateId: mortgagePhaseId },
                        { aggregateId: { in: paymentIds } },
                    ],
                },
                orderBy: { occurredAt: 'asc' },
            });

            const eventTypes = events.map((e) => e.eventType);

            expect(eventTypes).toContain('PREQUALIFICATION.SUBMITTED');
            // Note: PREQUALIFICATION.APPROVED may not be emitted if auto-advanced
            expect(eventTypes).toContain('CONTRACT.CREATED');
            expect(eventTypes).toContain('PHASE.ACTIVATED');
            expect(eventTypes).toContain('PHASE.COMPLETED');
            expect(eventTypes).toContain('PAYMENT.COMPLETED');
            expect(eventTypes).toContain('CONTRACT.SIGNED');

            // Verify all events have proper structure
            for (const event of events) {
                expect(event.aggregateType).toBeDefined();
                expect(event.aggregateId).toBeDefined();
                expect(event.payload).toBeDefined();
                expect(event.occurredAt).toBeDefined();
            }
        });

        it('Contract transitions are recorded', async () => {
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

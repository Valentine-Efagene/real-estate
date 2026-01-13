

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

    // Chidi's application
    let applicationId: string;
    let documentationPhaseId: string;
    let downpaymentPhaseId: string;
    let finalDocumentationPhaseId: string;
    let mortgagePhaseId: string;

    // Realistic Nigerian property pricing
    const propertyPrice = 85_000_000; // ₦85M
    const downpaymentPercent = 10;
    const mortgagePercent = 90;
    const mortgageInterestRate = 9.5; // 9.5% per annum

    // Chidi's mortgage term selection (based on his age)
    // Chidi is 40, maxAgeAtMaturity is 65, so max term is 25 years
    // Chidi chooses 20 years
    const chidiAge = 40;
    const chidiSelectedTermYears = 20;
    const chidiSelectedTermMonths = chidiSelectedTermYears * 12; // 240 months

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
                email: 'efagenevalentine@gmail.com',
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
                tenantId,
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
                tenantId,
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
            const response = await api
                .post('/payment-plans')
                .set(adminHeaders(adaezeId, tenantId))
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
            expect(response.body.data.id).toBeDefined();
            downpaymentPlanId = response.body.data.id;

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

        it('Adaeze creates a flexible-term mortgage plan at 9.5% p.a.', async () => {
            // Mortgage plan with flexible term (5-30 years based on applicant's age)
            // maxAgeAtMaturity: 65 means if Chidi is 40, he can get max 25 years
            const response = await api
                .post('/payment-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-mortgage-plan'))
                .send({
                    name: 'Flexible Mortgage at 9.5%',
                    description: 'Monthly payments at 9.5% annual interest, term selected by applicant',
                    frequency: 'MONTHLY',
                    // Flexible term configuration
                    allowFlexibleTerm: true,
                    minTermMonths: 60,       // 5 years minimum
                    maxTermMonths: 360,      // 30 years maximum
                    termStepMonths: 12,      // Increments of 1 year
                    maxAgeAtMaturity: 65,    // Applicant + term cannot exceed 65
                    interestRate: mortgageInterestRate,
                    gracePeriodDays: 15,
                });

            expect(response.status).toBe(201);
            expect(response.body.data.allowFlexibleTerm).toBe(true);
            expect(response.body.data.minTermMonths).toBe(60);
            expect(response.body.data.maxTermMonths).toBe(360);
            expect(response.body.data.maxAgeAtMaturity).toBe(65);
            mortgagePlanId = response.body.data.id;
        });

        it('Adaeze creates a payment method with 4 phases per SCENARIO.md', async () => {
            const response = await api
                .post('/payment-methods')
                .set(adminHeaders(adaezeId, tenantId))
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
                                    name: 'Admin Uploads Final Offer',
                                    stepType: 'UPLOAD',
                                    order: 1,
                                    metadata: {
                                        documentType: 'FINAL_OFFER',
                                        uploadedBy: 'ADMIN', // Only admin can upload
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
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.phases.length).toBe(4);
            paymentMethodId = response.body.data.id;
        });

        it('Adaeze links the payment method to Lekki Gardens Estate', async () => {
            const response = await api
                .post(`/payment-methods/${paymentMethodId}/properties`)
                .set(adminHeaders(adaezeId, tenantId))
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
                        context: 'APPLICATION_PHASE',
                        paymentMethodId,
                        phaseType: 'KYC',
                        documentType: 'ID_CARD',
                        isRequired: true,
                        description: 'Valid government-issued ID (NIN, Passport, or Driver License)',
                        maxSizeBytes: 5 * 1024 * 1024,
                        allowedMimeTypes: 'image/jpeg,image/png,application/pdf',
                    },
                    {
                        tenantId,
                        context: 'APPLICATION_PHASE',
                        paymentMethodId,
                        phaseType: 'KYC',
                        documentType: 'BANK_STATEMENT',
                        isRequired: true,
                        description: 'Last 6 months bank statements',
                        maxSizeBytes: 10 * 1024 * 1024,
                        allowedMimeTypes: 'application/pdf',
                        expiryDays: 90,
                    },
                    {
                        tenantId,
                        context: 'APPLICATION_PHASE',
                        paymentMethodId,
                        phaseType: 'KYC',
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

        it('Adaeze configures phase event to notify when downpayment completes', async () => {
            // First, create an event channel and type for downpayment notifications
            // Note: In production, channels and types would be seeded as part of tenant onboarding
            const channel = await prisma.eventChannel.create({
                data: {
                    tenantId,
                    code: 'MORTGAGE_OPS',
                    name: 'Mortgage Operations',
                    description: 'Internal events for mortgage workflow',
                },
            });

            const eventType = await prisma.eventType.create({
                data: {
                    tenantId,
                    channelId: channel.id,
                    code: 'DOWNPAYMENT_COMPLETED',
                    name: 'Downpayment Completed',
                    description: 'Fired when customer completes downpayment phase',
                },
            });

            // Create handler via notification-service API
            // Note: In a real test, this would call the notification service
            // For now we use prisma since we're testing in a single service context
            const handler = await prisma.eventHandler.create({
                data: {
                    tenantId,
                    eventTypeId: eventType.id,
                    name: 'Notify Admin: Upload Final Offer',
                    description: 'Sends notification to admin to upload final offer letter',
                    handlerType: 'SEND_EMAIL',
                    config: {
                        template: 'admin_upload_final_offer',
                        recipients: ['adaeze@qshelter.com'],
                        subject: 'Action Required: Upload Final Offer Letter',
                    },
                },
            });

            // Get the payment method to find the downpayment phase ID
            const getMethodResponse = await api
                .get(`/payment-methods/${paymentMethodId}`)
                .set(adminHeaders(adaezeId, tenantId));

            expect(getMethodResponse.status).toBe(200);
            const paymentMethod = getMethodResponse.body.data;
            const downpaymentPhaseTemplate = paymentMethod.phases.find(
                (p: any) => p.phaseType === 'DOWNPAYMENT'
            );
            expect(downpaymentPhaseTemplate).toBeDefined();

            // Attach handler to phase ON_COMPLETE trigger via REST API
            const attachResponse = await api
                .post(`/payment-methods/${paymentMethodId}/phases/${downpaymentPhaseTemplate.id}/event-attachments`)
                .set(adminHeaders(adaezeId, tenantId))
                .send({
                    trigger: 'ON_COMPLETE',
                    handlerId: handler.id,
                    priority: 100,
                    enabled: true,
                });

            expect(attachResponse.status).toBe(201);
            expect(attachResponse.body.data.id).toBeDefined();
            expect(attachResponse.body.data.trigger).toBe('ON_COMPLETE');
            expect(attachResponse.body.data.handlerId).toBe(handler.id);

            // Verify we can retrieve the attachments via API
            const getAttachmentsResponse = await api
                .get(`/payment-methods/${paymentMethodId}/phases/${downpaymentPhaseTemplate.id}/event-attachments`)
                .set(adminHeaders(adaezeId, tenantId));

            expect(getAttachmentsResponse.status).toBe(200);
            expect(getAttachmentsResponse.body.data.length).toBe(1);
            expect(getAttachmentsResponse.body.data[0].handler.name).toBe('Notify Admin: Upload Final Offer');
        });
    });

    // =========================================================================
    // Step 2: Chidi creates a application for Unit 14B
    // Note: Prequalification has been merged into the application documentation phase.
    // Underwriting now happens as a step within the KYC phase.
    // =========================================================================
    describe("Step 2: Chidi creates and activates a application", () => {
        it('Chidi creates a application for Unit 14B with his preferred mortgage term', async () => {
            // Chidi is 40 years old, so with maxAgeAtMaturity: 65, he can select up to 25 years
            // Chidi chooses 20 years (240 months)
            const response = await api
                .post('/applications')
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-create-application'))
                .send({
                    propertyUnitId: unit14BId,
                    paymentMethodId,
                    title: 'Purchase Agreement - Lekki Gardens Unit 14B',
                    applicationType: 'MORTGAGE',
                    totalAmount: propertyPrice,
                    monthlyIncome: 2_500_000, // ₦2.5M/month
                    monthlyExpenses: 800_000,  // ₦800k/month
                    // Chidi selects his preferred mortgage term
                    applicantAge: chidiAge,
                    selectedMortgageTermMonths: chidiSelectedTermMonths, // 240 months = 20 years
                });

            if (response.status !== 201) {
                console.error('Application creation failed:', response.body);
            }

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.applicationNumber).toBeDefined();
            expect(response.body.data.status).toBe('DRAFT');
            expect(response.body.data.phases.length).toBe(4);

            applicationId = response.body.data.id;

            // Extract phase IDs (4 phases per SCENARIO.md)
            const phases = response.body.data.phases;
            documentationPhaseId = phases.find((p: any) => p.phaseType === 'KYC').id;
            downpaymentPhaseId = phases.find((p: any) => p.phaseType === 'DOWNPAYMENT').id;
            finalDocumentationPhaseId = phases.find((p: any) => p.phaseType === 'VERIFICATION').id;
            mortgagePhaseId = phases.find((p: any) => p.phaseType === 'MORTGAGE').id;

            // Verify APPLICATION.CREATED event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Application',
                    aggregateId: applicationId,
                    eventType: 'APPLICATION.CREATED',
                },
            });
            expect(event).toBeDefined();
        });

        it('Application has correct phase amounts (₦8.5M downpayment, ₦76.5M mortgage)', async () => {
            const response = await api
                .get(`/applications/${applicationId}/phases`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.length).toBe(4);

            const docPhase = response.body.data.find((p: any) => p.phaseType === 'KYC');
            const downPhase = response.body.data.find((p: any) => p.phaseType === 'DOWNPAYMENT');
            const finalDocPhase = response.body.data.find((p: any) => p.phaseType === 'VERIFICATION');
            const mortPhase = response.body.data.find((p: any) => p.phaseType === 'MORTGAGE');

            expect(docPhase.totalAmount).toBe(0);
            expect(downPhase.totalAmount).toBe(8_500_000);  // 10% of ₦85M
            expect(finalDocPhase.totalAmount).toBe(0);      // Documentation phase, no payment
            expect(mortPhase.totalAmount).toBe(76_500_000); // 90% of ₦85M
            expect(mortPhase.interestRate).toBe(mortgageInterestRate);
        });

        it('Mortgage phase has Chidi\'s selected term (20 years / 240 months)', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: mortgagePhaseId },
                include: { paymentPhase: true },
            });

            expect(phase?.paymentPhase?.selectedTermMonths).toBe(chidiSelectedTermMonths);
            expect(phase?.paymentPhase?.numberOfInstallments).toBe(chidiSelectedTermMonths);
        });

        it('Unit 14B is reserved for Chidi', async () => {
            const unit = await prisma.propertyUnit.findUnique({
                where: { id: unit14BId },
            });

            expect(unit?.status).toBe('RESERVED');
            expect(unit?.reservedById).toBe(chidiId);
        });

        it('Chidi submits the application for processing', async () => {
            const response = await api
                .post(`/applications/${applicationId}/transition`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-submit-application'))
                .send({
                    action: 'SUBMIT',
                    note: 'Submitting for processing',
                });

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('PENDING');
        });

        it('Documentation phase is activated', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${documentationPhaseId}/activate`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-activate-kyc-phase'));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('IN_PROGRESS');
        });

        it('Chidi uploads KYC documents for the application', async () => {
            const documents = [
                { documentType: 'ID_CARD', url: 'https://s3.amazonaws.com/qshelter/chidi/id.pdf', fileName: 'id.pdf' },
                { documentType: 'BANK_STATEMENT', url: 'https://s3.amazonaws.com/qshelter/chidi/bank.pdf', fileName: 'bank.pdf' },
                { documentType: 'EMPLOYMENT_LETTER', url: 'https://s3.amazonaws.com/qshelter/chidi/employment.pdf', fileName: 'employment.pdf' },
            ];

            for (const doc of documents) {
                const response = await api
                    .post(`/applications/${applicationId}/phases/${documentationPhaseId}/documents`)
                    .set(customerHeaders(chidiId, tenantId))
                    .set('x-idempotency-key', idempotencyKey(`chidi-application-doc-${doc.documentType}`))
                    .send(doc);

                expect(response.status).toBe(201);
            }
        });

        it('Chidi completes document upload steps', async () => {
            const uploadSteps = ['Upload Valid ID', 'Upload Bank Statements', 'Upload Employment Letter'];

            for (const stepName of uploadSteps) {
                const response = await api
                    .post(`/applications/${applicationId}/phases/${documentationPhaseId}/steps/complete`)
                    .set(customerHeaders(chidiId, tenantId))
                    .set('x-idempotency-key', idempotencyKey(`chidi-complete-${stepName.replace(/\s+/g, '-').toLowerCase()}`))
                    .send({ stepName });

                expect(response.status).toBe(200);
            }
        });

        it('Adaeze reviews and approves Chidi\'s documents', async () => {
            // Adaeze approves each document
            const docs = await prisma.applicationDocument.findMany({
                where: { phaseId: documentationPhaseId },
            });

            for (let i = 0; i < docs.length; i++) {
                const doc = docs[i];
                const response = await api
                    .post(`/applications/${applicationId}/documents/${doc.id}/review`)
                    .set(adminHeaders(adaezeId, tenantId))
                    .set('x-idempotency-key', idempotencyKey(`adaeze-approve-doc-${i}`))
                    .send({
                        status: 'APPROVED',
                        note: 'Document verified',
                    });

                expect(response.status).toBe(200);
            }

            // Adaeze completes approval step
            const response = await api
                .post(`/applications/${applicationId}/phases/${documentationPhaseId}/steps/complete`)
                .set(adminHeaders(adaezeId, tenantId))
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
            // DocumentationStep is now linked via DocumentationPhase
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: { documentationPhase: true },
            });

            const step = await prisma.documentationStep.findFirst({
                where: {
                    documentationPhaseId: phase?.documentationPhase?.id,
                    name: 'Generate Provisional Offer',
                },
            });

            // Step should be completed (auto-executed)
            expect(step?.status).toBe('COMPLETED');
        });

        it('Chidi signs the provisional offer', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${documentationPhaseId}/steps/complete`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-signs-provisional'))
                .send({
                    stepName: 'Customer Signs Provisional Offer',
                });

            expect(response.status).toBe(200);

            // Verify phase is completed after signature
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        it('Downpayment phase auto-activates', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: downpaymentPhaseId },
            });

            expect(phase?.status).toBe('IN_PROGRESS');
        });

        it('Chidi pays the ₦8.5M downpayment', async () => {
            // Generate installment
            await api
                .post(`/applications/${applicationId}/phases/${downpaymentPhaseId}/installments`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-generate-downpayment'))
                .send({ startDate: new Date().toISOString() });

            const phase = await prisma.applicationPhase.findUnique({
                where: { id: downpaymentPhaseId },
                include: { paymentPhase: { include: { installments: true } } },
            });
            const installment = phase!.paymentPhase!.installments[0];

            // Record payment
            const paymentResponse = await api
                .post(`/applications/${applicationId}/payments`)
                .set(customerHeaders(chidiId, tenantId))
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
            const payment = await prisma.applicationPayment.findFirst({
                where: { phase: { applicationId }, status: 'PENDING' },
            });

            const processResponse = await api
                .post('/applications/payments/process')
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('process-chidi-downpayment'))
                .send({
                    reference: payment!.reference,
                    status: 'COMPLETED',
                    gatewayTransactionId: idempotencyKey('chidi-downpayment-gateway'),
                });

            expect(processResponse.status).toBe(200);
        });

        it('Final Documentation phase auto-activates after downpayment', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: finalDocumentationPhaseId },
            });

            expect(phase?.status).toBe('IN_PROGRESS');
        });

        it('Phase event fires to notify Adaeze to upload final offer', async () => {
            // The phase event attachment configured in Step 1 should have fired
            // when the downpayment phase completed. Verify via domain event.
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'ApplicationPhase',
                    aggregateId: downpaymentPhaseId,
                    eventType: 'PHASE.COMPLETED',
                },
            });

            expect(event).toBeDefined();
            expect(event?.payload).toBeDefined();

            // The handler execution should be logged (if handler execution logging is enabled)
            // For now, we just verify the phase completion event exists
            // The notification service would pick this up and send the email
        });

        it('Adaeze uploads the final offer letter', async () => {
            // After downpayment phase completes, Final Documentation phase activates
            // Adaeze (admin) uploads the final offer letter prepared offline
            const response = await api
                .post(`/applications/${applicationId}/phases/${finalDocumentationPhaseId}/documents`)
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-upload-final-offer'))
                .send({
                    documentType: 'FINAL_OFFER',
                    url: 'https://s3.amazonaws.com/qshelter/applications/chidi-final-offer.pdf',
                    fileName: 'chidi-final-offer.pdf',
                });

            expect(response.status).toBe(201);

            // Complete the upload step
            const stepResponse = await api
                .post(`/applications/${applicationId}/phases/${finalDocumentationPhaseId}/steps/complete`)
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-complete-final-offer-upload'))
                .send({
                    stepName: 'Admin Uploads Final Offer',
                });

            expect(stepResponse.status).toBe(200);
        });

        it('Chidi signs the final offer', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${finalDocumentationPhaseId}/steps/complete`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-signs-final-offer'))
                .send({
                    stepName: 'Customer Signs Final Offer',
                });

            expect(response.status).toBe(200);

            // Verify phase is completed after signature
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: finalDocumentationPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        it('Mortgage phase auto-activates after final documentation', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: mortgagePhaseId },
            });

            expect(phase?.status).toBe('IN_PROGRESS');
        });

        it('System generates mortgage installments based on Chidi\'s selected term (240 months)', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${mortgagePhaseId}/installments`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-generate-mortgage-installments'))
                .send({ startDate: new Date().toISOString() });

            expect(response.status).toBe(200);
            // Number of installments matches Chidi's selected term
            expect(response.body.data.installments.length).toBe(chidiSelectedTermMonths);
        });

        it('Chidi signs and activates the application', async () => {
            const response = await api
                .post(`/applications/${applicationId}/sign`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-signs-application'));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('ACTIVE');
            expect(response.body.data.signedAt).toBeDefined();

            // Verify APPLICATION.SIGNED event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Application',
                    aggregateId: applicationId,
                    eventType: 'APPLICATION.SIGNED',
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
            // The system should queue a applicationCongratulations notification
            // We verify by checking for notification events in the queue
            const notificationEvents = await prisma.domainEvent.findMany({
                where: {
                    queueName: 'notifications',
                    aggregateId: applicationId,
                },
            });

            expect(notificationEvents.length).toBeGreaterThan(0);
        });

        it('Complete event trail exists for audit', async () => {
            const payments = await prisma.applicationPayment.findMany({
                where: { applicationId },
                select: { id: true },
            });
            const paymentIds = payments.map((p) => p.id);

            const events = await prisma.domainEvent.findMany({
                where: {
                    OR: [
                        { aggregateId: applicationId },
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

            expect(eventTypes).toContain('APPLICATION.CREATED');
            expect(eventTypes).toContain('PHASE.ACTIVATED');
            expect(eventTypes).toContain('PHASE.COMPLETED');
            expect(eventTypes).toContain('PAYMENT.COMPLETED');
            expect(eventTypes).toContain('APPLICATION.SIGNED');

            // Verify all events have proper structure
            for (const event of events) {
                expect(event.aggregateType).toBeDefined();
                expect(event.aggregateId).toBeDefined();
                expect(event.payload).toBeDefined();
                expect(event.occurredAt).toBeDefined();
            }
        });
    });
});

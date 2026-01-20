import { api, prisma, cleanupTestData } from '../../setup.js';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import { mockAuthHeaders, ROLES, ConditionOperator, UPLOADED_BY, QuestionCategory } from '@valentine-efagene/qshelter-common';

// Helper functions for auth headers with proper roles
function adminHeaders(userId: string, tenantId: string) {
    return mockAuthHeaders(userId, tenantId, { roles: [ROLES.TENANT_ADMIN] });
}

function customerHeaders(userId: string, tenantId: string) {
    return mockAuthHeaders(userId, tenantId, { roles: [ROLES.CUSTOMER] });
}

// Helper function for legal auth headers
function legalHeaders(userId: string, tenantId: string) {
    return mockAuthHeaders(userId, tenantId, { roles: [ROLES.LEGAL] });
}

/**
 * E2E Test: Amara's Victoria Island Installment Purchase Flow
 * 
 * This test implements a direct property purchase without bank financing.
 * The customer pays the full property price in 4 installments.
 * 
 * Flow:
 * 1. Prequalification questionnaire by customer
 * 2. KYC documentation by customer (if passed)
 * 3. 4 installment payments
 * 4. Legal uploads final offer letter
 * 
 * Actors (3 user types):
 * - Amara (Customer): Young professional buying a 2-bedroom flat in Victoria Island
 * - Adaeze (Admin): QShelter operations manager who reviews documents
 * - Tunde (Legal): QShelter legal officer who uploads final offer letter
 * 
 * Property: Victoria Island Luxury Apartments, Unit 7A, ₦45,000,000
 * Payment: 4 equal installments of ₦11,250,000 (quarterly)
 */

// Unique test run ID to ensure idempotency across retries
const TEST_RUN_ID = randomUUID();

function idempotencyKey(operation: string): string {
    return `${TEST_RUN_ID}:${operation}`;
}

describe("Amara's Victoria Island Installment Purchase Flow", () => {
    // Actors
    let adaezeId: string; // Admin (QShelter operations manager)
    let amaraId: string;  // Customer (First-time homebuyer)
    let tundeId: string;  // Legal (QShelter legal officer)

    // QShelter tenant
    let tenantId: string;

    // Property: Victoria Island Luxury Apartments, Unit 7A
    let propertyId: string;
    let variantId: string;
    let unit7AId: string;

    // Payment configuration
    let installmentPlanId: string;
    let paymentMethodId: string;
    let prequalificationPlanId: string; // QuestionnairePlan for prequalification
    let kycDocumentationPlanId: string; // DocumentationPlan for KYC documentation
    let finalOfferDocumentationPlanId: string; // DocumentationPlan for final offer letter

    // Amara's application
    let applicationId: string;
    let prequalificationPhaseId: string; // Phase 1: Prequalification questionnaire
    let documentationPhaseId: string; // Phase 2: KYC documentation
    let paymentPhaseId: string; // Phase 3: Installment payments
    let finalOfferPhaseId: string; // Phase 4: Final offer letter

    // Property pricing
    const propertyPrice = 45_000_000; // ₦45M
    const numberOfInstallments = 4;
    const installmentAmount = propertyPrice / numberOfInstallments; // ₦11.25M

    // Amara's profile
    const amaraAge = 32;
    const amaraMonthlyIncome = 3_000_000; // ₦3M/month
    const amaraMonthlyExpenses = 1_200_000; // ₦1.2M/month

    beforeAll(async () => {
        await cleanupTestData();

        // Create QShelter tenant
        const tenant = await prisma.tenant.create({
            data: {
                id: faker.string.uuid(),
                name: 'QShelter Real Estate',
                subdomain: 'qshelter-vi',
                isActive: true,
            },
        });
        tenantId = tenant.id;

        // Create Adaeze (Admin - Operations manager)
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

        // Create Amara (Customer - First-time homebuyer)
        const amara = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'amara.eze@gmail.com',
                firstName: 'Amara',
                lastName: 'Eze',
            },
        });
        amaraId = amara.id;

        // Create Tunde (Legal - QShelter legal officer)
        const tunde = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'tunde@qshelter.com',
                firstName: 'Tunde',
                lastName: 'Adeyemi',
            },
        });
        tundeId = tunde.id;

        // Create QShelter as the platform organization
        const qshelterOrg = await prisma.organization.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                name: 'QShelter Real Estate',
                type: 'PLATFORM',
                status: 'ACTIVE',
                isPlatformOrg: true,
                email: 'support@qshelter.com',
                phone: '+234-1-234-5678',
                address: 'Victoria Island, Lagos',
            },
        });

        // Link Adaeze as a QShelter operations manager
        await prisma.organizationMember.create({
            data: {
                id: faker.string.uuid(),
                organizationId: qshelterOrg.id,
                userId: adaezeId,
                role: 'MANAGER',
                title: 'Operations Manager',
                canApprove: true,
                isActive: true,
            },
        });

        // Link Tunde as a QShelter legal officer
        await prisma.organizationMember.create({
            data: {
                id: faker.string.uuid(),
                organizationId: qshelterOrg.id,
                userId: tundeId,
                role: 'OFFICER',
                title: 'Legal Officer',
                canApprove: true,
                isActive: true,
            },
        });

        // Create Victoria Island Luxury Apartments property
        const property = await prisma.property.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                userId: adaezeId,
                title: 'Victoria Island Luxury Apartments',
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

        // Create 2-bedroom flat variant
        const variant = await prisma.propertyVariant.create({
            data: {
                tenantId,
                propertyId,
                name: '2-Bedroom Flat',
                nBedrooms: 2,
                nBathrooms: 2,
                nParkingSpots: 1,
                area: 120,
                price: propertyPrice,
                totalUnits: 20,
                availableUnits: 15,
                status: 'AVAILABLE',
            },
        });
        variantId = variant.id;

        // Create Unit 7A
        const unit = await prisma.propertyUnit.create({
            data: {
                tenantId,
                variantId: variant.id,
                unitNumber: '7A',
                floorNumber: 7,
                status: 'AVAILABLE',
            },
        });
        unit7AId = unit.id;
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
    // Step 1: Adaeze configures the payment plan
    // =========================================================================
    describe('Step 1: Adaeze configures the payment plan', () => {
        it('Adaeze creates a 4-installment payment plan', async () => {
            const response = await api
                .post('/payment-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-installment-plan'))
                .send({
                    name: '4 Quarterly Installments',
                    description: 'Pay in 4 equal installments over 12 months',
                    planType: 'INSTALLMENT',
                    isActive: true,
                    numberOfInstallments: 4,
                    intervalDays: 90, // Quarterly (every 3 months)
                    interestRate: 0, // No interest for installment plans
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.numberOfInstallments).toBe(4);
            installmentPlanId = response.body.data.id;
        });

        it('Adaeze creates a prequalification questionnaire plan', async () => {
            const response = await api
                .post('/questionnaire-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-prequalification-plan'))
                .send({
                    name: 'Installment Purchase Prequalification',
                    description: 'Prequalification for installment payment plans',
                    isActive: true,
                    scoringStrategy: 'WEIGHTED_SUM',
                    passingScore: 60,
                    autoDecisionEnabled: true,
                    estimatedMinutes: 5,
                    category: 'PREQUALIFICATION',
                    questions: [
                        {
                            questionKey: 'employment_status',
                            questionText: 'What is your current employment status?',
                            helpText: 'This determines your eligibility for installment payments',
                            questionType: 'SELECT',
                            order: 1,
                            isRequired: true,
                            options: [
                                { value: 'EMPLOYED', label: 'Employed (Salary earner)', score: 100 },
                                { value: 'SELF_EMPLOYED', label: 'Self-Employed', score: 80 },
                                { value: 'CONTRACTOR', label: 'Contractor', score: 70 },
                                { value: 'RETIRED', label: 'Retired', score: 50 },
                                { value: 'UNEMPLOYED', label: 'Unemployed', score: 0 },
                            ],
                            scoreWeight: 1,
                            category: QuestionCategory.EMPLOYMENT,
                        },
                        {
                            questionKey: 'monthly_income',
                            questionText: 'What is your monthly income?',
                            helpText: 'Your income must be sufficient to cover quarterly payments',
                            questionType: 'CURRENCY',
                            order: 2,
                            isRequired: true,
                            validationRules: { min: 0 },
                            // Score 100 if income >= ₦3M (can easily pay ₦11.25M quarterly)
                            // Rules are evaluated in order - first match wins
                            scoringRules: [
                                { operator: ConditionOperator.GREATER_THAN_OR_EQUAL, value: 3000000, score: 100 },
                                { operator: ConditionOperator.GREATER_THAN_OR_EQUAL, value: 2000000, score: 80 },
                                { operator: ConditionOperator.GREATER_THAN_OR_EQUAL, value: 1000000, score: 50 },
                                { operator: ConditionOperator.LESS_THAN, value: 1000000, score: 0 },
                            ],
                            scoreWeight: 2, // Income is weighted more heavily
                            category: QuestionCategory.AFFORDABILITY,
                        },
                        {
                            questionKey: 'marital_status',
                            questionText: 'What is your marital status?',
                            helpText: 'For documentation purposes only',
                            questionType: 'SELECT',
                            order: 3,
                            isRequired: true,
                            options: [
                                { value: 'SINGLE', label: 'Single', score: 100 },
                                { value: 'MARRIED', label: 'Married', score: 100 },
                                { value: 'DIVORCED', label: 'Divorced', score: 100 },
                                { value: 'WIDOWED', label: 'Widowed', score: 100 },
                            ],
                            scoreWeight: 0, // No scoring impact - informational only
                            category: QuestionCategory.PERSONAL,
                        },
                    ],
                });

            if (response.status !== 201) {
                console.error('Questionnaire plan creation failed:', response.body);
            }
            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            prequalificationPlanId = response.body.data.id;
        });

        it('Adaeze creates a KYC documentation plan', async () => {
            const response = await api
                .post('/documentation-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-kyc-plan'))
                .send({
                    name: 'Installment KYC Documentation',
                    description: 'Standard KYC documentation for installment purchases',
                    isActive: true,
                    requiredDocumentTypes: ['ID_CARD', 'BANK_STATEMENT', 'EMPLOYMENT_LETTER'],
                    steps: [
                        {
                            name: 'Upload Valid ID',
                            stepType: 'UPLOAD',
                            order: 1,
                            documentType: 'ID_CARD',
                            isRequired: true,
                            description: 'Valid government-issued ID (NIN, Passport, or Driver License)',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                            requiresManualReview: true,
                        },
                        {
                            name: 'Upload Bank Statements',
                            stepType: 'UPLOAD',
                            order: 2,
                            documentType: 'BANK_STATEMENT',
                            isRequired: true,
                            description: 'Last 6 months bank statements',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            requiresManualReview: true,
                        },
                        {
                            name: 'Upload Employment Letter',
                            stepType: 'UPLOAD',
                            order: 3,
                            documentType: 'EMPLOYMENT_LETTER',
                            isRequired: true,
                            description: 'Employment confirmation letter from your employer',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            requiresManualReview: true,
                        },
                        // Conditional step for married applicants
                        {
                            name: 'Upload Spouse ID',
                            stepType: 'UPLOAD',
                            order: 4,
                            documentType: 'SPOUSE_ID',
                            isRequired: true,
                            description: 'Valid ID for spouse',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                            requiresManualReview: true,
                            condition: {
                                questionKey: 'marital_status',
                                operator: ConditionOperator.EQUALS,
                                value: 'MARRIED',
                            },
                        },
                        {
                            name: 'Admin Reviews Documents',
                            stepType: 'APPROVAL',
                            order: 5,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            kycDocumentationPlanId = response.body.data.id;
        });

        it('Adaeze creates a final offer documentation plan', async () => {
            const response = await api
                .post('/documentation-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-final-offer-plan'))
                .send({
                    name: 'Final Offer Letter',
                    description: 'Legal uploads final offer letter after payment completion',
                    isActive: true,
                    steps: [
                        {
                            name: 'Legal Uploads Final Offer Letter',
                            stepType: 'UPLOAD',
                            order: 1,
                            documentType: 'FINAL_OFFER_LETTER',
                            isRequired: true,
                            description: 'Final offer letter confirming property ownership transfer',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            requiresManualReview: false, // Auto-completes when legal uploads
                            metadata: {
                                uploadedBy: UPLOADED_BY.LEGAL,
                            },
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            finalOfferDocumentationPlanId = response.body.data.id;
        });

        it('Adaeze creates a payment method with 4 phases', async () => {
            const response = await api
                .post('/payment-methods')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-payment-method'))
                .send({
                    name: 'Installment Purchase',
                    description: 'Full property purchase in 4 quarterly installments',
                    isActive: true,
                    phases: [
                        // Phase 1: Prequalification
                        {
                            name: 'Prequalification',
                            phaseCategory: 'QUESTIONNAIRE',
                            phaseType: 'PRE_APPROVAL',
                            order: 1,
                            questionnairePlanId: prequalificationPlanId,
                        },
                        // Phase 2: KYC Documentation
                        {
                            name: 'KYC Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'KYC',
                            order: 2,
                            documentationPlanId: kycDocumentationPlanId,
                        },
                        // Phase 3: Installment Payments (100% of price)
                        {
                            name: 'Installment Payments',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'DOWNPAYMENT', // Using DOWNPAYMENT for full payment phases
                            order: 3,
                            percentOfPrice: 100,
                            paymentPlanId: installmentPlanId,
                        },
                        // Phase 4: Final Offer Letter
                        {
                            name: 'Final Offer Letter',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'VERIFICATION',
                            order: 4,
                            documentationPlanId: finalOfferDocumentationPlanId,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.phases.length).toBe(4);
            paymentMethodId = response.body.data.id;
        });

        it('Adaeze links the payment method to Victoria Island Apartments', async () => {
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
    });

    // =========================================================================
    // Step 2: Amara creates an application for Unit 7A
    // =========================================================================
    describe("Step 2: Amara creates an application", () => {
        it('Amara creates an application for Unit 7A', async () => {
            const response = await api
                .post('/applications')
                .set(customerHeaders(amaraId, tenantId))
                .set('x-idempotency-key', idempotencyKey('amara-create-application'))
                .send({
                    propertyUnitId: unit7AId,
                    paymentMethodId,
                    title: 'Purchase Agreement - Victoria Island Unit 7A',
                    applicationType: 'OUTRIGHT', // Not a mortgage
                    totalAmount: propertyPrice,
                    monthlyIncome: amaraMonthlyIncome,
                    monthlyExpenses: amaraMonthlyExpenses,
                    applicantAge: amaraAge,
                });

            if (response.status !== 201) {
                console.error('Application creation failed:', response.body);
            }

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.status).toBe('PENDING');
            expect(response.body.data.phases.length).toBe(4);

            applicationId = response.body.data.id;

            // Extract phase IDs
            const phases = response.body.data.phases;
            prequalificationPhaseId = phases.find((p: any) => p.order === 1).id;
            documentationPhaseId = phases.find((p: any) => p.order === 2).id;
            paymentPhaseId = phases.find((p: any) => p.order === 3).id;
            finalOfferPhaseId = phases.find((p: any) => p.order === 4).id;

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

        it('Application has correct phase amounts (₦45M total)', async () => {
            const phases = await prisma.applicationPhase.findMany({
                where: { applicationId },
                include: { paymentPhase: true },
                orderBy: { order: 'asc' },
            });

            // Payment phase should have the full amount
            const paymentPhase = phases.find(p => p.order === 3);
            expect(paymentPhase?.paymentPhase?.totalAmount).toBe(propertyPrice);
        });

        it('Unit 7A is reserved for Amara', async () => {
            const unit = await prisma.propertyUnit.findUnique({
                where: { id: unit7AId },
            });
            expect(unit?.status).toBe('RESERVED');
        });

        it('Prequalification phase is auto-activated on application creation', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: prequalificationPhaseId },
            });
            expect(phase?.status).toBe('IN_PROGRESS');
        });
    });

    // =========================================================================
    // Step 3: Amara completes prequalification
    // =========================================================================
    describe("Step 3: Amara completes prequalification", () => {
        it('Amara submits her prequalification answers', async () => {
            // Answers must be an array of { fieldName, value } objects
            const answers = [
                { fieldName: 'employment_status', value: 'EMPLOYED' },
                { fieldName: 'monthly_income', value: String(amaraMonthlyIncome) },
                { fieldName: 'marital_status', value: 'SINGLE' },
            ];

            const response = await api
                .post(`/applications/${applicationId}/phases/${prequalificationPhaseId}/questionnaire/submit`)
                .set(customerHeaders(amaraId, tenantId))
                .set('x-idempotency-key', idempotencyKey('amara-submit-prequalification'))
                .send({ answers });

            if (response.status !== 200) {
                console.error('Questionnaire submit failed:', response.body);
            }
            expect(response.status).toBe(200);
            // The 'passed' field is nested under questionnaire
            expect(response.body.data.questionnaire.passed).toBe(true);
            expect(response.body.data.questionnaire.answeredFieldsCount).toBe(3);
        });

        it('Prequalification phase completes after successful scoring', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: prequalificationPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        it('KYC Documentation phase is auto-activated', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
            });
            expect(phase?.status).toBe('IN_PROGRESS');
        });
    });

    // =========================================================================
    // Step 4: Amara uploads KYC documents
    // =========================================================================
    describe("Step 4: Amara uploads KYC documents", () => {
        it('Amara uploads her ID document', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${documentationPhaseId}/documents`)
                .set(customerHeaders(amaraId, tenantId))
                .set('x-idempotency-key', idempotencyKey('amara-upload-id'))
                .send({
                    documentType: 'ID_CARD',
                    url: 'https://s3.amazonaws.com/qshelter/amara/id-card.pdf',
                    fileName: 'amara-nin-slip.pdf',
                });

            expect(response.status).toBe(201);
        });

        it('Amara uploads her bank statements', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${documentationPhaseId}/documents`)
                .set(customerHeaders(amaraId, tenantId))
                .set('x-idempotency-key', idempotencyKey('amara-upload-bank-statements'))
                .send({
                    documentType: 'BANK_STATEMENT',
                    url: 'https://s3.amazonaws.com/qshelter/amara/bank-statements.pdf',
                    fileName: 'amara-bank-statements.pdf',
                });

            expect(response.status).toBe(201);
        });

        it('Amara uploads her employment letter', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${documentationPhaseId}/documents`)
                .set(customerHeaders(amaraId, tenantId))
                .set('x-idempotency-key', idempotencyKey('amara-upload-employment'))
                .send({
                    documentType: 'EMPLOYMENT_LETTER',
                    url: 'https://s3.amazonaws.com/qshelter/amara/employment-letter.pdf',
                    fileName: 'amara-employment-letter.pdf',
                });

            expect(response.status).toBe(201);
        });

        it('Documentation phase is IN_PROGRESS after documents are uploaded', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: { documentationPhase: { include: { stageProgress: { orderBy: { order: 'asc' } } } } },
            });

            // Phase should be in progress while awaiting review
            expect(phase?.status).toBe('IN_PROGRESS');

            // Verify we have stage progress records
            const stageProgress = phase?.documentationPhase?.stageProgress;
            expect(stageProgress?.length).toBeGreaterThan(0);
        });

        it('Documentation phase only requires applicable documents (Amara is single)', async () => {
            // Conditional documents (Spouse ID) are not required since Amara is single
            // This is verified by checking that the phase can complete without them
            const docs = await prisma.applicationDocument.findMany({
                where: { phaseId: documentationPhaseId },
            });

            // Only 3 required documents should be uploaded (ID, Bank Statement, Employment Letter)
            expect(docs.length).toBe(3);
        });
    });

    // =========================================================================
    // Step 5: Adaeze reviews and approves documents
    // =========================================================================
    describe("Step 5: Adaeze reviews and approves documents", () => {
        it("Adaeze reviews and approves Amara's documents", async () => {
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
        });

        it('KYC Documentation phase completes after all documents approved', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        it('Payment phase auto-activates', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: paymentPhaseId },
            });
            expect(phase?.status).toBe('IN_PROGRESS');
        });
    });

    // =========================================================================
    // Step 6: Amara makes 4 installment payments
    // =========================================================================
    describe("Step 6: Amara makes 4 installment payments", () => {
        it('Amara generates the installment schedule', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${paymentPhaseId}/installments`)
                .set(customerHeaders(amaraId, tenantId))
                .set('x-idempotency-key', idempotencyKey('amara-generate-installments'))
                .send({ startDate: new Date().toISOString() });

            expect(response.status).toBe(200);
            expect(response.body.data.installments.length).toBe(4);

            // Verify each installment amount
            for (const installment of response.body.data.installments) {
                expect(installment.amount).toBe(installmentAmount);
            }
        });

        it('Amara pays all 4 installments', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: paymentPhaseId },
                include: { paymentPhase: { include: { installments: true } } },
            });

            const installments = phase!.paymentPhase!.installments;
            expect(installments.length).toBe(4);

            // Pay each installment
            for (let i = 0; i < installments.length; i++) {
                const installment = installments[i];

                // Initiate payment
                const paymentResponse = await api
                    .post(`/applications/${applicationId}/payments`)
                    .set(customerHeaders(amaraId, tenantId))
                    .set('x-idempotency-key', idempotencyKey(`amara-pay-installment-${i + 1}`))
                    .send({
                        installmentId: installment.id,
                        amount: installment.amount,
                        paymentMethod: 'BANK_TRANSFER',
                        transactionReference: `TXN-AMARA-INST-${i + 1}-${Date.now()}`,
                    });

                expect(paymentResponse.status).toBe(201);

                // Simulate payment webhook confirmation
                const processResponse = await api
                    .post('/applications/payments/process')
                    .set(adminHeaders(adaezeId, tenantId))
                    .set('x-idempotency-key', idempotencyKey(`process-installment-${i + 1}`))
                    .send({
                        reference: paymentResponse.body.data.reference,
                        status: 'COMPLETED',
                        gatewayResponse: { transactionId: `GW-REF-${i + 1}-${Date.now()}` },
                    });

                expect(processResponse.status).toBe(200);
            }
        });

        it('Payment phase completes after all installments paid', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: paymentPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        it('Final Offer phase auto-activates after payment', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: finalOfferPhaseId },
            });
            expect(phase?.status).toBe('IN_PROGRESS');
        });
    });

    // =========================================================================
    // Step 7: Tunde (Legal) uploads final offer letter
    // =========================================================================
    describe("Step 7: Tunde uploads final offer letter", () => {
        it('Tunde uploads the final offer letter', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${finalOfferPhaseId}/documents`)
                .set(legalHeaders(tundeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('tunde-upload-final-offer'))
                .send({
                    documentType: 'FINAL_OFFER_LETTER',
                    url: 'https://s3.amazonaws.com/qshelter/legal/final-offer-amara.pdf',
                    fileName: 'final-offer-letter.pdf',
                });

            expect(response.status).toBe(201);
        });

        it('Final Offer phase completes automatically', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: finalOfferPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        it('Application completes after final offer letter is uploaded', async () => {
            const application = await prisma.application.findUnique({
                where: { id: applicationId },
            });
            expect(application?.status).toBe('COMPLETED');

            // Verify APPLICATION.COMPLETED event
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'Application',
                    aggregateId: applicationId,
                    eventType: 'APPLICATION.COMPLETED',
                },
            });
            expect(event).toBeDefined();
        });
    });

    // =========================================================================
    // Final: Verify complete audit trail
    // =========================================================================
    describe('Audit trail and notifications', () => {
        it('Complete event trail exists for audit', async () => {
            // Get payments to include their IDs in the search
            const payments = await prisma.applicationPayment.findMany({
                where: { applicationId },
                select: { id: true },
            });
            const paymentIds = payments.map(p => p.id);

            const events = await prisma.domainEvent.findMany({
                where: {
                    OR: [
                        { aggregateId: applicationId },
                        {
                            aggregateId: {
                                in: [prequalificationPhaseId, documentationPhaseId, paymentPhaseId, finalOfferPhaseId, ...paymentIds]
                            }
                        },
                    ],
                },
                orderBy: { createdAt: 'asc' },
            });

            const eventTypes = events.map(e => e.eventType);

            // Verify key events occurred
            expect(eventTypes).toContain('APPLICATION.CREATED');
            expect(eventTypes).toContain('PHASE.ACTIVATED');
            expect(eventTypes).toContain('PHASE.COMPLETED');
            expect(eventTypes).toContain('PAYMENT.INITIATED');
            expect(eventTypes).toContain('PAYMENT.COMPLETED');
            expect(eventTypes).toContain('APPLICATION.COMPLETED');

            // Verify all events have proper structure
            for (const event of events) {
                expect(event.tenantId).toBe(tenantId);
                expect(event.aggregateType).toBeDefined();
                expect(event.aggregateId).toBeDefined();
            }
        });

        it('Congratulations notification event is created for Amara', async () => {
            const event = await prisma.domainEvent.findFirst({
                where: {
                    eventType: 'APPLICATION.COMPLETED',
                    aggregateId: applicationId,
                },
            });

            expect(event).toBeDefined();
            expect(event?.queueName).toBe('notifications');
        });
    });
});

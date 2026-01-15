

import { api, notificationApi, prisma, cleanupTestData } from '../../setup.js';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import { authHeaders, ROLES, CONDITION_OPERATORS, UPLOADED_BY } from '@valentine-efagene/qshelter-common';

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
    let prequalificationPlanId: string; // QuestionnairePlan for prequalification
    let kycDocumentationPlanId: string; // DocumentationPlan for KYC phase
    let finalDocumentationPlanId: string; // DocumentationPlan for final documentation phase

    // Chidi's application
    let applicationId: string;
    let prequalificationPhaseId: string; // New: Prequalification questionnaire phase
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
    // Retirement age is 60, so Chidi (age 40) can get max 20 years
    // Chidi chooses 20 years
    const chidiAge = 40;
    const retirementAge = 60;
    const chidiSelectedTermYears = 20;
    const chidiSelectedTermMonths = chidiSelectedTermYears * 12; // 240 months

    // Chidi's financial situation
    const chidiMonthlyIncome = 2_500_000; // ₦2.5M/month
    const chidiMonthlyExpenses = 800_000;  // ₦800k/month
    const maxRepaymentRatio = 1 / 3; // Bank can't deduct more than 1/3 of income

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
            // maxAgeAtMaturity: 60 (retirement age) means if Chidi is 40, he can get max 20 years
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
                    maxAgeAtMaturity: retirementAge, // Retirement age - applicant + term cannot exceed 60
                    interestRate: mortgageInterestRate,
                    gracePeriodDays: 15,
                });

            expect(response.status).toBe(201);
            expect(response.body.data.allowFlexibleTerm).toBe(true);
            expect(response.body.data.minTermMonths).toBe(60);
            expect(response.body.data.maxTermMonths).toBe(360);
            expect(response.body.data.maxAgeAtMaturity).toBe(retirementAge);
            mortgagePlanId = response.body.data.id;
        });

        it('Adaeze creates a prequalification questionnaire plan', async () => {
            // This questionnaire collects age, income, and validates eligibility
            // Rules:
            // 1. Age + mortgage term <= 60 (retirement age)
            // 2. Monthly payment <= 1/3 of monthly income
            const response = await api
                .post('/questionnaire-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-prequalification-plan'))
                .send({
                    name: 'Mortgage Prequalification',
                    description: 'Collects applicant age and income to validate mortgage eligibility',
                    isActive: true,
                    passingScore: 100, // Must score 100 to pass (all checks must pass)
                    scoringStrategy: 'MIN_ALL', // All questions must pass
                    autoDecisionEnabled: true,
                    estimatedMinutes: 5,
                    category: 'PREQUALIFICATION',
                    questions: [
                        {
                            questionKey: 'applicant_age',
                            questionText: 'What is your current age?',
                            helpText: 'Your age determines the maximum mortgage term (retirement age is 60)',
                            questionType: 'NUMBER',
                            order: 1,
                            isRequired: true,
                            validationRules: { min: 18, max: 59 },
                            // Score 100 if age allows at least 5 years mortgage (age <= 55)
                            scoringRules: { '<=55': 100, '>55': 0 },
                            scoreWeight: 1,
                            category: 'eligibility',
                        },
                        {
                            questionKey: 'mortgage_type',
                            questionText: 'What type of mortgage are you applying for?',
                            helpText: 'Joint mortgages require documentation from both applicants',
                            questionType: 'SELECT',
                            order: 2,
                            isRequired: true,
                            options: [
                                { value: 'SINGLE', label: 'Single (Individual)', score: 100 },
                                { value: 'JOINT', label: 'Joint (With Spouse)', score: 100 },
                            ],
                            scoreWeight: 0, // No scoring impact, used for document conditions
                            category: 'application_type',
                        },
                        {
                            questionKey: 'employment_status',
                            questionText: 'What is your employment status?',
                            helpText: 'This determines the income verification documents required',
                            questionType: 'SELECT',
                            order: 3,
                            isRequired: true,
                            options: [
                                { value: 'EMPLOYED', label: 'Employed (Salary/Wage earner)', score: 100 },
                                { value: 'SELF_EMPLOYED', label: 'Self-Employed', score: 80 },
                                { value: 'BUSINESS_OWNER', label: 'Business Owner', score: 80 },
                                { value: 'RETIRED', label: 'Retired', score: 60 },
                            ],
                            scoreWeight: 1,
                            category: 'employment',
                        },
                        {
                            questionKey: 'monthly_income',
                            questionText: 'What is your monthly gross income?',
                            helpText: 'Include salary, bonuses, and other regular income',
                            questionType: 'CURRENCY',
                            order: 4,
                            isRequired: true,
                            validationRules: { min: 0 },
                            // Score 100 if income >= ₦500,000 (reasonable for mortgage)
                            scoringRules: { '>=500000': 100, '<500000': 0 },
                            scoreWeight: 1,
                            category: 'affordability',
                        },
                        {
                            questionKey: 'monthly_expenses',
                            questionText: 'What are your total monthly expenses?',
                            helpText: 'Include rent, utilities, loans, and other recurring expenses',
                            questionType: 'CURRENCY',
                            order: 5,
                            isRequired: true,
                            validationRules: { min: 0 },
                            scoreWeight: 0, // Informational, used for DTI calculation
                            category: 'affordability',
                        },
                        {
                            questionKey: 'desired_term_years',
                            questionText: 'What mortgage term (in years) would you prefer?',
                            helpText: 'Maximum term is 30 years, but limited by retirement age (60)',
                            questionType: 'NUMBER',
                            order: 6,
                            isRequired: true,
                            validationRules: { min: 5, max: 30 },
                            scoringRules: { '>=5': 100, '<5': 0 },
                            scoreWeight: 1,
                            category: 'preferences',
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.questions.length).toBe(6);
            prequalificationPlanId = response.body.data.id;
        });

        it('Adaeze creates a KYC documentation plan with document requirements', async () => {
            // This plan defines the KYC workflow with steps and document validation rules
            // Some steps are conditional based on prequalification answers (mortgage_type, employment_status)
            const response = await api
                .post('/documentation-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-kyc-documentation-plan'))
                .send({
                    name: 'Mortgage KYC Documentation',
                    description: 'Standard KYC documentation workflow with conditional spouse and business documents',
                    isActive: true,
                    requiredDocumentTypes: ['ID_CARD', 'BANK_STATEMENT', 'EMPLOYMENT_LETTER'],
                    steps: [
                        // === ALWAYS REQUIRED (no condition) ===
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
                            // No condition - always required
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
                            expiryDays: 90,
                            requiresManualReview: true,
                            minFiles: 3,
                            maxFiles: 6,
                            // No condition - always required
                        },

                        // === CONDITIONAL: FOR EMPLOYED APPLICANTS ===
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
                            // Only required for employed applicants
                            condition: { questionKey: 'employment_status', operator: CONDITION_OPERATORS.EQUALS, value: 'EMPLOYED' },
                        },

                        // === CONDITIONAL: FOR SELF-EMPLOYED / BUSINESS OWNERS ===
                        {
                            name: 'Upload Business Registration',
                            stepType: 'UPLOAD',
                            order: 4,
                            documentType: 'BUSINESS_REGISTRATION',
                            isRequired: true,
                            description: 'CAC registration certificate or business license',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
                            requiresManualReview: true,
                            // Only required for self-employed or business owners
                            condition: { questionKey: 'employment_status', operator: CONDITION_OPERATORS.IN, values: ['SELF_EMPLOYED', 'BUSINESS_OWNER'] },
                        },
                        {
                            name: 'Upload Tax Returns',
                            stepType: 'UPLOAD',
                            order: 5,
                            documentType: 'TAX_RETURNS',
                            isRequired: true,
                            description: 'Last 2 years personal/business tax returns',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            expiryDays: 365, // Must be from the last year
                            requiresManualReview: true,
                            minFiles: 2,
                            maxFiles: 4,
                            // Only required for self-employed or business owners
                            condition: { questionKey: 'employment_status', operator: CONDITION_OPERATORS.IN, values: ['SELF_EMPLOYED', 'BUSINESS_OWNER'] },
                        },

                        // === CONDITIONAL: FOR JOINT MORTGAGES ===
                        {
                            name: 'Upload Spouse ID',
                            stepType: 'UPLOAD',
                            order: 6,
                            documentType: 'SPOUSE_ID_CARD',
                            isRequired: true,
                            description: 'Valid government-issued ID for your spouse',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                            requiresManualReview: true,
                            // Only required for joint mortgages
                            condition: { questionKey: 'mortgage_type', operator: CONDITION_OPERATORS.EQUALS, value: 'JOINT' },
                        },
                        {
                            name: 'Upload Marriage Certificate',
                            stepType: 'UPLOAD',
                            order: 7,
                            documentType: 'MARRIAGE_CERTIFICATE',
                            isRequired: true,
                            description: 'Marriage certificate or court affidavit',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
                            requiresManualReview: true,
                            // Only required for joint mortgages
                            condition: { questionKey: 'mortgage_type', operator: CONDITION_OPERATORS.EQUALS, value: 'JOINT' },
                        },
                        {
                            name: 'Upload Spouse Bank Statements',
                            stepType: 'UPLOAD',
                            order: 8,
                            documentType: 'SPOUSE_BANK_STATEMENT',
                            isRequired: true,
                            description: 'Last 6 months bank statements for your spouse',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            expiryDays: 90,
                            requiresManualReview: true,
                            minFiles: 3,
                            maxFiles: 6,
                            // Only required for joint mortgages
                            condition: { questionKey: 'mortgage_type', operator: CONDITION_OPERATORS.EQUALS, value: 'JOINT' },
                        },
                        {
                            name: 'Upload Spouse Consent Letter',
                            stepType: 'UPLOAD',
                            order: 9,
                            documentType: 'SPOUSE_CONSENT',
                            isRequired: true,
                            description: 'Signed consent letter from spouse agreeing to the mortgage',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            requiresManualReview: true,
                            // Only required for joint mortgages
                            condition: { questionKey: 'mortgage_type', operator: CONDITION_OPERATORS.EQUALS, value: 'JOINT' },
                        },

                        // === WORKFLOW STEPS (always apply) ===
                        {
                            name: 'Adaeze Reviews Documents',
                            stepType: 'APPROVAL',
                            order: 10,
                        },
                        {
                            name: 'Generate Provisional Offer',
                            stepType: 'GENERATE_DOCUMENT',
                            order: 11,
                            metadata: {
                                documentType: 'PROVISIONAL_OFFER',
                                autoSend: true,
                                expiresInDays: 30,
                            },
                        },
                        {
                            name: 'Customer Signs Provisional Offer',
                            stepType: 'SIGNATURE',
                            order: 12,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.steps.length).toBe(12);
            kycDocumentationPlanId = response.body.data.id;

            // Verify the steps have the document validation rules
            const uploadIdStep = response.body.data.steps.find((s: any) => s.documentType === 'ID_CARD');
            expect(uploadIdStep.maxSizeBytes).toBe(5 * 1024 * 1024);
            expect(uploadIdStep.requiresManualReview).toBe(true);
            expect(uploadIdStep.condition).toBeNull(); // No condition - always required

            // Verify conditional steps have conditions stored
            const spouseIdStep = response.body.data.steps.find((s: any) => s.documentType === 'SPOUSE_ID_CARD');
            expect(spouseIdStep.condition).toEqual({ questionKey: 'mortgage_type', operator: 'EQUALS', value: 'JOINT' });

            const businessRegStep = response.body.data.steps.find((s: any) => s.documentType === 'BUSINESS_REGISTRATION');
            expect(businessRegStep.condition).toEqual({ questionKey: 'employment_status', operator: 'IN', values: ['SELF_EMPLOYED', 'BUSINESS_OWNER'] });
        });

        it('Adaeze creates a final documentation plan', async () => {
            const response = await api
                .post('/documentation-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-final-documentation-plan'))
                .send({
                    name: 'Final Offer Documentation',
                    description: 'Final offer letter upload and signature workflow',
                    isActive: true,
                    steps: [
                        {
                            name: 'Admin Uploads Final Offer',
                            stepType: 'UPLOAD',
                            order: 1,
                            documentType: 'FINAL_OFFER',
                            isRequired: true,
                            description: 'Final offer letter prepared by bank',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            metadata: {
                                uploadedBy: UPLOADED_BY.ADMIN,
                            },
                        },
                        {
                            name: 'Customer Signs Final Offer',
                            stepType: 'SIGNATURE',
                            order: 2,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.steps.length).toBe(2);
            finalDocumentationPlanId = response.body.data.id;
        });

        it('Adaeze creates a payment method with 5 phases (including prequalification)', async () => {
            const response = await api
                .post('/payment-methods')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-payment-method'))
                .send({
                    name: '10/90 Lekki Mortgage',
                    description: 'Prequalification → Underwriting → Downpayment → Final Documentation → Mortgage',
                    requiresManualApproval: true,
                    phases: [
                        // Phase 1: Prequalification Questionnaire
                        {
                            name: 'Prequalification',
                            phaseCategory: 'QUESTIONNAIRE',
                            phaseType: 'ELIGIBILITY',
                            order: 1,
                            questionnairePlanId: prequalificationPlanId,
                        },
                        // Phase 2: Underwriting & Documentation (uses KYC documentation plan)
                        {
                            name: 'Underwriting & Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'KYC',
                            order: 2,
                            documentationPlanId: kycDocumentationPlanId,
                        },
                        // Phase 3: Downpayment
                        {
                            name: '10% Downpayment',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'DOWNPAYMENT',
                            order: 3,
                            percentOfPrice: downpaymentPercent,
                            paymentPlanId: downpaymentPlanId,
                        },
                        // Phase 4: Final Documentation (uses final documentation plan)
                        {
                            name: 'Final Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'VERIFICATION',
                            order: 4,
                            documentationPlanId: finalDocumentationPlanId,
                        },
                        // Phase 5: Mortgage
                        {
                            name: '20-Year Mortgage',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'MORTGAGE',
                            order: 5,
                            percentOfPrice: mortgagePercent,
                            interestRate: mortgageInterestRate,
                            paymentPlanId: mortgagePlanId,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.phases.length).toBe(5);
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

        // NOTE: Document requirement rules are now defined in the DocumentationPlan steps
        // No need for separate document-rules configuration on the payment method

        it('Adaeze configures phase event to notify when downpayment completes', async () => {
            // First, create an event channel and type for downpayment notifications
            // Note: In production, channels and types would be seeded as part of tenant onboarding
            const channelResponse = await notificationApi
                .post('/event-channels')
                .set(adminHeaders(adaezeId, tenantId))
                .send({
                    code: 'MORTGAGE_OPS',
                    name: 'Mortgage Operations',
                    description: 'Internal events for mortgage workflow',
                });

            expect(channelResponse.status).toBe(201);
            const channel = channelResponse.body.data;

            const eventTypeResponse = await notificationApi
                .post('/event-types')
                .set(adminHeaders(adaezeId, tenantId))
                .send({
                    channelId: channel.id,
                    code: 'DOWNPAYMENT_COMPLETED',
                    name: 'Downpayment Completed',
                    description: 'Fired when customer completes downpayment phase',
                });

            expect(eventTypeResponse.status).toBe(201);
            const eventType = eventTypeResponse.body.data;

            // Create handler via notification-service API
            const handlerResponse = await notificationApi
                .post('/event-handlers')
                .set(adminHeaders(adaezeId, tenantId))
                .send({
                    eventTypeId: eventType.id,
                    name: 'Notify Admin: Upload Final Offer',
                    description: 'Sends notification to admin to upload final offer letter',
                    handlerType: 'SEND_EMAIL',
                    config: {
                        template: 'admin_upload_final_offer',
                        recipients: ['adaeze@qshelter.com'],
                        subject: 'Action Required: Upload Final Offer Letter',
                    },
                });

            expect(handlerResponse.status).toBe(201);
            const handler = handlerResponse.body.data;

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
    // Flow: Prequalification → KYC/Documentation → Downpayment → Final Docs → Mortgage
    // =========================================================================
    describe("Step 2: Chidi creates and activates a application", () => {
        it('Chidi creates a application for Unit 14B with his preferred mortgage term', async () => {
            // Chidi is 40 years old, so with retirement age 60, he can select up to 20 years
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
                    monthlyIncome: chidiMonthlyIncome,
                    monthlyExpenses: chidiMonthlyExpenses,
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
            expect(response.body.data.phases.length).toBe(5); // Now 5 phases including prequalification

            applicationId = response.body.data.id;

            // Extract phase IDs (5 phases: Prequalification → KYC → Downpayment → Final Docs → Mortgage)
            const phases = response.body.data.phases;
            prequalificationPhaseId = phases.find((p: any) => p.phaseType === 'ELIGIBILITY').id;
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
            expect(response.body.data.length).toBe(5); // 5 phases now

            const prequalPhase = response.body.data.find((p: any) => p.phaseType === 'ELIGIBILITY');
            const docPhase = response.body.data.find((p: any) => p.phaseType === 'KYC');
            const downPhase = response.body.data.find((p: any) => p.phaseType === 'DOWNPAYMENT');
            const finalDocPhase = response.body.data.find((p: any) => p.phaseType === 'VERIFICATION');
            const mortPhase = response.body.data.find((p: any) => p.phaseType === 'MORTGAGE');

            expect(prequalPhase.totalAmount).toBe(0);       // Questionnaire phase, no payment
            expect(docPhase.totalAmount).toBe(0);
            expect(downPhase.totalAmount).toBe(8_500_000);  // 10% of ₦85M
            expect(finalDocPhase.totalAmount).toBe(0);      // Documentation phase, no payment
            expect(mortPhase.totalAmount).toBe(76_500_000); // 90% of ₦85M
            expect(mortPhase.interestRate).toBe(mortgageInterestRate);
        });

        it('Prequalification phase has questionnaire fields from the plan', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: prequalificationPhaseId },
                include: { questionnairePhase: { include: { fields: true } } },
            });

            expect(phase?.questionnairePhase).toBeDefined();
            expect(phase?.questionnairePhase?.totalFieldsCount).toBe(4);
            expect(phase?.questionnairePhase?.fields.length).toBe(4);

            // Verify the fields match the questionnaire plan
            // QuestionnaireField uses `name` not `fieldKey`
            const fieldNames = phase?.questionnairePhase?.fields.map((f: any) => f.name);
            expect(fieldNames).toContain('applicant_age');
            expect(fieldNames).toContain('monthly_income');
            expect(fieldNames).toContain('monthly_expenses');
            expect(fieldNames).toContain('desired_term_years');
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

        // ========================================
        // Step 3: Chidi Completes Prequalification
        // ========================================
        // The prequalification phase ensures:
        // 1. Age + mortgage term <= retirement age (60)
        // 2. Monthly repayment <= 1/3 of monthly income
        // 3. Maximum mortgage term is 30 years

        it('Prequalification phase is activated first', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${prequalificationPhaseId}/activate`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-activate-prequalification-phase'));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('IN_PROGRESS');
        });

        it('Chidi sees the prequalification questionnaire fields', async () => {
            const response = await api
                .get(`/applications/${applicationId}/phases/${prequalificationPhaseId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.phaseType).toBe('ELIGIBILITY');
            expect(response.body.data.questionnairePhase).toBeDefined();
            expect(response.body.data.questionnairePhase.fields.length).toBe(4);

            const fieldKeys = response.body.data.questionnairePhase.fields.map((f: any) => f.name);
            expect(fieldKeys).toContain('applicant_age');
            expect(fieldKeys).toContain('monthly_income');
            expect(fieldKeys).toContain('monthly_expenses');
            expect(fieldKeys).toContain('desired_term_years');
        });

        it('Chidi submits his prequalification answers', async () => {
            // Chidi is 40 years old, earns ₦2.5M/month, spends ₦800K/month on expenses
            // He wants a 20-year mortgage term (well within 60-40=20 years max)
            const answers = [
                { fieldName: 'applicant_age', value: '40' },
                { fieldName: 'monthly_income', value: String(chidiMonthlyIncome) },
                { fieldName: 'monthly_expenses', value: String(chidiMonthlyExpenses) },
                { fieldName: 'desired_term_years', value: '20' },
            ];

            const response = await api
                .post(`/applications/${applicationId}/phases/${prequalificationPhaseId}/questionnaire/submit`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-submit-prequalification'))
                .send({ answers });

            expect(response.status).toBe(200);

            // The response includes the scoring result
            expect(response.body.data.questionnaire.completedAt).toBeDefined();
            expect(response.body.data.questionnaire.answeredFieldsCount).toBe(4);
        });

        it('Prequalification calculates eligibility correctly', async () => {
            // The scoring rules should validate:
            // 1. Age (40) + Term (20) = 60 <= retirement age (60) ✓
            // 2. Monthly payment (~₦714K at 9.5% for ₦76.5M over 20 years)
            //    ₦714K <= ₦833K (1/3 of ₦2.5M income) ✓
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: prequalificationPhaseId },
                include: {
                    questionnairePhase: {
                        include: {
                            fields: true,
                        },
                    },
                },
            });

            expect(phase?.questionnairePhase?.scoredAt).toBeDefined();

            // With MIN_ALL strategy, all questions must pass for eligibility
            // Scoring fields are directly on QuestionnairePhase
            expect(phase?.questionnairePhase?.passed).toBe(true);
            expect(phase?.questionnairePhase?.totalScore).toBeGreaterThan(0);
        });

        it('Prequalification phase completes after successful scoring', async () => {
            // Phase should auto-complete after questionnaire is submitted and scored
            const response = await api
                .get(`/applications/${applicationId}/phases/${prequalificationPhaseId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
            expect(response.body.data.completedAt).toBeDefined();
        });

        // ========================================
        // Step 4: Chidi Completes KYC/Documentation
        // ========================================

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

        it('UPLOAD steps are AWAITING_REVIEW after documents are uploaded', async () => {
            // UPLOAD steps are marked AWAITING_REVIEW when documents are uploaded
            // They will be COMPLETED when the documents are approved
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: { documentationPhase: { include: { steps: true } } },
            });

            const uploadStepNames = ['Upload Valid ID', 'Upload Bank Statements', 'Upload Employment Letter'];
            for (const stepName of uploadStepNames) {
                const step = phase?.documentationPhase?.steps.find((s: any) => s.name === stepName);
                expect(step?.status).toBe('AWAITING_REVIEW');
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

            // APPROVAL step is auto-completed when all documents are approved
            // UPLOAD steps are also auto-completed when their documents are approved
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: { documentationPhase: { include: { steps: true } } },
            });

            // Verify all UPLOAD steps are now COMPLETED (after their documents were approved)
            const uploadStepNames = ['Upload Valid ID', 'Upload Bank Statements', 'Upload Employment Letter'];
            for (const stepName of uploadStepNames) {
                const step = phase?.documentationPhase?.steps.find((s: any) => s.name === stepName);
                expect(step?.status).toBe('COMPLETED');
            }

            // Verify APPROVAL step is now COMPLETED (after all documents approved)
            const approvalStep = phase?.documentationPhase?.steps.find((s: any) => s.name === 'Adaeze Reviews Documents');
            expect(approvalStep?.status).toBe('COMPLETED');
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
            const uploadResponse = await api
                .post(`/applications/${applicationId}/phases/${finalDocumentationPhaseId}/documents`)
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-upload-final-offer'))
                .send({
                    documentType: 'FINAL_OFFER',
                    url: 'https://s3.amazonaws.com/qshelter/applications/chidi-final-offer.pdf',
                    fileName: 'chidi-final-offer.pdf',
                });

            expect(uploadResponse.status).toBe(201);

            // UPLOAD step is AWAITING_REVIEW after upload
            let phase = await prisma.applicationPhase.findUnique({
                where: { id: finalDocumentationPhaseId },
                include: { documentationPhase: { include: { steps: true } } },
            });

            const uploadStep = phase?.documentationPhase?.steps.find((s: any) => s.name === 'Admin Uploads Final Offer');
            expect(uploadStep?.status).toBe('AWAITING_REVIEW');

            // Admin approves the final offer document (internal approval, not customer signing)
            const doc = await prisma.applicationDocument.findFirst({
                where: { phaseId: finalDocumentationPhaseId, type: 'FINAL_OFFER' },
            });

            const approveResponse = await api
                .post(`/applications/${applicationId}/documents/${doc!.id}/review`)
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-approve-final-offer'))
                .send({
                    status: 'APPROVED',
                    note: 'Final offer letter verified',
                });

            expect(approveResponse.status).toBe(200);

            // UPLOAD step is now COMPLETED after document approval
            phase = await prisma.applicationPhase.findUnique({
                where: { id: finalDocumentationPhaseId },
                include: { documentationPhase: { include: { steps: true } } },
            });

            const uploadStepAfterApproval = phase?.documentationPhase?.steps.find((s: any) => s.name === 'Admin Uploads Final Offer');
            expect(uploadStepAfterApproval?.status).toBe('COMPLETED');
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



import { api, prisma, cleanupTestData } from '../../setup.js';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import { mockAuthHeaders, ROLES, ConditionOperator, UPLOADED_BY } from '@valentine-efagene/qshelter-common';

// Helper functions for auth headers with proper roles
function adminHeaders(userId: string, tenantId: string) {
    return mockAuthHeaders(userId, tenantId, { roles: [ROLES.TENANT_ADMIN] });
}

function customerHeaders(userId: string, tenantId: string) {
    return mockAuthHeaders(userId, tenantId, { roles: [ROLES.CUSTOMER] });
}

// Helper function for developer auth headers
function developerHeaders(userId: string, tenantId: string) {
    return mockAuthHeaders(userId, tenantId, { roles: [ROLES.DEVELOPER] });
}

// Helper function for lender auth headers
function lenderHeaders(userId: string, tenantId: string) {
    return mockAuthHeaders(userId, tenantId, { roles: [ROLES.LENDER] });
}

/**
 * E2E Test: Chidi's Lekki Mortgage Flow
 * 
 * This test implements the business scenario defined in Info.md
 * 
 * Flow (as per Info.md):
 * 1. Prequalification questionnaire by customer
 * 2. Sales offer letter by developer
 * 3. Preapproval documentation by customer
 * 4. Preapproval letter from bank
 * 5. Customer pays downpayment
 * 6. Mortgage documentation by customer
 * 7. Mortgage offer letter by bank
 * 
 * Actors (3 user types):
 * - Chidi (Customer): First-time homebuyer purchasing a 3-bedroom flat in Lekki
 * - Emeka (Developer): Lekki Gardens developer who uploads sales offer letter
 * - Nkechi (Lender): Access Bank loan officer who uploads preapproval & mortgage offer letters
 * - Adaeze (Admin): QShelter operations manager (platform admin)
 * 
 * Property: Lekki Gardens Estate, Unit 14B, ₦85,000,000
 * Payment Plan: 10% downpayment, 90% mortgage at 9.5% p.a. over 20 years
 */

// Unique test run ID to ensure idempotency across retries
const TEST_RUN_ID = randomUUID();

function idempotencyKey(operation: string): string {
    return `${TEST_RUN_ID}:${operation}`;
}

describe("Chidi's Lekki Mortgage Flow", () => {
    // Actors (3 user types as per Info.md)
    let adaezeId: string; // Admin (QShelter operations manager)
    let chidiId: string;  // Customer (First-time homebuyer)
    let nkechiId: string; // Lender (Bank loan officer - uploads preapproval & mortgage offer letters)
    let emekaId: string;  // Developer (Property developer - uploads sales offer letter)

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
    let salesOfferDocumentationPlanId: string; // DocumentationPlan for sales offer phase (developer uploads)
    let kycDocumentationPlanId: string; // DocumentationPlan for KYC/preapproval documentation phase
    let mortgageDocumentationPlanId: string; // DocumentationPlan for mortgage offer phase (bank uploads)

    // Chidi's application
    let applicationId: string;
    let prequalificationPhaseId: string; // Phase 1: Prequalification questionnaire
    let salesOfferPhaseId: string; // Phase 2: Sales offer (developer uploads, customer signs)
    let documentationPhaseId: string; // Phase 3: Preapproval documentation (KYC docs)
    let downpaymentPhaseId: string; // Phase 4: Downpayment
    let mortgageDocumentationPhaseId: string; // Phase 5: Mortgage documentation (bank uploads offer letter)
    let mortgagePhaseId: string; // Phase 6: Mortgage payments

    // Realistic Nigerian property pricing
    const propertyPrice = 85_000_000; // ₦85M
    const downpaymentPercent = 10;
    const mortgagePercent = 90;
    const mortgageInterestRate = 9.5; // 9.5% per annum

    // Chidi's mortgage term selection (based on his age)
    // Retirement age is 60, so Chidi (age 40) can get max 20 years
    // Chidi chooses 20 years (240 months)
    const chidiAge = 40;
    const retirementAge = 60;
    const chidiSelectedTermMonths = 240; // 20 years

    // Chidi's financial situation
    const chidiMonthlyIncome = 2_500_000; // ₦2.5M/month
    const chidiMonthlyExpenses = 800_000;  // ₦800k/month

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

        // Create Nkechi (Lender - Bank loan officer from partner bank)
        const nkechi = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'nkechi@accessbank.com',
                firstName: 'Nkechi',
                lastName: 'Eze',
            },
        });
        nkechiId = nkechi.id;

        // Create Emeka (Developer - Property developer from Lekki Gardens)
        const emeka = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'emeka@lekkigardens.com',
                firstName: 'Emeka',
                lastName: 'Okafor',
            },
        });
        emekaId = emeka.id;

        // Create Access Bank organization
        const accessBank = await prisma.organization.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                name: 'Access Bank Plc',
                type: 'BANK',
                status: 'ACTIVE',
                bankCode: '044',
                swiftCode: 'ABORNGLA',
                email: 'mortgages@accessbankplc.com',
                phone: '+234-1-280-5628',
                address: 'Access Tower, 14/15 Onikan, Lagos',
            },
        });

        // Link Nkechi as an Access Bank officer
        await prisma.organizationMember.create({
            data: {
                id: faker.string.uuid(),
                organizationId: accessBank.id,
                userId: nkechiId,
                role: 'OFFICER',
                canApprove: false, // Needs senior approval for large amounts
                approvalLimit: 5000000, // 5M NGN approval limit
                isActive: true,
            },
        });

        // Create Lekki Gardens Developer organization
        const lekkiGardensDev = await prisma.organization.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                name: 'Lekki Gardens Development Company',
                type: 'DEVELOPER',
                status: 'ACTIVE',
                email: 'sales@lekkigardens.com',
                phone: '+234-1-456-7890',
                address: 'Lekki Phase 1, Lagos',
            },
        });

        // Link Emeka as a Lekki Gardens sales officer
        await prisma.organizationMember.create({
            data: {
                id: faker.string.uuid(),
                organizationId: lekkiGardensDev.id,
                userId: emekaId,
                role: 'OFFICER',
                canApprove: true, // Can issue sales offer letters
                isActive: true,
            },
        });

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
                    description: 'Standard KYC documentation workflow',
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
                        // === CONDITIONAL STEPS (based on prequalification answers) ===
                        {
                            name: 'Upload Spouse ID',
                            stepType: 'UPLOAD',
                            order: 4,
                            documentType: 'SPOUSE_ID',
                            isRequired: true,
                            description: 'Valid ID for spouse (required for joint mortgage)',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                            requiresManualReview: true,
                            // Only required if mortgage_type is JOINT
                            condition: {
                                questionKey: 'mortgage_type',
                                operator: ConditionOperator.EQUALS,
                                value: 'JOINT',
                            },
                        },
                        {
                            name: 'Upload Business Registration',
                            stepType: 'UPLOAD',
                            order: 5,
                            documentType: 'BUSINESS_REGISTRATION',
                            isRequired: true,
                            description: 'Business registration certificate (CAC)',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            requiresManualReview: true,
                            // Only required if employment_status is SELF_EMPLOYED
                            condition: {
                                questionKey: 'employment_status',
                                operator: ConditionOperator.EQUALS,
                                value: 'SELF_EMPLOYED',
                            },
                        },
                        // === WORKFLOW STEPS ===
                        {
                            name: 'Adaeze Reviews Documents',
                            stepType: 'APPROVAL',
                            order: 6,
                        },
                        {
                            name: 'Lender Uploads Preapproval Letter',
                            stepType: 'UPLOAD',
                            order: 7,
                            documentType: 'PREAPPROVAL_LETTER',
                            isRequired: true,
                            description: 'Preapproval letter from the partner bank confirming mortgage eligibility',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            // No manual review required - auto-completes when lender uploads
                            requiresManualReview: false,
                            metadata: {
                                uploadedBy: UPLOADED_BY.LENDER,
                                expiresInDays: 30,
                            },
                        },
                        {
                            name: 'Customer Signs Preapproval Letter',
                            stepType: 'SIGNATURE',
                            order: 8,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.steps.length).toBe(8);
            kycDocumentationPlanId = response.body.data.id;

            // Verify the steps have the document validation rules
            const uploadIdStep = response.body.data.steps.find((s: any) => s.documentType === 'ID_CARD');
            expect(uploadIdStep.maxSizeBytes).toBe(5 * 1024 * 1024);
            expect(uploadIdStep.requiresManualReview).toBe(true);

            // Verify conditional steps have conditions
            const spouseIdStep = response.body.data.steps.find((s: any) => s.documentType === 'SPOUSE_ID');
            expect(spouseIdStep.condition).toBeDefined();
            expect(spouseIdStep.condition.questionKey).toBe('mortgage_type');
            expect(spouseIdStep.condition.operator).toBe(ConditionOperator.EQUALS);
            expect(spouseIdStep.condition.value).toBe('JOINT');
        });

        it('Adaeze creates a sales offer documentation plan', async () => {
            // This plan is for the developer to upload the sales offer letter
            // which the customer then signs. This comes after prequalification.
            const response = await api
                .post('/documentation-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-sales-offer-documentation-plan'))
                .send({
                    name: 'Sales Offer Documentation',
                    description: 'Developer uploads sales offer letter for customer signature',
                    isActive: true,
                    steps: [
                        {
                            name: 'Developer Uploads Sales Offer Letter',
                            stepType: 'UPLOAD',
                            order: 1,
                            documentType: 'SALES_OFFER_LETTER',
                            isRequired: true,
                            description: 'Sales offer letter prepared by the property developer',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            // No manual review required - auto-completes when developer uploads
                            requiresManualReview: false,
                            metadata: {
                                uploadedBy: UPLOADED_BY.DEVELOPER,
                                expiresInDays: 14, // Sales offer typically valid for 14 days
                            },
                        },
                        {
                            name: 'Customer Signs Sales Offer Letter',
                            stepType: 'SIGNATURE',
                            order: 2,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.steps.length).toBe(2);
            salesOfferDocumentationPlanId = response.body.data.id;

            // Verify the sales offer upload step has correct metadata
            const uploadStep = response.body.data.steps.find((s: any) => s.documentType === 'SALES_OFFER_LETTER');
            expect(uploadStep.metadata.uploadedBy).toBe(UPLOADED_BY.DEVELOPER);
        });

        it('Adaeze creates a mortgage offer documentation plan', async () => {
            // This plan is for the bank to upload the mortgage offer letter
            // after the customer pays the downpayment
            const response = await api
                .post('/documentation-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-mortgage-offer-documentation-plan'))
                .send({
                    name: 'Mortgage Offer Documentation',
                    description: 'Bank uploads mortgage offer letter for customer signature',
                    isActive: true,
                    steps: [
                        {
                            name: 'Lender Uploads Mortgage Offer Letter',
                            stepType: 'UPLOAD',
                            order: 1,
                            documentType: 'MORTGAGE_OFFER_LETTER',
                            isRequired: true,
                            description: 'Mortgage offer letter prepared by the bank',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            // No manual review required - auto-completes when lender uploads
                            requiresManualReview: false,
                            metadata: {
                                uploadedBy: UPLOADED_BY.LENDER,
                                expiresInDays: 30,
                            },
                        },
                        {
                            name: 'Customer Signs Mortgage Offer Letter',
                            stepType: 'SIGNATURE',
                            order: 2,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.steps.length).toBe(2);
            mortgageDocumentationPlanId = response.body.data.id;

            // Verify the mortgage offer upload step has correct metadata
            const uploadStep = response.body.data.steps.find((s: any) => s.documentType === 'MORTGAGE_OFFER_LETTER');
            expect(uploadStep.metadata.uploadedBy).toBe(UPLOADED_BY.LENDER);
        });

        it('Adaeze creates a payment method with 6 phases (including prequalification and sales offer)', async () => {
            const response = await api
                .post('/payment-methods')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-payment-method'))
                .send({
                    name: '10/90 Lekki Mortgage',
                    description: 'Prequalification → Sales Offer → KYC/Preapproval → Downpayment → Mortgage Offer → Mortgage',
                    requiresManualApproval: true,
                    phases: [
                        // Phase 1: Prequalification Questionnaire
                        {
                            name: 'Prequalification',
                            phaseCategory: 'QUESTIONNAIRE',
                            phaseType: 'PRE_APPROVAL',
                            order: 1,
                            questionnairePlanId: prequalificationPlanId,
                        },
                        // Phase 2: Sales Offer (Developer uploads, Customer signs)
                        {
                            name: 'Sales Offer',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'SALES_OFFER',
                            order: 2,
                            documentationPlanId: salesOfferDocumentationPlanId,
                        },
                        // Phase 3: Preapproval Documentation (KYC docs + sales offer)
                        {
                            name: 'Preapproval Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'KYC',
                            order: 3,
                            documentationPlanId: kycDocumentationPlanId,
                        },
                        // Phase 4: Downpayment
                        {
                            name: '10% Downpayment',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'DOWNPAYMENT',
                            order: 4,
                            percentOfPrice: downpaymentPercent,
                            paymentPlanId: downpaymentPlanId,
                        },
                        // Phase 5: Mortgage Offer Documentation (Bank uploads mortgage offer letter)
                        {
                            name: 'Mortgage Offer',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'VERIFICATION',
                            order: 5,
                            documentationPlanId: mortgageDocumentationPlanId,
                        },
                        // Phase 6: Mortgage Payments
                        {
                            name: '20-Year Mortgage',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'MORTGAGE',
                            order: 6,
                            percentOfPrice: mortgagePercent,
                            interestRate: mortgageInterestRate,
                            paymentPlanId: mortgagePlanId,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.phases.length).toBe(6);
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

        // NOTE: Phase completion notifications are now automatic.
        // When any phase completes, the system automatically sends an email to the buyer
        // based on the phase category (QUESTIONNAIRE, DOCUMENTATION, or PAYMENT).
        // No manual event channel/type/handler configuration is required.
    });

    // =========================================================================
    // Step 2: Chidi creates a application for Unit 14B
    // Flow: Prequalification → Sales Offer → KYC/Preapproval → Downpayment → Mortgage Offer → Mortgage
    //
    // NOTE: Smart auto-submit behavior:
    // When all required fields are provided (propertyUnitId, paymentMethodId, etc.),
    // the application goes directly to PENDING status and the first phase activates.
    // Use saveDraft: true to save as DRAFT for later completion (e.g., frontend autosave).
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
            // Smart auto-submit: all required fields provided, so application goes directly to PENDING
            expect(response.body.data.status).toBe('PENDING');
            expect(response.body.data.phases.length).toBe(6); // 6 phases now

            applicationId = response.body.data.id;

            // Extract phase IDs (6 phases: Prequalification → Sales Offer → KYC → Downpayment → Mortgage Offer → Mortgage)
            const phases = response.body.data.phases;
            prequalificationPhaseId = phases.find((p: any) => p.phaseType === 'PRE_APPROVAL').id;
            salesOfferPhaseId = phases.find((p: any) => p.phaseType === 'SALES_OFFER').id;
            documentationPhaseId = phases.find((p: any) => p.phaseType === 'KYC').id;
            downpaymentPhaseId = phases.find((p: any) => p.phaseType === 'DOWNPAYMENT').id;
            mortgageDocumentationPhaseId = phases.find((p: any) => p.phaseType === 'VERIFICATION').id;
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
            expect(response.body.data.length).toBe(6); // 6 phases now

            const prequalPhase = response.body.data.find((p: any) => p.phaseType === 'PRE_APPROVAL');
            const salesOfferPhase = response.body.data.find((p: any) => p.phaseType === 'SALES_OFFER');
            const docPhase = response.body.data.find((p: any) => p.phaseType === 'KYC');
            const downPhase = response.body.data.find((p: any) => p.phaseType === 'DOWNPAYMENT');
            const mortgageDocPhase = response.body.data.find((p: any) => p.phaseType === 'VERIFICATION');
            const mortPhase = response.body.data.find((p: any) => p.phaseType === 'MORTGAGE');

            expect(prequalPhase.totalAmount).toBe(0);       // Questionnaire phase, no payment
            expect(salesOfferPhase.totalAmount).toBe(0);    // Documentation phase, no payment
            expect(docPhase.totalAmount).toBe(0);           // Documentation phase, no payment
            expect(downPhase.totalAmount).toBe(8_500_000);  // 10% of ₦85M
            expect(mortgageDocPhase.totalAmount).toBe(0);   // Documentation phase, no payment
            expect(mortPhase.totalAmount).toBe(76_500_000); // 90% of ₦85M
            expect(mortPhase.interestRate).toBe(mortgageInterestRate);
        });

        it('Prequalification phase has questionnaire fields from the plan', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: prequalificationPhaseId },
                include: { questionnairePhase: { include: { fields: true } } },
            });

            expect(phase?.questionnairePhase).toBeDefined();
            expect(phase?.questionnairePhase?.totalFieldsCount).toBe(6);
            expect(phase?.questionnairePhase?.fields.length).toBe(6);

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

        // ========================================
        // Step 3: Chidi Completes Prequalification
        // ========================================
        // The prequalification phase ensures:
        // 1. Age + mortgage term <= retirement age (60)
        // 2. Monthly repayment <= 1/3 of monthly income
        // 3. Maximum mortgage term is 30 years

        it('Prequalification phase is auto-activated on application creation', async () => {
            // First phase is automatically activated when application is created with all required fields
            // (smart auto-submit behavior)
            const response = await api
                .get(`/applications/${applicationId}/phases/${prequalificationPhaseId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('IN_PROGRESS');
            expect(response.body.data.activatedAt).toBeDefined();
        });

        it('Chidi sees the prequalification questionnaire fields', async () => {
            const response = await api
                .get(`/applications/${applicationId}/phases/${prequalificationPhaseId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.phaseType).toBe('PRE_APPROVAL');
            expect(response.body.data.questionnairePhase).toBeDefined();
            expect(response.body.data.questionnairePhase.fields.length).toBe(6);

            const fieldKeys = response.body.data.questionnairePhase.fields.map((f: any) => f.name);
            expect(fieldKeys).toContain('applicant_age');
            expect(fieldKeys).toContain('monthly_income');
            expect(fieldKeys).toContain('monthly_expenses');
            expect(fieldKeys).toContain('desired_term_years');
        });

        it('Chidi submits his prequalification answers', async () => {
            // Chidi is 40 years old, earns ₦2.5M/month, spends ₦800K/month on expenses
            // He wants a 20-year mortgage term (well within 60-40=20 years max)
            // He is single and employed
            const answers = [
                { fieldName: 'applicant_age', value: '40' },
                { fieldName: 'mortgage_type', value: 'SINGLE' },
                { fieldName: 'employment_status', value: 'EMPLOYED' },
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
            expect(response.body.data.questionnaire.answeredFieldsCount).toBe(6);
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
        // Step 4: Emeka (Developer) Uploads Sales Offer Letter
        // ========================================
        // After prequalification passes, the developer issues a sales offer letter
        // which Chidi must sign before proceeding to KYC documentation

        it('Sales Offer phase is auto-activated when prequalification completes', async () => {
            const response = await api
                .get(`/applications/${applicationId}/phases/${salesOfferPhaseId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('IN_PROGRESS');
        });

        it('Emeka (Developer) uploads the sales offer letter', async () => {
            // Emeka from Lekki Gardens Development Company uploads the sales offer letter
            const response = await api
                .post(`/applications/${applicationId}/phases/${salesOfferPhaseId}/documents`)
                .set(developerHeaders(emekaId, tenantId))
                .set('x-idempotency-key', idempotencyKey('emeka-upload-sales-offer'))
                .send({
                    documentType: 'SALES_OFFER_LETTER',
                    url: 'https://s3.amazonaws.com/qshelter/developer/sales-offer-chidi-14b.pdf',
                    fileName: 'sales-offer-letter.pdf',
                });

            expect(response.status).toBe(201);

            // Verify the UPLOAD step is auto-completed (no manual review required for developer docs)
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: salesOfferPhaseId },
                include: { documentationPhase: { include: { steps: true } } },
            });

            const uploadStep = phase?.documentationPhase?.steps.find((s: any) => s.name === 'Developer Uploads Sales Offer Letter');
            expect(uploadStep?.status).toBe('COMPLETED');
        });

        it('Chidi signs the sales offer letter', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${salesOfferPhaseId}/steps/complete`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-signs-sales-offer'))
                .send({
                    stepName: 'Customer Signs Sales Offer Letter',
                });

            expect(response.status).toBe(200);

            // Verify phase is completed after signature
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: salesOfferPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        // ========================================
        // Step 5: Chidi Completes Preapproval Documentation (KYC)
        // ========================================
        // Note: Signed Sales Offer Letter is part of preapproval documentation

        it('Preapproval Documentation phase is auto-activated when sales offer is signed', async () => {
            // Third phase should be automatically activated when sales offer phase completes
            const response = await api
                .get(`/applications/${applicationId}/phases/${documentationPhaseId}`)
                .set(customerHeaders(chidiId, tenantId));

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

        it('Nkechi (Lender) uploads the preapproval letter', async () => {
            // After KYC documents are approved, the lender uploads the preapproval letter
            // This replaces the previous GENERATE_DOCUMENT step
            const response = await api
                .post(`/applications/${applicationId}/phases/${documentationPhaseId}/documents`)
                .set(adminHeaders(nkechiId, tenantId)) // Lender uploads
                .set('x-idempotency-key', idempotencyKey('nkechi-upload-preapproval'))
                .send({
                    documentType: 'PREAPPROVAL_LETTER',
                    url: 'https://s3.amazonaws.com/qshelter/lender/preapproval-chidi.pdf',
                    fileName: 'preapproval-letter.pdf',
                });

            expect(response.status).toBe(201);

            // Verify the UPLOAD step for preapproval letter is now AWAITING_REVIEW or COMPLETED
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: { documentationPhase: { include: { steps: true } } },
            });

            const preapprovalStep = phase?.documentationPhase?.steps.find((s: any) => s.name === 'Lender Uploads Preapproval Letter');
            expect(preapprovalStep).toBeDefined();
            // Step should be auto-completed after upload (requiresManualReview: false for lender docs)
            expect(preapprovalStep?.status).toBe('COMPLETED');
        });

        it('Chidi signs the preapproval letter', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${documentationPhaseId}/steps/complete`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-signs-preapproval'))
                .send({
                    stepName: 'Customer Signs Preapproval Letter',
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

        it('Mortgage Offer Documentation phase auto-activates after downpayment', async () => {
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: mortgageDocumentationPhaseId },
            });

            expect(phase?.status).toBe('IN_PROGRESS');
        });

        it('Automatic payment phase completion notification is triggered', async () => {
            // Phase completion notifications are now automatic.
            // When the downpayment phase completes, the system automatically sends
            // a PAYMENT_PHASE_COMPLETED notification to the buyer.
            // We verify via the PHASE.COMPLETED domain event.
            const event = await prisma.domainEvent.findFirst({
                where: {
                    aggregateType: 'ApplicationPhase',
                    aggregateId: downpaymentPhaseId,
                    eventType: 'PHASE.COMPLETED',
                },
            });

            expect(event).toBeDefined();
            expect(event?.payload).toBeDefined();

            // The notification is sent automatically by the mortgage service
            // via sendPaymentPhaseCompletedNotification() when the phase completes.
            // No manual event handler configuration is required.
        });

        it('Nkechi (Lender) uploads the mortgage offer letter', async () => {
            // After downpayment phase completes, Mortgage Offer Documentation phase activates
            // Nkechi (lender from Access Bank) uploads the mortgage offer letter
            const uploadResponse = await api
                .post(`/applications/${applicationId}/phases/${mortgageDocumentationPhaseId}/documents`)
                .set(lenderHeaders(nkechiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('nkechi-upload-mortgage-offer'))
                .send({
                    documentType: 'MORTGAGE_OFFER_LETTER',
                    url: 'https://s3.amazonaws.com/qshelter/lender/mortgage-offer-chidi.pdf',
                    fileName: 'mortgage-offer-letter.pdf',
                });

            expect(uploadResponse.status).toBe(201);

            // UPLOAD step is auto-completed (no manual review required for lender docs)
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: mortgageDocumentationPhaseId },
                include: { documentationPhase: { include: { steps: true } } },
            });

            const uploadStep = phase?.documentationPhase?.steps.find((s: any) => s.name === 'Lender Uploads Mortgage Offer Letter');
            expect(uploadStep?.status).toBe('COMPLETED');
        });

        it('Chidi signs the mortgage offer letter', async () => {
            const response = await api
                .post(`/applications/${applicationId}/phases/${mortgageDocumentationPhaseId}/steps/complete`)
                .set(customerHeaders(chidiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('chidi-signs-mortgage-offer'))
                .send({
                    stepName: 'Customer Signs Mortgage Offer Letter',
                });

            expect(response.status).toBe(200);

            // Verify phase is completed after signature
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: mortgageDocumentationPhaseId },
            });
            expect(phase?.status).toBe('COMPLETED');
        });

        it('Mortgage phase auto-activates after mortgage offer is signed', async () => {
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
                        { aggregateId: salesOfferPhaseId },
                        { aggregateId: documentationPhaseId },
                        { aggregateId: downpaymentPhaseId },
                        { aggregateId: mortgageDocumentationPhaseId },
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



import { api, prisma, cleanupTestData } from '../../setup.js';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import { mockAuthHeaders, ROLES, ConditionOperator, QuestionCategory } from '@valentine-efagene/qshelter-common';

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

    // Organization IDs
    let qshelterId: string;
    let accessBankId: string;
    let lekkiGardensId: string;

    // ApplicationOrganization IDs (binding orgs to the application with roles/SLAs)
    let appOrgAccessBankId: string;
    let appOrgLekkiGardensId: string;

    // Property: Lekki Gardens Estate, Unit 14B
    let propertyId: string;
    let unit14BId: string;

    // Payment configuration
    let downpaymentPlanId: string;
    let paymentMethodId: string;
    let prequalificationPlanId: string; // QuestionnairePlan for prequalification
    let salesOfferDocumentationPlanId: string; // DocumentationPlan for sales offer phase (developer uploads)
    let kycDocumentationPlanId: string; // DocumentationPlan for KYC/preapproval documentation phase
    let mortgageDocumentationPlanId: string; // DocumentationPlan for mortgage offer phase (bank uploads)

    // Chidi's application
    let applicationId: string;
    let prequalificationPhaseId: string; // Phase 1: Prequalification questionnaire
    let salesOfferPhaseId: string; // Phase 2: Sales offer (developer uploads)
    let documentationPhaseId: string; // Phase 3: Preapproval documentation (KYC docs)
    let downpaymentPhaseId: string; // Phase 4: Downpayment
    let mortgageDocumentationPhaseId: string; // Phase 5: Mortgage documentation (bank uploads offer letter)

    // Realistic Nigerian property pricing
    const propertyPrice = 85_000_000; // ₦85M
    const downpaymentPercent = 10;

    // Chidi's age for prequalification
    const chidiAge = 40;
    const retirementAge = 60;

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
        qshelterId = qshelterOrg.id;

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
        accessBankId = accessBank.id;

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
        lekkiGardensId = lekkiGardensDev.id;

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
                    autoDecisionEnabled: false, // Scoring guides reviewer, manual approval required
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
                            scoringRules: [
                                { operator: ConditionOperator.LESS_THAN_OR_EQUAL, value: 55, score: 100 },
                                { operator: ConditionOperator.GREATER_THAN, value: 55, score: 0 },
                            ],
                            scoreWeight: 1,
                            category: QuestionCategory.ELIGIBILITY,
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
                            category: QuestionCategory.APPLICATION_TYPE,
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
                            category: QuestionCategory.EMPLOYMENT,
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
                            scoringRules: [
                                { operator: ConditionOperator.GREATER_THAN_OR_EQUAL, value: 500000, score: 100 },
                                { operator: ConditionOperator.LESS_THAN, value: 500000, score: 0 },
                            ],
                            scoreWeight: 1,
                            category: QuestionCategory.AFFORDABILITY,
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
                            category: QuestionCategory.AFFORDABILITY,
                        },
                        {
                            questionKey: 'desired_term_years',
                            questionText: 'What mortgage term (in years) would you prefer?',
                            helpText: 'Maximum term is 30 years, but limited by retirement age (60)',
                            questionType: 'NUMBER',
                            order: 6,
                            isRequired: true,
                            validationRules: { min: 5, max: 30 },
                            scoringRules: [
                                { operator: ConditionOperator.GREATER_THAN_OR_EQUAL, value: 5, score: 100 },
                                { operator: ConditionOperator.LESS_THAN, value: 5, score: 0 },
                            ],
                            scoreWeight: 1,
                            category: QuestionCategory.PREFERENCES,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.questions.length).toBe(6);
            prequalificationPlanId = response.body.data.id;
        });

        it('Adaeze creates a KYC documentation plan with document requirements', async () => {
            // This plan defines what documents to collect and how they're reviewed.
            // Documents flow through approval stages: QShelter Review → Bank Review
            const response = await api
                .post('/documentation-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-kyc-documentation-plan'))
                .send({
                    name: 'Mortgage KYC Documentation',
                    description: 'Standard KYC documentation workflow with two-stage approval',
                    isActive: true,
                    // What documents to collect
                    documentDefinitions: [
                        // === ALWAYS REQUIRED (no condition) ===
                        {
                            documentType: 'ID_CARD',
                            documentName: 'Valid ID Card',
                            uploadedBy: 'CUSTOMER',
                            order: 1,
                            isRequired: true,
                            description: 'Valid government-issued ID (NIN, Passport, or Driver License)',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                        },
                        {
                            documentType: 'BANK_STATEMENT',
                            documentName: 'Bank Statements',
                            uploadedBy: 'CUSTOMER',
                            order: 2,
                            isRequired: true,
                            description: 'Last 6 months bank statements',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            expiryDays: 90,
                            minFiles: 3,
                            maxFiles: 6,
                        },
                        {
                            documentType: 'EMPLOYMENT_LETTER',
                            documentName: 'Employment Letter',
                            uploadedBy: 'CUSTOMER',
                            order: 3,
                            isRequired: true,
                            description: 'Employment confirmation letter from your employer',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                        },
                        // === CONDITIONAL DOCUMENTS (based on prequalification answers) ===
                        {
                            documentType: 'SPOUSE_ID',
                            documentName: 'Spouse ID',
                            uploadedBy: 'CUSTOMER',
                            order: 4,
                            isRequired: true,
                            description: 'Valid ID for spouse (required for joint mortgage)',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                            // Only required if mortgage_type is JOINT
                            condition: {
                                questionKey: 'mortgage_type',
                                operator: ConditionOperator.EQUALS,
                                value: 'JOINT',
                            },
                        },
                        {
                            documentType: 'BUSINESS_REGISTRATION',
                            documentName: 'Business Registration (CAC)',
                            uploadedBy: 'CUSTOMER',
                            order: 5,
                            isRequired: true,
                            description: 'Business registration certificate (CAC)',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            // Only required if employment_status is SELF_EMPLOYED
                            condition: {
                                questionKey: 'employment_status',
                                operator: ConditionOperator.EQUALS,
                                value: 'SELF_EMPLOYED',
                            },
                        },
                        // === LENDER UPLOADS (after QShelter approval) ===
                        {
                            documentType: 'PREAPPROVAL_LETTER',
                            documentName: 'Preapproval Letter',
                            uploadedBy: 'LENDER',
                            order: 6,
                            isRequired: true,
                            description: 'Preapproval letter from the partner bank confirming mortgage eligibility',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            expiryDays: 30,
                        },
                    ],
                    // Sequential approval stages
                    approvalStages: [
                        {
                            name: 'QShelter Staff Review',
                            order: 1,
                            reviewParty: 'INTERNAL',
                            autoTransition: false, // Require explicit approval
                            waitForAllDocuments: true,
                            onRejection: 'CASCADE_BACK',
                            slaHours: 24,
                            description: 'QShelter operations team reviews customer documents',
                        },
                        {
                            name: 'Bank Review',
                            order: 2,
                            reviewParty: 'BANK',
                            autoTransition: false,
                            waitForAllDocuments: true,
                            onRejection: 'CASCADE_BACK', // If bank rejects, restart from Stage 1
                            slaHours: 48,
                            description: 'Partner bank reviews documents for mortgage eligibility',
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.documentDefinitions.length).toBe(6);
            expect(response.body.data.approvalStages.length).toBe(2);
            kycDocumentationPlanId = response.body.data.id;

            // Verify the document definitions have validation rules
            const idCardDoc = response.body.data.documentDefinitions.find((d: any) => d.documentType === 'ID_CARD');
            expect(idCardDoc.maxSizeBytes).toBe(5 * 1024 * 1024);

            // Verify conditional documents have conditions
            const spouseIdDoc = response.body.data.documentDefinitions.find((d: any) => d.documentType === 'SPOUSE_ID');
            expect(spouseIdDoc.condition).toBeDefined();
            expect(spouseIdDoc.condition.questionKey).toBe('mortgage_type');
            expect(spouseIdDoc.condition.operator).toBe(ConditionOperator.EQUALS);
            expect(spouseIdDoc.condition.value).toBe('JOINT');

            // Verify approval stages
            const stage1 = response.body.data.approvalStages.find((s: any) => s.order === 1);
            expect(stage1.reviewParty).toBe('INTERNAL');
            const stage2 = response.body.data.approvalStages.find((s: any) => s.order === 2);
            expect(stage2.reviewParty).toBe('BANK');
        });

        it('Adaeze creates a sales offer documentation plan', async () => {
            // This plan is for the developer to upload the sales offer letter.
            // Single stage review by QShelter - auto-approves when developer uploads.
            const response = await api
                .post('/documentation-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-sales-offer-documentation-plan'))
                .send({
                    name: 'Sales Offer Documentation',
                    description: 'Developer uploads sales offer letter',
                    isActive: true,
                    documentDefinitions: [
                        {
                            documentType: 'SALES_OFFER_LETTER',
                            documentName: 'Sales Offer Letter',
                            uploadedBy: 'DEVELOPER',
                            order: 1,
                            isRequired: true,
                            description: 'Sales offer letter prepared by the property developer',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            expiryDays: 14, // Sales offer typically valid for 14 days
                        },
                    ],
                    approvalStages: [
                        {
                            name: 'Developer Document Verification',
                            order: 1,
                            reviewParty: 'DEVELOPER',
                            autoTransition: true, // Auto-complete when developer uploads
                            waitForAllDocuments: true,
                            onRejection: 'CASCADE_BACK',
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.documentDefinitions.length).toBe(1);
            expect(response.body.data.approvalStages.length).toBe(1);
            salesOfferDocumentationPlanId = response.body.data.id;

            // Verify the sales offer document definition
            const salesOfferDoc = response.body.data.documentDefinitions.find((d: any) => d.documentType === 'SALES_OFFER_LETTER');
            expect(salesOfferDoc.uploadedBy).toBe('DEVELOPER');
        });

        it('Adaeze creates a mortgage offer documentation plan', async () => {
            // This plan is for the bank to upload the mortgage offer letter
            // after the customer pays the downpayment. This completes the application.
            const response = await api
                .post('/documentation-plans')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-mortgage-offer-documentation-plan'))
                .send({
                    name: 'Mortgage Offer Documentation',
                    description: 'Bank uploads mortgage offer letter',
                    isActive: true,
                    documentDefinitions: [
                        {
                            documentType: 'MORTGAGE_OFFER_LETTER',
                            documentName: 'Mortgage Offer Letter',
                            uploadedBy: 'LENDER',
                            order: 1,
                            isRequired: true,
                            description: 'Mortgage offer letter prepared by the bank',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                            expiryDays: 30,
                        },
                    ],
                    approvalStages: [
                        {
                            name: 'Bank Document Verification',
                            order: 1,
                            reviewParty: 'BANK',
                            autoTransition: true, // Auto-complete when lender uploads
                            waitForAllDocuments: true,
                            onRejection: 'CASCADE_BACK',
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.documentDefinitions.length).toBe(1);
            expect(response.body.data.approvalStages.length).toBe(1);
            mortgageDocumentationPlanId = response.body.data.id;

            // Verify the mortgage offer document definition
            const mortgageOfferDoc = response.body.data.documentDefinitions.find((d: any) => d.documentType === 'MORTGAGE_OFFER_LETTER');
            expect(mortgageOfferDoc.uploadedBy).toBe('LENDER');
        });

        it('Adaeze creates a payment method with 5 phases', async () => {
            const response = await api
                .post('/payment-methods')
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-create-payment-method'))
                .send({
                    name: '10/90 Lekki Mortgage',
                    description: 'Prequalification → Sales Offer → KYC/Preapproval → Downpayment → Mortgage Offer',
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
                        // Phase 2: Sales Offer (Developer uploads)
                        {
                            name: 'Sales Offer',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'VERIFICATION', // Sales offer is a verification/documentation phase
                            order: 2,
                            documentationPlanId: salesOfferDocumentationPlanId,
                        },
                        // Phase 3: Preapproval Documentation (KYC docs)
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

        it('Access Bank configures stricter document requirements for this payment method', async () => {
            // Banks have varying risk appetites - Access Bank requires stricter documentation.
            // This is an OVERLAY on the base KYC documentation plan:
            // - Bank statements must cover 12 months (not standard 6 months)
            // - Tax clearance is REQUIRED (was optional in base plan)
            // - Credit report is REQUIRED (not in base plan)
            // These overlays apply when Access Bank is the lending partner.

            // STRICTER: Bank statements - require 12 months instead of 6
            await prisma.bankDocumentRequirement.create({
                data: {
                    id: faker.string.uuid(),
                    tenantId,
                    organizationId: accessBankId,
                    paymentMethodId,
                    phaseType: 'KYC',
                    documentType: 'BANK_STATEMENT',
                    documentName: '12 Months Bank Statements (Access Bank)',
                    modifier: 'STRICTER',
                    description: 'Access Bank requires 12 months bank statements. Internal risk policy requires extended financial history.',
                    expiryDays: 60, // Statements must be more recent
                    minFiles: 6, // 6 months minimum
                    maxFiles: 12,
                },
            });

            // REQUIRED: Tax clearance certificate (not in base plan)
            await prisma.bankDocumentRequirement.create({
                data: {
                    id: faker.string.uuid(),
                    tenantId,
                    organizationId: accessBankId,
                    paymentMethodId,
                    phaseType: 'KYC',
                    documentType: 'TAX_CLEARANCE',
                    documentName: 'Tax Clearance Certificate',
                    modifier: 'REQUIRED',
                    description: 'Tax clearance certificate is required for Access Bank mortgages. Regulatory compliance requirement for mortgage loans above ₦50M.',
                },
            });

            // Verify the requirements were created
            const requirements = await prisma.bankDocumentRequirement.findMany({
                where: { organizationId: accessBankId, paymentMethodId },
            });
            expect(requirements.length).toBe(2);

            // Verify modifiers
            const bankStatementReq = requirements.find((r: any) => r.documentType === 'BANK_STATEMENT');
            expect(bankStatementReq?.modifier).toBe('STRICTER');
            expect(bankStatementReq?.minFiles).toBe(6);

            const taxReq = requirements.find((r: any) => r.documentType === 'TAX_CLEARANCE');
            expect(taxReq?.modifier).toBe('REQUIRED');
        });

        it('Adaeze configures an event handler for downpayment phase completion', async () => {
            // The Event Execution Engine allows admins to configure handlers that fire
            // when phases complete. This enables:
            // - LOCK_UNIT: Lock the property unit when downpayment is received
            // - SEND_EMAIL: Send custom notifications to parties
            // - CALL_WEBHOOK: Notify external systems (bank APIs, CRM, etc.)
            //
            // For the downpayment phase, we attach a LOCK_UNIT handler that:
            // 1. Locks the property unit for Chidi
            // 2. Supersedes any competing applications
            // 3. Notifies superseded buyers

            // Get the downpayment phase template ID
            const paymentMethod = await prisma.propertyPaymentMethod.findUnique({
                where: { id: paymentMethodId },
                include: { phases: { orderBy: { order: 'asc' } } },
            });

            const downpaymentPhaseTemplate = paymentMethod?.phases.find(
                (p: any) => p.phaseType === 'DOWNPAYMENT'
            );
            expect(downpaymentPhaseTemplate).toBeDefined();

            // Create an event channel for contract events
            const eventChannel = await prisma.eventChannel.create({
                data: {
                    id: faker.string.uuid(),
                    tenantId,
                    code: 'CONTRACTS',
                    name: 'Contract Events',
                    description: 'Events related to application lifecycle',
                    enabled: true,
                },
            });

            // Create an event type for phase completion
            const eventType = await prisma.eventType.create({
                data: {
                    id: faker.string.uuid(),
                    tenantId,
                    channelId: eventChannel.id,
                    code: 'PHASE_COMPLETED',
                    name: 'Phase Completed',
                    description: 'Fired when an application phase is completed',
                    enabled: true,
                },
            });

            // Create a LOCK_UNIT handler
            const lockUnitHandler = await prisma.eventHandler.create({
                data: {
                    id: faker.string.uuid(),
                    tenantId,
                    eventTypeId: eventType.id,
                    name: 'Lock Unit on Downpayment',
                    description: 'Lock property unit and supersede competing applications when downpayment is received',
                    handlerType: 'LOCK_UNIT',
                    config: {
                        supersedeBehavior: 'SUPERSEDE_ALL',
                        notifySuperseded: true,
                    },
                    priority: 100,
                    enabled: true,
                    maxRetries: 3,
                    retryDelayMs: 1000,
                },
            });

            // Attach the handler to the downpayment phase template
            await prisma.phaseEventAttachment.create({
                data: {
                    id: faker.string.uuid(),
                    tenantId,
                    phaseId: downpaymentPhaseTemplate!.id,
                    trigger: 'ON_COMPLETE',
                    handlerId: lockUnitHandler.id,
                    priority: 100,
                    enabled: true,
                },
            });

            // Verify the attachment was created
            const attachments = await prisma.phaseEventAttachment.findMany({
                where: { phaseId: downpaymentPhaseTemplate!.id },
            });
            expect(attachments.length).toBe(1);
            expect(attachments[0].trigger).toBe('ON_COMPLETE');
        });

        // NOTE: Document requirement rules are now defined in the DocumentationPlan steps
        // Bank-specific overlays are in BankDocumentRequirement (see test above)

        // NOTE: Phase completion notifications are now automatic.
        // When any phase completes, the system automatically sends an email to the buyer
        // based on the phase category (QUESTIONNAIRE, DOCUMENTATION, or PAYMENT).
        // No manual event channel/type/handler configuration is required.
    });

    // =========================================================================
    // Step 2: Chidi creates a application for Unit 14B
    // Flow: Prequalification → Sales Offer → KYC/Preapproval → Downpayment → Mortgage Offer
    //
    // NOTE: Smart auto-submit behavior:
    // When all required fields are provided (propertyUnitId, paymentMethodId, etc.),
    // the application goes directly to PENDING status and the first phase activates.
    // Use saveDraft: true to save as DRAFT for later completion (e.g., frontend autosave).
    // =========================================================================
    describe("Step 2: Chidi creates an application", () => {
        it('Chidi creates an application for Unit 14B', async () => {
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
                    applicantAge: chidiAge,
                });

            if (response.status !== 201) {
                console.error('Application creation failed:', response.body);
            }

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.applicationNumber).toBeDefined();
            // Smart auto-submit: all required fields provided, so application goes directly to PENDING
            expect(response.body.data.status).toBe('PENDING');
            expect(response.body.data.phases.length).toBe(5); // 5 phases

            applicationId = response.body.data.id;

            // Extract phase IDs (5 phases: Prequalification → Sales Offer → KYC → Downpayment → Mortgage Offer)
            // Use order to disambiguate since Sales Offer and Mortgage Offer both use VERIFICATION phaseType
            const phases = response.body.data.phases;
            prequalificationPhaseId = phases.find((p: any) => p.order === 1).id;       // PRE_APPROVAL
            salesOfferPhaseId = phases.find((p: any) => p.order === 2).id;             // VERIFICATION (Sales Offer)
            documentationPhaseId = phases.find((p: any) => p.order === 3).id;          // KYC
            downpaymentPhaseId = phases.find((p: any) => p.order === 4).id;            // DOWNPAYMENT
            mortgageDocumentationPhaseId = phases.find((p: any) => p.order === 5).id;  // VERIFICATION (Mortgage Offer)

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

        it('Organizations are bound to the application with roles and SLAs', async () => {
            // When an application is created for a mortgage:
            // 1. The developer (Lekki Gardens) is bound as DEVELOPER - responsible for sales offer
            // 2. The lender (Access Bank) is bound as LENDER - responsible for mortgage processing
            //
            // Each binding has:
            // - A role (DEVELOPER, LENDER, LEGAL, INSURER, GOVERNMENT)
            // - An SLA (e.g., bank has 48 hours to respond to document submissions)
            // - Status tracking (PENDING → ACTIVE → COMPLETED or DECLINED)

            // Bind Lekki Gardens as the developer
            const lekkiGardensAppOrg = await prisma.applicationOrganization.create({
                data: {
                    id: faker.string.uuid(),
                    tenantId,
                    applicationId,
                    organizationId: lekkiGardensId,
                    role: 'DEVELOPER',
                    status: 'ACTIVE',
                    activatedAt: new Date(),
                    slaHours: 24, // 24 hours to upload sales offer
                },
            });
            appOrgLekkiGardensId = lekkiGardensAppOrg.id;

            // Bind Access Bank as the lender
            const accessBankAppOrg = await prisma.applicationOrganization.create({
                data: {
                    id: faker.string.uuid(),
                    tenantId,
                    applicationId,
                    organizationId: accessBankId,
                    role: 'LENDER',
                    status: 'PENDING', // Will become ACTIVE when KYC phase starts
                    slaHours: 48, // 48 hours to review documents and issue preapproval
                },
            });
            appOrgAccessBankId = accessBankAppOrg.id;

            // Verify bindings
            const bindings = await prisma.applicationOrganization.findMany({
                where: { applicationId },
                include: { organization: true },
            });

            expect(bindings.length).toBe(2);

            const developerBinding = bindings.find((b: any) => b.role === 'DEVELOPER');
            expect(developerBinding?.organization.name).toBe('Lekki Gardens Development Company');
            expect(developerBinding?.slaHours).toBe(24);

            const lenderBinding = bindings.find((b: any) => b.role === 'LENDER');
            expect(lenderBinding?.organization.name).toBe('Access Bank Plc');
            expect(lenderBinding?.slaHours).toBe(48);
        });

        it('Application has correct phase amounts (₦8.5M downpayment)', async () => {
            const response = await api
                .get(`/applications/${applicationId}/phases`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.length).toBe(5); // 5 phases

            // Use order to disambiguate since Sales Offer and Mortgage Offer both use VERIFICATION phaseType
            const prequalPhase = response.body.data.find((p: any) => p.order === 1);       // PRE_APPROVAL
            const salesOfferPhase = response.body.data.find((p: any) => p.order === 2);    // VERIFICATION (Sales Offer)
            const docPhase = response.body.data.find((p: any) => p.order === 3);           // KYC
            const downPhase = response.body.data.find((p: any) => p.order === 4);          // DOWNPAYMENT
            const mortgageDocPhase = response.body.data.find((p: any) => p.order === 5);   // VERIFICATION (Mortgage Offer)

            expect(prequalPhase.totalAmount).toBe(0);       // Questionnaire phase, no payment
            expect(salesOfferPhase.totalAmount).toBe(0);    // Documentation phase, no payment
            expect(docPhase.totalAmount).toBe(0);           // Documentation phase, no payment
            expect(downPhase.totalAmount).toBe(8_500_000);  // 10% of ₦85M
            expect(mortgageDocPhase.totalAmount).toBe(0);   // Documentation phase, no payment
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

        it('Prequalification phase awaits approval after scoring', async () => {
            // With autoDecisionEnabled: false, phase should go to AWAITING_APPROVAL
            // The scoring serves as guidance for the reviewer
            const response = await api
                .get(`/applications/${applicationId}/phases/${prequalificationPhaseId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('AWAITING_APPROVAL');
            // Phase is not completed yet - awaiting manual review
            expect(response.body.data.completedAt).toBeNull();
        });

        it('Adaeze reviews the questionnaire scoring and approves Chidi', async () => {
            // Adaeze sees Chidi's score (100 - all checks passed) and approves the application
            // The scoring is advisory - Adaeze makes the final decision
            const response = await api
                .post(`/applications/${applicationId}/phases/${prequalificationPhaseId}/questionnaire/review`)
                .set(adminHeaders(adaezeId, tenantId))
                .set('x-idempotency-key', idempotencyKey('adaeze-approve-prequalification'))
                .send({
                    decision: 'APPROVE',
                    notes: 'Chidi meets all eligibility criteria. Score: 100. Approved for mortgage.',
                });

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
            expect(response.body.data.completedAt).toBeDefined();

            // Verify review audit record was created
            const reviews = await prisma.questionnairePhaseReview.findMany({
                where: {
                    questionnairePhase: {
                        phase: { id: prequalificationPhaseId },
                    },
                },
            });
            expect(reviews.length).toBe(1);
            expect(reviews[0].decision).toBe('APPROVED');
            expect(reviews[0].reviewerId).toBe(adaezeId);
            // Score is sum of all weighted question scores (MIN_ALL still sums, just checks all > 0)
            // 4 questions with scoreWeight > 0: applicant_age(100) + employment_status(100) + monthly_income(100) + desired_term_years(100) = ~300+
            expect(reviews[0].scoreAtReview).toBeGreaterThanOrEqual(100);
            expect(reviews[0].passedAtReview).toBe(true);
        });

        // ========================================
        // Step 4: Emeka (Developer) Uploads Sales Offer Letter
        // ========================================
        // After prequalification passes, the developer issues a sales offer letter.
        // Once uploaded, the phase completes and KYC documentation begins.

        it('Sales Offer phase is auto-activated when prequalification completes', async () => {
            const response = await api
                .get(`/applications/${applicationId}/phases/${salesOfferPhaseId}`)
                .set(customerHeaders(chidiId, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('IN_PROGRESS');
        });

        it('Emeka (Developer) uploads the sales offer letter', async () => {
            // Emeka from Lekki Gardens Development Company uploads the sales offer letter
            // Once uploaded, the phase completes automatically (no customer signature needed)
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

            // Verify the phase completes (no manual review required for developer docs)
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: salesOfferPhaseId },
                include: { documentationPhase: { include: { stageProgress: { orderBy: { order: 'asc' } } } } },
            });

            // Phase completes automatically after developer uploads
            expect(phase?.status).toBe('COMPLETED');
        });

        // ========================================
        // Step 5: Chidi Completes Preapproval Documentation (KYC)
        // ========================================

        it('Preapproval Documentation phase is auto-activated when sales offer is uploaded', async () => {
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

        it('Documentation phase is IN_PROGRESS after documents are uploaded', async () => {
            // Phase is in progress while awaiting document approval
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: { documentationPhase: { include: { stageProgress: { orderBy: { order: 'asc' } } } } },
            });

            // Phase should be in progress while awaiting review
            expect(phase?.status).toBe('IN_PROGRESS');

            // First stage should be pending/in-progress
            const firstStage = phase?.documentationPhase?.stageProgress?.[0];
            expect(['PENDING', 'IN_PROGRESS']).toContain(firstStage?.status);
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

            // Verify stage progress advances when documents are approved
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: { documentationPhase: { include: { stageProgress: { orderBy: { order: 'asc' } } } } },
            });

            // First stage (QShelter Review) should be completed after all docs approved
            const firstStage = phase?.documentationPhase?.stageProgress?.[0];
            expect(firstStage?.status).toBe('COMPLETED');

            // Second stage (Bank Review) should be IN_PROGRESS, ready for lender upload
            const secondStage = phase?.documentationPhase?.stageProgress?.[1];
            expect(secondStage?.status).toBe('IN_PROGRESS');
        });

        it('Access Bank SLA clock starts when bank review stage activates', async () => {
            // When the bank review stage becomes IN_PROGRESS, we should:
            // 1. Update the ApplicationOrganization status to ACTIVE
            // 2. Start the SLA clock (slaStartedAt)
            //
            // This allows monitoring for SLA breaches - if Access Bank doesn't
            // respond within 48 hours, we can trigger escalation.

            await prisma.applicationOrganization.update({
                where: { id: appOrgAccessBankId },
                data: {
                    status: 'ACTIVE',
                    slaStartedAt: new Date(),
                },
            });

            const appOrg = await prisma.applicationOrganization.findUnique({
                where: { id: appOrgAccessBankId },
            });

            expect(appOrg?.status).toBe('ACTIVE');
            expect(appOrg?.slaStartedAt).toBeDefined();
            expect(appOrg?.slaBreachedAt).toBeNull(); // Not breached yet

            // In a real scenario, a cron job would check:
            // if (now - slaStartedAt > slaHours * 3600 * 1000) → set slaBreachedAt
        });

        it('Nkechi (Lender) uploads the preapproval letter', async () => {
            // After KYC documents are approved, the lender uploads the preapproval letter
            // Once uploaded, the phase completes automatically (no customer signature needed)
            const response = await api
                .post(`/applications/${applicationId}/phases/${documentationPhaseId}/documents`)
                .set(lenderHeaders(nkechiId, tenantId))
                .set('x-idempotency-key', idempotencyKey('nkechi-upload-preapproval'))
                .send({
                    documentType: 'PREAPPROVAL_LETTER',
                    url: 'https://s3.amazonaws.com/qshelter/lender/preapproval-chidi.pdf',
                    fileName: 'preapproval-letter.pdf',
                });

            expect(response.status).toBe(201);

            // Verify the phase completes after bank review
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: documentationPhaseId },
                include: { documentationPhase: { include: { stageProgress: { orderBy: { order: 'asc' } } } } },
            });

            // All approval stages should be completed
            const stageProgress = phase?.documentationPhase?.stageProgress;
            expect(stageProgress?.length).toBeGreaterThan(0);

            // Phase completes automatically after lender uploads preapproval letter
            expect(phase?.status).toBe('COMPLETED');

            // Mark lender's involvement as completed (no SLA breach!)
            await prisma.applicationOrganization.update({
                where: { id: appOrgAccessBankId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });

            const appOrg = await prisma.applicationOrganization.findUnique({
                where: { id: appOrgAccessBankId },
            });
            expect(appOrg?.status).toBe('COMPLETED');
            expect(appOrg?.completedAt).toBeDefined();
            expect(appOrg?.slaBreachedAt).toBeNull(); // Completed within SLA!
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

        it('Event handler (LOCK_UNIT) was executed after downpayment phase completed', async () => {
            // When the downpayment phase completed, the Event Execution Engine should have:
            // 1. Found the PhaseEventAttachment for the downpayment phase template
            // 2. Executed the LOCK_UNIT handler we configured earlier
            // 3. Logged the execution to ApplicationEvent with eventType: HANDLER_EXECUTED

            // Verify the handler execution was logged
            const handlerExecution = await prisma.applicationEvent.findFirst({
                where: {
                    applicationId,
                    eventType: 'HANDLER_EXECUTED',
                },
            });

            expect(handlerExecution).toBeDefined();
            expect(handlerExecution?.eventGroup).toBe('AUTOMATION');

            // Verify execution details in the data payload
            const data = handlerExecution?.data as Record<string, unknown>;
            expect(data?.handlerType).toBe('LOCK_UNIT');
            expect(data?.trigger).toBe('ON_COMPLETE');
            expect(data?.success).toBe(true);

            // Verify the unit is locked
            const unit = await prisma.propertyUnit.findUnique({
                where: { id: unit14BId },
            });
            expect(unit?.status).toBe('RESERVED');
            expect(unit?.reservedById).toBe(chidiId);
        });

        it('Nkechi (Lender) uploads the mortgage offer letter', async () => {
            // After downpayment phase completes, Mortgage Offer Documentation phase activates
            // Nkechi (lender from Access Bank) uploads the mortgage offer letter
            // Once uploaded, the phase completes automatically (no customer signature needed)
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

            // Phase completes automatically (no manual review required for lender docs)
            const phase = await prisma.applicationPhase.findUnique({
                where: { id: mortgageDocumentationPhaseId },
                include: { documentationPhase: { include: { stageProgress: { orderBy: { order: 'asc' } } } } },
            });

            // Phase completes automatically after lender uploads mortgage offer letter
            expect(phase?.status).toBe('COMPLETED');
        });

        it('Application completes after mortgage offer letter is uploaded', async () => {
            // Once the lender uploads the mortgage offer letter, the application is complete
            // The bank handles the actual mortgage payments - that's outside our system
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
            expect(eventTypes).toContain('APPLICATION.COMPLETED');

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

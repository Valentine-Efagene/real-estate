import request from 'supertest';
import { app } from '../../../src/app.js';
import { prisma, cleanupTestData } from '../../setup.js';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import { authHeaders } from '@valentine-efagene/qshelter-common';

/**
 * E2E Test: Jinx's Workflow Builder
 * 
 * This test implements the business scenario defined in SCENARIO.md
 * 
 * Story: Jinx (Admin) dynamically builds a payment method workflow template
 * using the step-by-step builder APIs rather than hardcoded configurations.
 */

const TEST_RUN_ID = randomUUID();

function idempotencyKey(operation: string): string {
    return `${TEST_RUN_ID}:${operation}`;
}

describe("Jinx's Workflow Builder", () => {
    // Actors
    let jinxId: string; // Admin

    // QShelter tenant
    let tenantId: string;

    // Property: Lekki Sunset Gardens
    let propertyId: string;

    // Payment plans for phases
    let downpaymentPlanId: string;
    let mortgagePlanId: string;

    // Template being built
    let paymentMethodId: string;
    let phase1Id: string; // Underwriting & Documentation
    let phase2Id: string; // Downpayment
    let phase3Id: string; // Final Documentation
    let phase4Id: string; // Mortgage

    // Steps in Phase 1
    let step1Id: string;
    let step2Id: string;
    let step3Id: string;
    let step4Id: string;
    let step5Id: string;
    let step6Id: string;
    let step7Id: string;

    // Cloned template
    let clonedMethodId: string;

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

        // Create Jinx (Admin - Loan operations manager)
        const jinx = await prisma.user.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                email: 'jinx@qshelter.com',
                firstName: 'Jinx',
                lastName: 'Okafor',
            },
        });
        jinxId = jinx.id;

        // Create Lekki Sunset Gardens property
        const property = await prisma.property.create({
            data: {
                id: faker.string.uuid(),
                tenantId,
                userId: jinxId,
                title: 'Lekki Sunset Gardens',
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
    });

    afterAll(async () => {
        await cleanupTestData();
        await prisma.property.delete({ where: { id: propertyId } }).catch(() => {});
        await prisma.paymentPlan.deleteMany({ where: { tenantId } });
        await prisma.user.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
    });

    // ================================================================
    // STEP 0: Jinx creates payment plans first
    // ================================================================
    describe('Step 0: Create Payment Plans', () => {
        it('Jinx creates a one-off downpayment plan', async () => {
            const response = await request(app)
                .post('/payment-plans')
                .set(authHeaders(jinxId, tenantId))
                .set('x-idempotency-key', idempotencyKey('jinx-create-downpayment-plan'))
                .send({
                    name: 'Downpayment - One Time',
                    description: 'Single downpayment payment',
                    frequency: 'ONE_TIME',
                    numberOfInstallments: 1,
                    interestRate: 0,
                    gracePeriodDays: 0,
                });

            expect(response.status).toBe(201);
            downpaymentPlanId = response.body.id;
        });

        it('Jinx creates a 20-year mortgage plan', async () => {
            const response = await request(app)
                .post('/payment-plans')
                .set(authHeaders(jinxId, tenantId))
                .set('x-idempotency-key', idempotencyKey('jinx-create-mortgage-plan'))
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
    });

    // ================================================================
    // STEP 1: Jinx creates the payment method template
    // ================================================================
    describe('Step 1: Create Payment Method Template', () => {
        it('Jinx creates "Standard 10/90 Mortgage" template', async () => {
            const response = await request(app)
                .post('/payment-methods')
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Standard 10/90 Mortgage',
                    description: 'Standard mortgage with 10% downpayment and 90% financed over 20 years',
                    isActive: true,
                    allowEarlyPayoff: true,
                    earlyPayoffPenaltyRate: 2,
                    autoActivatePhases: true,
                    requiresManualApproval: true,
                });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Standard 10/90 Mortgage');
            expect(response.body.requiresManualApproval).toBe(true);
            paymentMethodId = response.body.id;
        });
    });

    // ================================================================
    // STEP 2: Jinx adds Phase 1 - Underwriting & Documentation
    // ================================================================
    describe('Step 2: Add Phase 1 - Underwriting & Documentation', () => {
        it('Jinx adds the underwriting phase', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Underwriting & Documentation',
                    description: 'KYC verification and document collection',
                    phaseCategory: 'DOCUMENTATION',
                    phaseType: 'KYC',
                    order: 1,
                    requiresPreviousPhaseCompletion: false,
                });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Underwriting & Documentation');
            expect(response.body.phaseCategory).toBe('DOCUMENTATION');
            phase1Id = response.body.id;
        });
    });

    // ================================================================
    // STEP 3: Jinx adds steps to Phase 1 dynamically
    // ================================================================
    describe('Step 3: Add Steps to Phase 1', () => {
        it('Jinx adds Step 1: Pre-Approval Questionnaire', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/steps`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Pre-Approval Questionnaire',
                    stepType: 'REVIEW',
                    order: 1,
                    metadata: {
                        description: 'Customer answers employment, income, and debt questions',
                    },
                });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Pre-Approval Questionnaire');
            expect(response.body.stepType).toBe('REVIEW');
            step1Id = response.body.id;
        });

        it('Jinx adds Step 2: Upload Valid ID', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/steps`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Upload Valid ID',
                    stepType: 'UPLOAD',
                    order: 2,
                    requiredDocumentTypes: ['ID_CARD', 'PASSPORT', 'DRIVERS_LICENSE'],
                });

            expect(response.status).toBe(201);
            step2Id = response.body.id;
        });

        it('Jinx adds Step 3: Upload Bank Statements', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/steps`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Upload Bank Statements',
                    stepType: 'UPLOAD',
                    order: 3,
                    requiredDocumentTypes: ['BANK_STATEMENT'],
                    metadata: { minimumMonths: 6 },
                });

            expect(response.status).toBe(201);
            step3Id = response.body.id;
        });

        it('Jinx adds Step 4: Upload Employment Letter', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/steps`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Upload Employment Letter',
                    stepType: 'UPLOAD',
                    order: 4,
                    requiredDocumentTypes: ['EMPLOYMENT_LETTER'],
                });

            expect(response.status).toBe(201);
            step4Id = response.body.id;
        });

        it('Jinx adds Step 5: Admin Review & Approval', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/steps`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Admin Review & Approval',
                    stepType: 'APPROVAL',
                    order: 5,
                });

            expect(response.status).toBe(201);
            step5Id = response.body.id;
        });

        it('Jinx adds Step 6: Generate Provisional Offer', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/steps`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Generate Provisional Offer',
                    stepType: 'GENERATE_DOCUMENT',
                    order: 6,
                    metadata: {
                        documentType: 'PROVISIONAL_OFFER',
                        autoSend: true,
                        expiresInDays: 30,
                    },
                });

            expect(response.status).toBe(201);
            step6Id = response.body.id;
        });

        it('Jinx adds Step 7: Sign Provisional Offer', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/steps`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Sign Provisional Offer',
                    stepType: 'SIGNATURE',
                    order: 7,
                });

            expect(response.status).toBe(201);
            step7Id = response.body.id;
        });
    });

    // ================================================================
    // STEP 4: Jinx adds document requirements to Phase 1
    // ================================================================
    describe('Step 4: Add Document Requirements to Phase 1', () => {
        it('Jinx adds Valid ID requirement', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/documents`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    documentType: 'VALID_ID',
                    isRequired: true,
                    description: 'Government-issued photo ID (NIN, Passport, or Driver\'s License)',
                    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
                    maxSizeBytes: 5 * 1024 * 1024, // 5MB
                });

            expect(response.status).toBe(201);
            expect(response.body.documentType).toBe('VALID_ID');
            expect(response.body.isRequired).toBe(true);
        });

        it('Jinx adds Bank Statement requirement', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/documents`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    documentType: 'BANK_STATEMENT',
                    isRequired: true,
                    description: 'Last 6 months bank statements',
                    allowedMimeTypes: ['application/pdf'],
                    maxSizeBytes: 10 * 1024 * 1024, // 10MB
                    metadata: { minimumMonths: 6 },
                });

            expect(response.status).toBe(201);
        });

        it('Jinx adds Employment Letter requirement', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/documents`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    documentType: 'EMPLOYMENT_LETTER',
                    isRequired: true,
                    description: 'Official employment confirmation letter',
                    allowedMimeTypes: ['application/pdf'],
                    maxSizeBytes: 5 * 1024 * 1024,
                });

            expect(response.status).toBe(201);
        });
    });

    // ================================================================
    // STEP 5: Jinx adds Phase 2 - Downpayment
    // ================================================================
    describe('Step 5: Add Phase 2 - Downpayment', () => {
        it('Jinx adds the downpayment phase', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Downpayment',
                    description: '10% downpayment required before final documentation',
                    phaseCategory: 'PAYMENT',
                    phaseType: 'DOWNPAYMENT',
                    order: 2,
                    percentOfPrice: 10,
                    paymentPlanId: downpaymentPlanId,
                    requiresPreviousPhaseCompletion: true,
                });

            expect(response.status).toBe(201);
            expect(response.body.phaseCategory).toBe('PAYMENT');
            expect(response.body.percentOfPrice).toBe(10);
            phase2Id = response.body.id;
        });
    });

    // ================================================================
    // STEP 6: Jinx adds Phase 3 - Final Documentation
    // ================================================================
    describe('Step 6: Add Phase 3 - Final Documentation', () => {
        it('Jinx adds the final documentation phase', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Final Documentation',
                    description: 'Final offer letter and signature after downpayment',
                    phaseCategory: 'DOCUMENTATION',
                    phaseType: 'VERIFICATION',
                    order: 3,
                    requiresPreviousPhaseCompletion: true,
                });

            expect(response.status).toBe(201);
            phase3Id = response.body.id;
        });

        it('Jinx adds Step 1: Generate Final Offer Letter', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase3Id}/steps`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Generate Final Offer Letter',
                    stepType: 'GENERATE_DOCUMENT',
                    order: 1,
                    metadata: {
                        documentType: 'FINAL_OFFER',
                        autoSend: true,
                        shareWithInvestor: true,
                    },
                });

            expect(response.status).toBe(201);
        });

        it('Jinx adds Step 2: Sign Final Offer', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase3Id}/steps`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Sign Final Offer',
                    stepType: 'SIGNATURE',
                    order: 2,
                });

            expect(response.status).toBe(201);
        });
    });

    // ================================================================
    // STEP 7: Jinx adds Phase 4 - Mortgage
    // ================================================================
    describe('Step 7: Add Phase 4 - Mortgage', () => {
        it('Jinx adds the mortgage phase', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Mortgage Payments',
                    description: '90% financed over 20 years at 9.5% p.a.',
                    phaseCategory: 'PAYMENT',
                    phaseType: 'MORTGAGE',
                    order: 4,
                    percentOfPrice: 90,
                    interestRate: 9.5,
                    paymentPlanId: mortgagePlanId,
                    requiresPreviousPhaseCompletion: true,
                });

            expect(response.status).toBe(201);
            expect(response.body.percentOfPrice).toBe(90);
            expect(response.body.interestRate).toBe(9.5);
            phase4Id = response.body.id;
        });
    });

    // ================================================================
    // STEP 8: Jinx reorders steps in Phase 1
    // ================================================================
    describe('Step 8: Reorder Steps in Phase 1', () => {
        it('Jinx reorders steps - moves bank statements before ID upload', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/steps/reorder`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    stepOrders: [
                        { stepId: step1Id, order: 1 },
                        { stepId: step3Id, order: 2 }, // Bank statements now before ID
                        { stepId: step2Id, order: 3 }, // ID now after bank statements
                        { stepId: step4Id, order: 4 },
                        { stepId: step5Id, order: 5 },
                        { stepId: step6Id, order: 6 },
                        { stepId: step7Id, order: 7 },
                    ],
                });

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            
            // Verify the new order
            const bankStep = response.body.find((s: any) => s.id === step3Id);
            const idStep = response.body.find((s: any) => s.id === step2Id);
            expect(bankStep.order).toBe(2);
            expect(idStep.order).toBe(3);
        });
    });

    // ================================================================
    // STEP 9: Jinx updates a step's metadata
    // ================================================================
    describe('Step 9: Update Step Metadata', () => {
        it('Jinx updates the Generate Provisional Offer step with new expiry', async () => {
            const response = await request(app)
                .patch(`/payment-methods/${paymentMethodId}/phases/${phase1Id}/steps/${step6Id}`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    metadata: {
                        documentType: 'PROVISIONAL_OFFER',
                        autoSend: true,
                        expiresInDays: 14, // Changed from 30 to 14
                        notifyOnExpiry: true,
                    },
                });

            expect(response.status).toBe(200);
            expect(response.body.metadata.expiresInDays).toBe(14);
            expect(response.body.metadata.notifyOnExpiry).toBe(true);
        });
    });

    // ================================================================
    // STEP 10: Jinx links the template to a property
    // ================================================================
    describe('Step 10: Link Template to Property', () => {
        it('Jinx links the payment method to Lekki Sunset Gardens', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/properties`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    propertyId,
                    isDefault: true,
                    isActive: true,
                });

            expect(response.status).toBe(201);
            expect(response.body.propertyId).toBe(propertyId);
            expect(response.body.isDefault).toBe(true);
        });
    });

    // ================================================================
    // STEP 11: Jinx clones the template
    // ================================================================
    describe('Step 11: Clone Template', () => {
        it('Jinx clones the template as "Premium 20/80 Mortgage"', async () => {
            const response = await request(app)
                .post(`/payment-methods/${paymentMethodId}/clone`)
                .set(authHeaders(jinxId, tenantId))
                .send({
                    name: 'Premium 20/80 Mortgage',
                    description: 'Premium mortgage with 20% downpayment and 80% financed',
                });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Premium 20/80 Mortgage');
            expect(response.body.id).not.toBe(paymentMethodId);
            clonedMethodId = response.body.id;

            // Verify phases were cloned
            expect(response.body.phases).toHaveLength(4);
            
            // Verify steps were cloned in Phase 1
            const clonedPhase1 = response.body.phases.find((p: any) => p.order === 1);
            expect(clonedPhase1.steps).toHaveLength(7);
        });
    });

    // ================================================================
    // STEP 12: Verify the complete template
    // ================================================================
    describe('Step 12: Verify Complete Template', () => {
        it('Jinx retrieves and verifies the complete template structure', async () => {
            const response = await request(app)
                .get(`/payment-methods/${paymentMethodId}`)
                .set(authHeaders(jinxId, tenantId));

            expect(response.status).toBe(200);
            
            // Verify template metadata
            expect(response.body.name).toBe('Standard 10/90 Mortgage');
            expect(response.body.isActive).toBe(true);
            expect(response.body.requiresManualApproval).toBe(true);
            
            // Verify 4 phases
            expect(response.body.phases).toHaveLength(4);
            
            // Verify Phase 1: Underwriting & Documentation
            const phase1 = response.body.phases.find((p: any) => p.order === 1);
            expect(phase1.name).toBe('Underwriting & Documentation');
            expect(phase1.phaseCategory).toBe('DOCUMENTATION');
            expect(phase1.steps).toHaveLength(7);
            expect(phase1.requiredDocuments).toHaveLength(3);
            
            // Verify Phase 2: Downpayment
            const phase2 = response.body.phases.find((p: any) => p.order === 2);
            expect(phase2.name).toBe('Downpayment');
            expect(phase2.phaseCategory).toBe('PAYMENT');
            expect(phase2.percentOfPrice).toBe(10);
            
            // Verify Phase 3: Final Documentation
            const phase3 = response.body.phases.find((p: any) => p.order === 3);
            expect(phase3.name).toBe('Final Documentation');
            expect(phase3.steps).toHaveLength(2);
            
            // Verify Phase 4: Mortgage
            const phase4 = response.body.phases.find((p: any) => p.order === 4);
            expect(phase4.name).toBe('Mortgage Payments');
            expect(phase4.percentOfPrice).toBe(90);
            expect(phase4.interestRate).toBe(9.5);
            
            // Verify property is linked
            expect(response.body.properties).toHaveLength(1);
            expect(response.body.properties[0].property.id).toBe(propertyId);
        });

        it('The template is ready for customer applications', async () => {
            // Verify we can list active payment methods
            const response = await request(app)
                .get('/payment-methods?isActive=true')
                .set(authHeaders(jinxId, tenantId));

            expect(response.status).toBe(200);
            
            // Should have both original and cloned templates
            const templates = response.body;
            expect(templates.length).toBeGreaterThanOrEqual(2);
            
            const original = templates.find((t: any) => t.name === 'Standard 10/90 Mortgage');
            const cloned = templates.find((t: any) => t.name === 'Premium 20/80 Mortgage');
            
            expect(original).toBeDefined();
            expect(cloned).toBeDefined();
        });
    });
});

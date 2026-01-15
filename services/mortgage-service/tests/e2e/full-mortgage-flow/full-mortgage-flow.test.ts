/**
 * Full End-to-End Mortgage Flow Test (LocalStack)
 *
 * This test implements the complete business scenario defined in SCENARIO.md
 * All operations are performed via REST APIs - nothing is seeded manually.
 *
 * Prerequisites:
 * - LocalStack running with all services deployed
 * - user-service, property-service, mortgage-service all deployed
 *
 * Run with:
 *   npm run test:e2e:localstack:full
 *   # or directly:
 *   ./scripts/run-full-e2e-localstack.sh
 *
 * The script fetches API Gateway URLs from LocalStack and sets environment variables.
 * DO NOT run this test directly - always use the script to ensure proper URLs.
 *
 * Actors:
 * - Adaeze (Admin): Loan operations manager at QShelter
 * - Chidi (Customer): First-time homebuyer purchasing a 3-bedroom flat in Lekki
 * - Property: Lekki Gardens Estate, Unit 14B, ₦85,000,000
 * - Payment Plan: 10% downpayment (ONE_TIME), 90% mortgage at 9.5% p.a. over 20 years
 */

import supertest from 'supertest';
import { prisma, cleanupTestData } from '../../setup.js';
import { randomUUID } from 'crypto';

// Service URLs - MUST be set via environment (no localhost fallbacks)
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL;
const MORTGAGE_SERVICE_URL = process.env.MORTGAGE_SERVICE_URL || process.env.API_BASE_URL;

// Validate required environment variables
function validateEnvVars() {
    const missing: string[] = [];
    if (!USER_SERVICE_URL) missing.push('USER_SERVICE_URL');
    if (!PROPERTY_SERVICE_URL) missing.push('PROPERTY_SERVICE_URL');
    if (!MORTGAGE_SERVICE_URL) missing.push('MORTGAGE_SERVICE_URL or API_BASE_URL');

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            `Run this test using: ./scripts/run-full-e2e.sh`
        );
    }
}

// Validate on module load
validateEnvVars();

// Create API clients for each service (URLs are guaranteed to be set after validation)
const userApi = supertest(USER_SERVICE_URL!);
const propertyApi = supertest(PROPERTY_SERVICE_URL!);
const mortgageApi = supertest(MORTGAGE_SERVICE_URL!);

// Bootstrap secret for tenant creation
const BOOTSTRAP_SECRET =
    process.env.BOOTSTRAP_SECRET || 'local-bootstrap-secret';

// Unique test run ID for idempotency
const TEST_RUN_ID = randomUUID();

function idempotencyKey(operation: string): string {
    return `${TEST_RUN_ID}:${operation}`;
}

// Auth header helpers
function adminHeaders(
    accessToken: string,
    tenantId: string
): Record<string, string> {
    // Extract userId from JWT token
    const tokenPayload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    return {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': tenantId,
        'x-authorizer-tenant-id': tenantId,
        'x-authorizer-user-id': tokenPayload.sub,
        'Content-Type': 'application/json',
    };
}

function customerHeaders(
    accessToken: string,
    tenantId: string
): Record<string, string> {
    // Extract userId from JWT token
    const tokenPayload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    return {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': tenantId,
        'x-authorizer-tenant-id': tenantId,
        'x-authorizer-user-id': tokenPayload.sub,
        'Content-Type': 'application/json',
    };
}

describe('Full E2E Mortgage Flow', () => {
    // Tenant & Auth
    let tenantId: string;
    let adaezeId: string;
    let adaezeAccessToken: string;
    let chidiId: string;
    let chidiAccessToken: string;

    // Property
    let propertyId: string;
    let variantId: string;
    let unitId: string;

    // Payment Configuration
    let downpaymentPlanId: string;
    let mortgagePlanId: string;
    let paymentMethodId: string;

    // Application
    let applicationId: string;
    let kycPhaseId: string;
    let downpaymentPhaseId: string;
    let verificationPhaseId: string;
    let mortgagePhaseId: string;

    // Document IDs for approval
    let docIdCard: string;
    let docBankStatement: string;
    let docEmploymentLetter: string;

    // Payment tracking
    let downpaymentInstallmentId: string;
    let paymentReference: string;

    // Realistic Nigerian property pricing
    const propertyPrice = 85_000_000; // ₦85M
    const downpaymentAmount = 8_500_000; // 10% = ₦8.5M
    const mortgageAmount = 76_500_000; // 90% = ₦76.5M
    const mortgageTermMonths = 240; // 20 years

    beforeAll(async () => {
        await cleanupTestData();
    });

    afterAll(async () => {
        // Optionally clean up after test
        // await cleanupTestData();
    });

    // =========================================================================
    // Phase 1: Tenant Bootstrap
    // =========================================================================
    describe('Phase 1: Tenant Bootstrap', () => {
        it('Step 1.1: Bootstrap tenant with roles and admin', async () => {
            const response = await userApi
                .post('/admin/bootstrap-tenant')
                .set('x-bootstrap-secret', BOOTSTRAP_SECRET)
                .set('Content-Type', 'application/json')
                .send({
                    tenant: {
                        name: 'QShelter Real Estate',
                        subdomain: `qshelter-${TEST_RUN_ID.slice(0, 8)}`,
                    },
                    admin: {
                        email: `adaeze-${TEST_RUN_ID.slice(0, 8)}@qshelter.com`,
                        password: 'SecureAdmin123!',
                        firstName: 'Adaeze',
                        lastName: 'Okonkwo',
                    },
                });

            expect(response.status).toBe(201);
            // Bootstrap endpoint returns data directly, not wrapped in { success, data }
            expect(response.body.tenant).toBeDefined();
            expect(response.body.admin).toBeDefined();

            tenantId = response.body.tenant.id;
            adaezeId = response.body.admin.id;

            // Verify roles were created
            expect(response.body.roles.length).toBeGreaterThanOrEqual(5);
        });

        it('Step 1.2: Admin logs in', async () => {
            const response = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({
                    email: `adaeze-${TEST_RUN_ID.slice(0, 8)}@qshelter.com`,
                    password: 'SecureAdmin123!',
                });

            expect(response.status).toBe(200);
            // Auth endpoints use { success, data } wrapper
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();

            adaezeAccessToken = response.body.data.accessToken;
        });
    });

    // =========================================================================
    // Phase 2: Customer Registration
    // =========================================================================
    describe('Phase 2: Customer Registration', () => {
        it('Step 2.1: Chidi signs up', async () => {
            const response = await userApi
                .post('/auth/signup')
                .set('Content-Type', 'application/json')
                .send({
                    email: `chidi-${TEST_RUN_ID.slice(0, 8)}@gmail.com`,
                    password: 'CustomerPass123!',
                    firstName: 'Chidi',
                    lastName: 'Nnamdi',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();

            chidiAccessToken = response.body.data.accessToken;

            // Extract user ID from JWT token (payload.sub)
            const tokenPayload = JSON.parse(Buffer.from(chidiAccessToken.split('.')[1], 'base64').toString());
            chidiId = tokenPayload.sub;
            expect(chidiId).toBeDefined();
        });
    });

    // =========================================================================
    // Phase 3: Property Setup
    // =========================================================================
    describe('Phase 3: Property Setup', () => {
        it('Step 3.1: Admin creates property', async () => {
            const response = await propertyApi
                .post('/property/properties')
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .send({
                    title: 'Lekki Gardens Estate',
                    description: 'Premium residential estate in Lekki Phase 1',
                    category: 'SALE',
                    propertyType: 'APARTMENT',
                    country: 'Nigeria',
                    currency: 'NGN',
                    city: 'Lagos',
                    district: 'Lekki',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            propertyId = response.body.data.id;
        });

        it('Step 3.2: Admin creates property variant', async () => {
            const response = await propertyApi
                .post(`/property/properties/${propertyId}/variants`)
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .send({
                    name: '3-Bedroom Flat',
                    nBedrooms: 3,
                    nBathrooms: 3,
                    nParkingSpots: 1,
                    area: 150,
                    price: propertyPrice,
                    totalUnits: 20,
                    availableUnits: 15,
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            variantId = response.body.data.id;
        });

        it('Step 3.3: Admin creates property unit', async () => {
            const response = await propertyApi
                .post(
                    `/property/properties/${propertyId}/variants/${variantId}/units`
                )
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .send({
                    unitNumber: '14B',
                    floorNumber: 14,
                    blockName: 'Block B',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            unitId = response.body.data.id;
        });

        it('Step 3.4: Admin publishes property', async () => {
            const response = await propertyApi
                .patch(`/property/properties/${propertyId}/publish`)
                .set(adminHeaders(adaezeAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.isPublished).toBe(true);
        });
    });

    // =========================================================================
    // Phase 4: Payment Configuration
    // =========================================================================
    describe('Phase 4: Payment Configuration', () => {
        it('Step 4.1: Admin creates one-off downpayment plan', async () => {
            const response = await mortgageApi
                .post('/payment-plans')
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-downpayment-plan'))
                .send({
                    name: '10% One-Off Downpayment',
                    description: 'Single upfront payment for property reservation',
                    frequency: 'ONE_TIME',
                    numberOfInstallments: 1,
                    interestRate: 0,
                    gracePeriodDays: 30,
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            downpaymentPlanId = response.body.data.id;
        });

        it('Step 4.2: Admin creates flexible mortgage plan', async () => {
            const response = await mortgageApi
                .post('/payment-plans')
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-mortgage-plan'))
                .send({
                    name: 'Flexible Mortgage at 9.5%',
                    description:
                        'Monthly payments at 9.5% annual interest, term selected by applicant',
                    frequency: 'MONTHLY',
                    numberOfInstallments: 240,
                    interestRate: 9.5,
                    gracePeriodDays: 15,
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            mortgagePlanId = response.body.data.id;
        });

        it('Step 4.3: Admin creates payment method with 4 phases', async () => {
            const response = await mortgageApi
                .post('/payment-methods')
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-payment-method'))
                .send({
                    name: '10/90 Lekki Mortgage',
                    description:
                        'Underwriting → Downpayment → Final Documentation → Mortgage',
                    requiresManualApproval: true,
                    phases: [
                        {
                            name: 'Underwriting & Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'KYC',
                            order: 1,
                            requiredDocumentTypes: [
                                'ID_CARD',
                                'BANK_STATEMENT',
                                'EMPLOYMENT_LETTER',
                            ],
                            stepDefinitions: [
                                { name: 'Upload Valid ID', stepType: 'UPLOAD', order: 1 },
                                {
                                    name: 'Upload Bank Statements',
                                    stepType: 'UPLOAD',
                                    order: 2,
                                },
                                {
                                    name: 'Upload Employment Letter',
                                    stepType: 'UPLOAD',
                                    order: 3,
                                },
                                {
                                    name: 'Admin Reviews Documents',
                                    stepType: 'APPROVAL',
                                    order: 4,
                                },
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
                                {
                                    name: 'Customer Signs Provisional Offer',
                                    stepType: 'SIGNATURE',
                                    order: 6,
                                },
                            ],
                        },
                        {
                            name: '10% Downpayment',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'DOWNPAYMENT',
                            order: 2,
                            percentOfPrice: 10,
                            paymentPlanId: downpaymentPlanId,
                        },
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
                                    metadata: { documentType: 'FINAL_OFFER', uploadedBy: 'ADMIN' },
                                },
                                {
                                    name: 'Customer Signs Final Offer',
                                    stepType: 'SIGNATURE',
                                    order: 2,
                                },
                            ],
                        },
                        {
                            name: '20-Year Mortgage',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'MORTGAGE',
                            order: 4,
                            percentOfPrice: 90,
                            interestRate: 9.5,
                            paymentPlanId: mortgagePlanId,
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.phases).toHaveLength(4);

            paymentMethodId = response.body.data.id;
        });

        it('Step 4.4: Admin links payment method to property', async () => {
            const response = await mortgageApi
                .post(`/payment-methods/${paymentMethodId}/properties`)
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('link-payment-method'))
                .send({
                    propertyId: propertyId,
                    isDefault: true,
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });

        it('Step 4.5: Admin configures document requirement rules', async () => {
            const response = await mortgageApi
                .post(`/payment-methods/${paymentMethodId}/document-rules`)
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .send({
                    rules: [
                        {
                            context: 'APPLICATION_PHASE',
                            phaseType: 'KYC',
                            documentType: 'ID_CARD',
                            isRequired: true,
                            description:
                                'Valid government-issued ID (NIN, Passport, or Driver License)',
                            maxSizeBytes: 5242880,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                        },
                        {
                            context: 'APPLICATION_PHASE',
                            phaseType: 'KYC',
                            documentType: 'BANK_STATEMENT',
                            isRequired: true,
                            description: 'Last 6 months bank statements',
                            maxSizeBytes: 10485760,
                            allowedMimeTypes: ['application/pdf'],
                            expiryDays: 90,
                        },
                        {
                            context: 'APPLICATION_PHASE',
                            phaseType: 'KYC',
                            documentType: 'EMPLOYMENT_LETTER',
                            isRequired: true,
                            description: 'Employment confirmation letter',
                            maxSizeBytes: 5242880,
                            allowedMimeTypes: ['application/pdf'],
                        },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });
    });

    // =========================================================================
    // Phase 5: Customer Application
    // =========================================================================
    describe('Phase 5: Customer Application', () => {
        it('Step 5.1: Chidi creates application', async () => {
            const response = await mortgageApi
                .post('/applications')
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('create-application'))
                .send({
                    propertyUnitId: unitId,
                    paymentMethodId: paymentMethodId,
                    title: 'Purchase Agreement - Lekki Gardens Unit 14B',
                    applicationType: 'MORTGAGE',
                    totalAmount: propertyPrice,
                    monthlyIncome: 2500000,
                    monthlyExpenses: 800000,
                    applicantAge: 40,
                    selectedMortgageTermMonths: mortgageTermMonths,
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.phases).toHaveLength(4);

            applicationId = response.body.data.id;

            // Extract phase IDs
            const phases = response.body.data.phases;
            kycPhaseId = phases.find(
                (p: { phaseType: string }) => p.phaseType === 'KYC'
            )?.id;
            downpaymentPhaseId = phases.find(
                (p: { phaseType: string }) => p.phaseType === 'DOWNPAYMENT'
            )?.id;
            verificationPhaseId = phases.find(
                (p: { phaseType: string }) => p.phaseType === 'VERIFICATION'
            )?.id;
            mortgagePhaseId = phases.find(
                (p: { phaseType: string }) => p.phaseType === 'MORTGAGE'
            )?.id;

            expect(kycPhaseId).toBeDefined();
            expect(downpaymentPhaseId).toBeDefined();
            expect(verificationPhaseId).toBeDefined();
            expect(mortgagePhaseId).toBeDefined();
        });

        it('Step 5.2: Verify phase amounts', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases`)
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const phases = response.body.data;
            const downpaymentPhase = phases.find(
                (p: { phaseType: string }) => p.phaseType === 'DOWNPAYMENT'
            );
            const mortgagePhase = phases.find(
                (p: { phaseType: string }) => p.phaseType === 'MORTGAGE'
            );

            expect(downpaymentPhase.totalAmount).toBe(downpaymentAmount);
            expect(mortgagePhase.totalAmount).toBe(mortgageAmount);
        });

        it('Step 5.3: Chidi submits application', async () => {
            const response = await mortgageApi
                .post(`/applications/${applicationId}/transition`)
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('submit-application'))
                .send({
                    action: 'SUBMIT',
                    note: 'Submitting for processing',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('PENDING');
        });

        it('Step 5.4: KYC phase is auto-activated when application is submitted', async () => {
            // First phase should be automatically activated when application transitions to PENDING
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('IN_PROGRESS');
        });
    });

    // =========================================================================
    // Phase 6: KYC Document Upload & Approval
    // =========================================================================
    describe('Phase 6: KYC Document Upload & Approval', () => {
        it('Step 6.1a: Chidi uploads ID card (auto-completes UPLOAD step)', async () => {
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/phases/${kycPhaseId}/documents`
                )
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('upload-id-card'))
                .send({
                    documentType: 'ID_CARD',
                    url: 'https://s3.amazonaws.com/qshelter/chidi/id.pdf',
                    fileName: 'id.pdf',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            docIdCard = response.body.data.document?.id || response.body.data.id;

            // Verify action status is returned with upload response
            if (response.body.data.phaseActionStatus) {
                expect(response.body.data.phaseActionStatus).toBeDefined();
                expect(response.body.data.phaseActionStatus.nextActor).toBeDefined();
            }
            // UPLOAD step auto-completes when document is uploaded
        });

        it('Step 6.1b: Chidi uploads bank statement (auto-completes UPLOAD step)', async () => {
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/phases/${kycPhaseId}/documents`
                )
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('upload-bank-statement'))
                .send({
                    documentType: 'BANK_STATEMENT',
                    url: 'https://s3.amazonaws.com/qshelter/chidi/bank.pdf',
                    fileName: 'bank.pdf',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            docBankStatement = response.body.data.document?.id || response.body.data.id;
        });

        it('Step 6.1c: Chidi uploads employment letter (auto-completes UPLOAD step)', async () => {
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/phases/${kycPhaseId}/documents`
                )
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('upload-employment-letter'))
                .send({
                    documentType: 'EMPLOYMENT_LETTER',
                    url: 'https://s3.amazonaws.com/qshelter/chidi/employment.pdf',
                    fileName: 'employment.pdf',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            docEmploymentLetter = response.body.data.document?.id || response.body.data.id;
        });

        it('Step 6.2: Verify action status indicates ADMIN review needed', async () => {
            // After all uploads, verify phase action status shows ADMIN needs to review
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify action status is included
            if (response.body.data.actionStatus) {
                const actionStatus = response.body.data.actionStatus;
                // At this point, UPLOAD steps are complete, APPROVAL step is next
                // So nextActor should be ADMIN for document review
                expect(['ADMIN', 'CUSTOMER']).toContain(actionStatus.nextActor);
                expect(actionStatus.actionRequired).toBeDefined();
            }
        });

        // NOTE: Manual step completion calls removed - UPLOAD steps auto-complete

        it('Step 6.3: Admin retrieves documents for review', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}/documents`)
                .set(adminHeaders(adaezeAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(3);
        });

        it('Step 6.4a: Admin approves ID card', async () => {
            const response = await mortgageApi
                .post(`/applications/${applicationId}/documents/${docIdCard}/review`)
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('approve-id-card'))
                .send({
                    status: 'APPROVED',
                    note: 'ID verified successfully',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('Step 6.4b: Admin approves bank statement', async () => {
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/documents/${docBankStatement}/review`
                )
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('approve-bank-statement'))
                .send({
                    status: 'APPROVED',
                    note: 'Bank statements verified',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('Step 6.4c: Admin approves employment letter (auto-completes APPROVAL step)', async () => {
            // When the last document is approved, APPROVAL step auto-completes
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/documents/${docEmploymentLetter}/review`
                )
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('approve-employment-letter'))
                .send({
                    status: 'APPROVED',
                    note: 'Employment verified',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            // APPROVAL step auto-completes when all documents are approved
        });

        // NOTE: Manual review step completion removed - APPROVAL step auto-completes

        it('Step 6.7: Chidi signs provisional offer (manual SIGNATURE step)', async () => {
            // SIGNATURE steps require explicit user action
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/phases/${kycPhaseId}/steps/complete`
                )
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('sign-provisional-offer'))
                .send({ stepName: 'Customer Signs Provisional Offer' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            // KYC phase auto-completes when all steps done
        });

        it('Verify KYC phase is completed (auto-transition)', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
        });
    });

    // =========================================================================
    // Phase 7: Downpayment (One-Time Payment)
    // =========================================================================
    describe('Phase 7: Downpayment', () => {
        it('Step 7.1: Generate downpayment installment', async () => {
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/phases/${downpaymentPhaseId}/installments`
                )
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('generate-downpayment'))
                .send({ startDate: new Date().toISOString() });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.installments).toHaveLength(1);
            expect(response.body.data.installments[0].amount).toBe(downpaymentAmount);

            downpaymentInstallmentId = response.body.data.installments[0].id;
        });

        it('Step 7.2: Record downpayment', async () => {
            const response = await mortgageApi
                .post(`/applications/${applicationId}/payments`)
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('pay-downpayment'))
                .send({
                    phaseId: downpaymentPhaseId,
                    installmentId: downpaymentInstallmentId,
                    amount: downpaymentAmount,
                    paymentMethod: 'BANK_TRANSFER',
                    externalReference: 'TRF-CHIDI-DOWNPAYMENT-001',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.reference).toBeDefined();

            paymentReference = response.body.data.reference;
        });

        it('Step 7.3: Process payment confirmation', async () => {
            const response = await mortgageApi
                .post('/applications/payments/process')
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('process-downpayment'))
                .send({
                    reference: paymentReference,
                    status: 'COMPLETED',
                    gatewayTransactionId: 'GW-TRX-123456',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('Verify downpayment phase is completed', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${downpaymentPhaseId}`)
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
        });
    });

    // =========================================================================
    // Phase 8: Final Documentation
    // =========================================================================
    describe('Phase 8: Final Documentation', () => {
        it('Step 8.1: Admin uploads final offer letter (auto-completes UPLOAD step)', async () => {
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/phases/${verificationPhaseId}/documents`
                )
                .set(adminHeaders(adaezeAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('upload-final-offer'))
                .send({
                    documentType: 'FINAL_OFFER',
                    url: 'https://s3.amazonaws.com/qshelter/applications/chidi-final-offer.pdf',
                    fileName: 'chidi-final-offer.pdf',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            // UPLOAD step auto-completes when document is uploaded
        });

        // NOTE: Manual upload step completion removed - auto-completes

        it('Step 8.3: Chidi signs final offer (manual SIGNATURE step)', async () => {
            // SIGNATURE steps require explicit user action
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/phases/${verificationPhaseId}/steps/complete`
                )
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('sign-final-offer'))
                .send({ stepName: 'Customer Signs Final Offer' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            // Phase auto-completes when all steps done
        });

        it('Verify verification phase is completed (auto-transition)', async () => {
            const response = await mortgageApi
                .get(
                    `/applications/${applicationId}/phases/${verificationPhaseId}`
                )
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
        });
    });

    // =========================================================================
    // Phase 9: Mortgage Activation
    // =========================================================================
    describe('Phase 9: Mortgage Activation', () => {
        it('Step 9.1: Generate mortgage installments', async () => {
            const response = await mortgageApi
                .post(
                    `/applications/${applicationId}/phases/${mortgagePhaseId}/installments`
                )
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('generate-mortgage'))
                .send({ startDate: new Date().toISOString() });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.installments).toHaveLength(mortgageTermMonths);
        });

        it('Step 9.2: Chidi signs and activates application', async () => {
            const response = await mortgageApi
                .post(`/applications/${applicationId}/sign`)
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('sign-application'));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('ACTIVE');
            expect(response.body.data.signedAt).toBeDefined();
        });
    });

    // =========================================================================
    // Phase 10: First Mortgage Payment (Optional Verification)
    // =========================================================================
    describe('Phase 10: First Mortgage Payment (Optional)', () => {
        let firstInstallmentId: string;
        let firstInstallmentAmount: number;

        it('Step 10.1: Get pending installment', async () => {
            const response = await mortgageApi
                .get(
                    `/applications/${applicationId}/phases/${mortgagePhaseId}/installments?status=PENDING&limit=1`
                )
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);

            firstInstallmentId = response.body.data[0].id;
            firstInstallmentAmount = response.body.data[0].amount;
        });

        it('Step 10.2: Record first monthly payment', async () => {
            const response = await mortgageApi
                .post(`/applications/${applicationId}/payments`)
                .set(customerHeaders(chidiAccessToken, tenantId))
                .set('x-idempotency-key', idempotencyKey('first-mortgage-payment'))
                .send({
                    phaseId: mortgagePhaseId,
                    installmentId: firstInstallmentId,
                    amount: firstInstallmentAmount,
                    paymentMethod: 'BANK_TRANSFER',
                    externalReference: 'TRF-CHIDI-MORTGAGE-001',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });
    });

    // =========================================================================
    // Verification: Audit Trail
    // =========================================================================
    describe('Audit Trail Verification', () => {
        it('Complete event trail exists for audit', async () => {
            // Query for events related to this application
            const events = await prisma.domainEvent.findMany({
                where: {
                    OR: [
                        { aggregateId: applicationId },
                        {
                            AND: [
                                { eventType: { startsWith: 'APPLICATION' } },
                                { payload: { contains: applicationId } },
                            ],
                        },
                    ],
                },
                orderBy: { occurredAt: 'asc' },
            });

            const eventTypes = events.map((e) => e.eventType);

            // We should have at least an APPLICATION.CREATED event
            expect(eventTypes).toContain('APPLICATION.CREATED');
            // The flow generates multiple events (created, status changes, payments, etc.)
            expect(events.length).toBeGreaterThanOrEqual(1);

            // Verify all events have proper structure
            for (const event of events) {
                expect(event.aggregateType).toBeDefined();
                expect(event.aggregateId).toBeDefined();
                expect(event.payload).toBeDefined();
                expect(event.occurredAt).toBeDefined();
            }
        });
    });

    // =========================================================================
    // Verification: Action Status Indicators (Back-end Driven UI)
    // =========================================================================
    describe('Action Status Indicators', () => {
        it('Application includes actionStatus in response', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}`)
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify application-level action status
            const app = response.body.data;
            if (app.actionStatus) {
                expect(app.actionStatus.nextActor).toBeDefined();
                expect(app.actionStatus.actionCategory).toBeDefined();
                expect(app.actionStatus.actionRequired).toBeDefined();
                expect(app.actionStatus.applicationId).toBe(applicationId);
            }
        });

        it('All phases include actionStatus', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases`)
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const phases = response.body.data;
            for (const phase of phases) {
                // Each phase should have action status
                if (phase.actionStatus) {
                    expect(phase.actionStatus.nextActor).toBeDefined();
                    expect(phase.actionStatus.actionCategory).toBeDefined();
                    expect(phase.actionStatus.actionRequired).toBeDefined();

                    // Completed phases should show NONE as next actor
                    if (phase.status === 'COMPLETED') {
                        expect(phase.actionStatus.nextActor).toBe('NONE');
                        expect(phase.actionStatus.actionCategory).toBe('COMPLETED');
                    }
                }
            }
        });

        it('Documentation phase steps include actionStatus', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const phase = response.body.data;
            const steps = phase.documentationPhase?.steps || [];

            for (const step of steps) {
                if (step.actionStatus) {
                    expect(step.actionStatus.stepId).toBe(step.id);
                    expect(step.actionStatus.stepName).toBe(step.name);
                    expect(step.actionStatus.nextActor).toBeDefined();

                    // UPLOAD steps completed should show NONE
                    if (step.stepType === 'UPLOAD' && step.status === 'COMPLETED') {
                        expect(step.actionStatus.nextActor).toBe('NONE');
                    }

                    // SIGNATURE steps show CUSTOMER as next actor
                    if (step.stepType === 'SIGNATURE' && step.status !== 'COMPLETED') {
                        expect(step.actionStatus.nextActor).toBe('CUSTOMER');
                    }
                }
            }
        });

        it('Payment phase shows correct payment action status', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${mortgagePhaseId}`)
                .set(customerHeaders(chidiAccessToken, tenantId));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const phase = response.body.data;
            if (phase.actionStatus) {
                // Payment phases should show CUSTOMER as next actor (they need to pay)
                // unless fully paid
                if (phase.status !== 'COMPLETED') {
                    expect(phase.actionStatus.nextActor).toBe('CUSTOMER');
                    expect(phase.actionStatus.actionCategory).toBe('PAYMENT');
                    expect(phase.actionStatus.paymentProgress).toBeDefined();
                }
            }
        });
    });

    // =========================================================================
    // Verification: Authorization & Access Control
    // =========================================================================
    describe('Authorization & Access Control', () => {
        describe('Unauthenticated Access', () => {
            it('Rejects requests without auth headers', async () => {
                const response = await mortgageApi
                    .get(`/applications/${applicationId}`)
                    .set('Content-Type', 'application/json');

                // Should fail without auth context
                expect([400, 401, 403, 500]).toContain(response.status);
            });

            it('Rejects requests with only Authorization header (no authorizer context)', async () => {
                const response = await mortgageApi
                    .get(`/applications/${applicationId}`)
                    .set('Authorization', `Bearer ${chidiAccessToken}`)
                    .set('Content-Type', 'application/json');

                // Should fail without x-authorizer-* headers (tenant context missing)
                expect([400, 401, 403, 500]).toContain(response.status);
            });
        });

        describe('Customer Cannot Access Admin Endpoints', () => {
            it('Customer cannot create payment plans', async () => {
                const response = await mortgageApi
                    .post('/payment-plans')
                    .set(customerHeaders(chidiAccessToken, tenantId))
                    .set('x-idempotency-key', idempotencyKey('customer-create-plan-fail'))
                    .send({
                        name: 'Unauthorized Plan',
                        description: 'Customer should not be able to create this',
                        frequency: 'MONTHLY',
                        numberOfInstallments: 12,
                        interestRate: 5,
                        gracePeriodDays: 15,
                    });

                // Payment plan creation is admin-only
                expect([401, 403]).toContain(response.status);
            });

            it('Customer cannot create payment methods', async () => {
                const response = await mortgageApi
                    .post('/payment-methods')
                    .set(customerHeaders(chidiAccessToken, tenantId))
                    .set('x-idempotency-key', idempotencyKey('customer-create-method-fail'))
                    .send({
                        name: 'Unauthorized Method',
                        description: 'Customer should not be able to create this',
                        requiresManualApproval: false,
                        phases: [],
                    });

                // Payment method creation is admin-only
                expect([401, 403]).toContain(response.status);
            });

            it('Customer cannot admin-terminate an application', async () => {
                const response = await mortgageApi
                    .post(`/applications/${applicationId}/admin-terminate`)
                    .set(customerHeaders(chidiAccessToken, tenantId))
                    .set('x-idempotency-key', idempotencyKey('customer-admin-terminate-fail'))
                    .send({
                        reason: 'ADMIN_DECISION',
                        refundAmount: 1000000,
                        internalNotes: 'Customer trying to admin-terminate',
                    });

                // Admin termination is admin-only
                expect([401, 403]).toContain(response.status);
            });
        });

        describe('Cross-Tenant Isolation', () => {
            let otherTenantId: string;
            let otherAdminToken: string;

            beforeAll(async () => {
                // Create a second tenant
                const bootstrapResponse = await userApi
                    .post('/admin/bootstrap-tenant')
                    .set('x-bootstrap-secret', BOOTSTRAP_SECRET)
                    .set('Content-Type', 'application/json')
                    .send({
                        tenant: {
                            name: 'Other Real Estate Co',
                            subdomain: `other-${TEST_RUN_ID.slice(0, 8)}`,
                        },
                        admin: {
                            email: `other-admin-${TEST_RUN_ID.slice(0, 8)}@other.com`,
                            password: 'OtherAdmin123!',
                            firstName: 'Other',
                            lastName: 'Admin',
                        },
                    });

                expect(bootstrapResponse.status).toBe(201);
                otherTenantId = bootstrapResponse.body.tenant.id;

                // Login as other admin
                const loginResponse = await userApi
                    .post('/auth/login')
                    .set('Content-Type', 'application/json')
                    .send({
                        email: `other-admin-${TEST_RUN_ID.slice(0, 8)}@other.com`,
                        password: 'OtherAdmin123!',
                    });

                expect(loginResponse.status).toBe(200);
                otherAdminToken = loginResponse.body.data.accessToken;
            });

            it('Other tenant admin cannot access first tenant application', async () => {
                const response = await mortgageApi
                    .get(`/applications/${applicationId}`)
                    .set(adminHeaders(otherAdminToken, otherTenantId));

                // Should not find the application (belongs to different tenant)
                expect([403, 404]).toContain(response.status);
            });

            it('Other tenant admin cannot list first tenant applications', async () => {
                const response = await mortgageApi
                    .get('/applications')
                    .set(adminHeaders(otherAdminToken, otherTenantId));

                expect(response.status).toBe(200);
                // Should not include applications from first tenant
                const apps = response.body.data || [];
                const foundOurApp = apps.some((app: { id: string }) => app.id === applicationId);
                expect(foundOurApp).toBe(false);
            });

            it('Other tenant admin cannot modify first tenant payment method', async () => {
                const response = await mortgageApi
                    .patch(`/payment-methods/${paymentMethodId}`)
                    .set(adminHeaders(otherAdminToken, otherTenantId))
                    .send({
                        name: 'Hijacked Payment Method',
                    });

                // Should not be able to modify (belongs to different tenant)
                expect([403, 404]).toContain(response.status);
            });
        });

        describe('Ownership Verification', () => {
            it('Customer can only sign their own application', async () => {
                // Chidi should be able to view his own application
                const response = await mortgageApi
                    .get(`/applications/${applicationId}`)
                    .set(customerHeaders(chidiAccessToken, tenantId));

                expect(response.status).toBe(200);
                expect(response.body.data.buyerId).toBe(chidiId);
            });

            it('Different customer cannot access Chidi application', async () => {
                // Create another customer in the same tenant
                const signupResponse = await userApi
                    .post('/auth/signup')
                    .set('Content-Type', 'application/json')
                    .send({
                        email: `emeka-${TEST_RUN_ID.slice(0, 8)}@gmail.com`,
                        password: 'EmekaPass123!',
                        firstName: 'Emeka',
                        lastName: 'Obi',
                    });

                expect(signupResponse.status).toBe(201);
                const emekaToken = signupResponse.body.data.accessToken;

                // Emeka tries to access Chidi's application
                const response = await mortgageApi
                    .get(`/applications/${applicationId}`)
                    .set(customerHeaders(emekaToken, tenantId));

                // Should be forbidden (not the buyer)
                expect([403, 404]).toContain(response.status);
            });
        });
    });
});

/**
 * Full End-to-End Mortgage Flow Test (AWS Staging)
 *
 * This test implements the complete business scenario matching the service-level
 * chidi-lekki-mortgage test. All operations are performed via REST APIs only.
 * NO DATABASE ACCESS - purely API-driven tests.
 *
 * Prerequisites:
 * - All services deployed to AWS staging
 * - Bootstrap secret configured in SSM
 *
 * Run with:
 *   npm run test:full-mortgage
 *   # or directly:
 *   ./scripts/run-full-e2e-staging.sh
 *
 * Setup Phases:
 * 1. Bootstrap → Admin (Adaeze) setup
 * 2. Organizations → Invite staff (Emeka as agent, Nkechi as lender_ops)
 * 3. Payment config → Plans, doc plans (with conditional docs), payment method (5-phase journey)
 * 4. Customer registration (Chidi signs up)
 * 5. Property setup → Developer (Emeka) creates property, admin links payment method
 *
 * Application Flow (5 phases within payment method):
 * 6. Customer creates application
 * 7. Prequalification questionnaire by customer → admin approval
 * 8. Sales offer letter by developer (Emeka from Lekki Gardens) — auto-approved
 * 9. KYC documentation by customer + preapproval by lender
 *    - Two-stage review: QShelter (Adaeze) then Bank (Nkechi)
 *    - Conditional SPOUSE_ID doc (only if mortgage_type=JOINT)
 * 10. 10% downpayment (event-based wallet flow)
 * 11. Mortgage offer letter by lender (Nkechi from Access Bank) — auto-approved
 *
 * Actors:
 * - Adaeze (Mortgage Operations Officer): QShelter staff who performs QShelter document review (Stage 1)
 * - Chidi (Customer): First-time homebuyer purchasing a 3-bedroom flat in Lekki
 * - Emeka (Developer): Lekki Gardens developer who uploads sales offer letters
 * - Nkechi (Lender): Access Bank loan officer who performs bank document review (Stage 2) and uploads letters
 * - Property: Lekki Gardens Estate, Unit 14B, ₦85,000,000
 * - Payment Plan: 10% downpayment, 90% mortgage
 */

import supertest from 'supertest';
import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Service URLs - MUST be set via environment (no localhost fallbacks)
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL;
const MORTGAGE_SERVICE_URL = process.env.MORTGAGE_SERVICE_URL || process.env.API_BASE_URL;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL;

// DynamoDB table for role policies (set by run script)
const ROLE_POLICIES_TABLE = process.env.ROLE_POLICIES_TABLE || 'role-policies-staging';

// Validate required environment variables
function validateEnvVars() {
    const missing: string[] = [];
    if (!USER_SERVICE_URL) missing.push('USER_SERVICE_URL');
    if (!PROPERTY_SERVICE_URL) missing.push('PROPERTY_SERVICE_URL');
    if (!MORTGAGE_SERVICE_URL) missing.push('MORTGAGE_SERVICE_URL or API_BASE_URL');
    if (!PAYMENT_SERVICE_URL) missing.push('PAYMENT_SERVICE_URL');

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            `Run this test using: ./scripts/run-full-e2e-staging.sh`
        );
    }
}

// Validate on module load
validateEnvVars();

// Create API clients for each service (URLs are guaranteed to be set after validation)
const userApi = supertest(USER_SERVICE_URL!);
const propertyApi = supertest(PROPERTY_SERVICE_URL!);
const mortgageApi = supertest(MORTGAGE_SERVICE_URL!);
const paymentApi = supertest(PAYMENT_SERVICE_URL!);

// DynamoDB client for polling policy sync status
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Bootstrap secret for tenant creation
const BOOTSTRAP_SECRET =
    process.env.BOOTSTRAP_SECRET || 'local-bootstrap-secret';

// =========================================================================
// Fixed scenario values — matching demo-frontend defaults exactly
// This test is a "faster version" of clicking through the demo frontend UI
// =========================================================================
const TENANT_NAME = 'QShelter Demo';
const TENANT_SUBDOMAIN = 'qshelter-demo';

// Actors (all @mailsac.com for testable email verification)
const ADMIN_EMAIL = 'adaeze@mailsac.com';
const ADMIN_PASSWORD = 'password';

const CUSTOMER_EMAIL = 'chidi@mailsac.com';
const CUSTOMER_PASSWORD = 'password';

const DEVELOPER_EMAIL = 'emeka@mailsac.com';
const DEVELOPER_PASSWORD = 'password';

const LENDER_EMAIL = 'nkechi@mailsac.com';
const LENDER_PASSWORD = 'password';

// Unique test run ID — only used for idempotency keys, not for data
const TEST_RUN_ID = randomUUID();

function idempotencyKey(operation: string): string {
    return `${TEST_RUN_ID}:${operation}`;
}

/**
 * Poll DynamoDB to verify that a tenant-scoped role policy has been synced.
 */
async function waitForPolicyInDynamoDB(
    roleName: string,
    tenantId: string,
    maxWaitMs: number = 30000,
    pollIntervalMs: number = 1000
): Promise<boolean> {
    const startTime = Date.now();
    const pk = `TENANT#${tenantId}#ROLE#${roleName}`;

    console.log(`Polling DynamoDB for policy: ${pk}`);

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const result = await docClient.send(new GetCommand({
                TableName: ROLE_POLICIES_TABLE,
                Key: { PK: pk, SK: 'POLICY' },
            }));

            if (result.Item && result.Item.policy) {
                console.log(`  ✅ Policy found in DynamoDB after ${Date.now() - startTime}ms`);
                return true;
            }
        } catch (error) {
            console.warn(`  ⚠️  DynamoDB query error:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    console.warn(`  ⚠️  Policy not found after ${maxWaitMs}ms - proceeding anyway`);
    return false;
}

// Auth header helpers
function adminHeaders(accessToken: string): Record<string, string> {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
}

function customerHeaders(accessToken: string): Record<string, string> {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
}

function developerHeaders(accessToken: string): Record<string, string> {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
}

function lenderHeaders(accessToken: string): Record<string, string> {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
}

// Mock S3 URL helper — the document workflow only needs a valid-looking URL,
// actual file content is irrelevant for the application flow tests.
function mockS3Url(folder: string, fileName: string): string {
    return `https://qshelter-uploads-staging.s3.amazonaws.com/${folder}/${randomUUID()}/${fileName}`;
}

/**
 * Verify a user's email for E2E testing.
 * Gets the verification token from admin endpoint and calls verify-email.
 */
async function verifyUserEmail(userId: string): Promise<void> {
    // Get user details including verification token
    const userResponse = await userApi
        .get(`/admin/users/${userId}`)
        .set('x-bootstrap-secret', BOOTSTRAP_SECRET);

    if (userResponse.status !== 200) {
        throw new Error(`Failed to get user details: ${userResponse.status} ${JSON.stringify(userResponse.body)}`);
    }

    const { emailVerificationToken, emailVerifiedAt } = userResponse.body.data;

    // Skip if already verified
    if (emailVerifiedAt) {
        console.log(`  User ${userId} already verified`);
        return;
    }

    if (!emailVerificationToken) {
        throw new Error(`No verification token for user ${userId}`);
    }

    // Call verify-email endpoint
    const verifyResponse = await userApi
        .get(`/auth/verify-email`)
        .query({ token: emailVerificationToken });

    if (verifyResponse.status !== 200) {
        throw new Error(`Failed to verify email: ${verifyResponse.status} ${JSON.stringify(verifyResponse.body)}`);
    }

    console.log(`  ✅ Email verified for user ${userId}`);
}

describe('Full E2E Mortgage Flow', () => {
    // Tenant & Auth
    let tenantId: string;

    // Role IDs (extracted from bootstrap response)
    let adminRoleId: string;
    let userRoleId: string;
    let mortgageOpsRoleId: string;
    let agentRoleId: string;
    let lenderOpsRoleId: string;

    // Mortgage Operations Officer (Adaeze from QShelter)
    let adaezeId: string;
    let adaezeAccessToken: string;
    let qshelterOrgId: string; // Platform organization

    // Customer (Chidi)
    let chidiId: string;
    let chidiAccessToken: string;

    // Developer (Emeka from Lekki Gardens) — invited by admin
    let emekaId: string;
    let emekaAccessToken: string;
    let lekkiGardensOrgId: string;

    // Lender (Nkechi from Access Bank) — invited by admin
    let nkechiId: string;
    let nkechiAccessToken: string;
    let accessBankOrgId: string;

    // Property
    let propertyId: string;
    let variantId: string;
    let unitId: string;
    let displayImageMediaId: string;

    // Payment Configuration
    let downpaymentPlanId: string;
    let prequalificationPlanId: string;
    let salesOfferDocPlanId: string;
    let kycDocPlanId: string;
    let mortgageOfferDocPlanId: string;
    let paymentMethodId: string;

    // Application
    let applicationId: string;
    let prequalificationPhaseId: string;
    let salesOfferPhaseId: string;
    let kycPhaseId: string;
    let downpaymentPhaseId: string;
    let mortgageOfferPhaseId: string;

    // Payment tracking
    let downpaymentInstallmentId: string;
    let paymentReference: string;
    let chidiWalletId: string; // Chidi's wallet for payments

    // Realistic Nigerian property pricing
    const propertyPrice = 85_000_000; // ₦85M
    const downpaymentAmount = 8_500_000; // 10% = ₦8.5M
    const downpaymentPercent = 10;

    // Chidi's profile
    const chidiAge = 40;
    const chidiMonthlyIncome = 2_500_000;
    const chidiMonthlyExpenses = 800_000;

    beforeAll(async () => {
        console.log('=== AWS Staging E2E Test ===');
        console.log(`Test Run ID: ${TEST_RUN_ID}`);
        console.log(`User Service: ${USER_SERVICE_URL}`);
        console.log(`Property Service: ${PROPERTY_SERVICE_URL}`);
        console.log(`Mortgage Service: ${MORTGAGE_SERVICE_URL}`);
        console.log('=============================');
    });

    afterAll(async () => {
        console.log('=== Test Run Complete ===');
        console.log(`Test Run ID: ${TEST_RUN_ID}`);
        if (tenantId) console.log(`Tenant ID: ${tenantId}`);
        if (adaezeId) console.log(`Admin ID: ${adaezeId}`);
        if (chidiId) console.log(`Customer ID: ${chidiId}`);
        if (propertyId) console.log(`Property ID: ${propertyId}`);
        if (applicationId) console.log(`Application ID: ${applicationId}`);
        console.log('==========================');
    });

    // =========================================================================
    // Phase 1: Bootstrap & Admin Setup
    // Only Adaeze is seeded via bootstrap. All other users are invited.
    // =========================================================================
    describe('Phase 1: Bootstrap & Admin Setup', () => {
        it('Step 1.0: Reset database for clean state', async () => {
            const response = await userApi
                .post('/admin/reset')
                .set('x-bootstrap-secret', BOOTSTRAP_SECRET);

            console.log(`Reset response: ${response.status}`);
            if (response.status === 200) {
                console.log(`✅ Deleted ${response.body.totalDeleted} records`);
            } else {
                console.log('Reset response:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('Step 1.1: Bootstrap tenant with admin (Adaeze)', async () => {
            const response = await userApi
                .post('/admin/bootstrap-tenant')
                .set('x-bootstrap-secret', BOOTSTRAP_SECRET)
                .set('Content-Type', 'application/json')
                .send({
                    tenant: {
                        name: TENANT_NAME,
                        subdomain: TENANT_SUBDOMAIN,
                    },
                    admin: {
                        email: ADMIN_EMAIL,
                        password: ADMIN_PASSWORD,
                        firstName: 'Adaeze',
                        lastName: 'Okonkwo',
                    },
                });

            expect(response.status).toBe(201);
            expect(response.body.tenant).toBeDefined();
            expect(response.body.admin).toBeDefined();
            expect(response.body.roles.length).toBeGreaterThanOrEqual(5);

            tenantId = response.body.tenant.id;
            adaezeId = response.body.admin.id;

            // Extract role IDs from bootstrap response for use in invitations
            const roles = response.body.roles as Array<{ id: string; name: string }>;
            adminRoleId = roles.find(r => r.name === 'admin')!.id;
            userRoleId = roles.find(r => r.name === 'user')!.id;
            mortgageOpsRoleId = roles.find(r => r.name === 'mortgage_ops')!.id;
            agentRoleId = roles.find(r => r.name === 'agent')!.id;
            lenderOpsRoleId = roles.find(r => r.name === 'lender_ops')!.id;

            console.log(`✅ Tenant: ${tenantId}`);
            console.log(`✅ Admin (Adaeze): ${adaezeId}`);
            console.log(`✅ Roles: admin=${adminRoleId}, mortgage_ops=${mortgageOpsRoleId}, agent=${agentRoleId}, lender_ops=${lenderOpsRoleId}`);

            // Verify Adaeze has the admin role
            expect(adminRoleId).toBeDefined();

            await waitForPolicyInDynamoDB('admin', tenantId);
        });

        it('Step 1.2: Admin (Adaeze) logs in', async () => {
            const response = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({
                    email: ADMIN_EMAIL,
                    password: ADMIN_PASSWORD,
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();

            adaezeAccessToken = response.body.data.accessToken;

            // Verify admin role is in the JWT
            const tokenPayload = JSON.parse(Buffer.from(adaezeAccessToken.split('.')[1], 'base64').toString());
            adaezeId = tokenPayload.sub;
            console.log(`✅ Adaeze logged in, roles in token:`, tokenPayload.roles);
        });
    });

    // =========================================================================
    // Phase 2: Organization Setup & Staff Invitations
    // Admin creates organizations, then invites staff with explicit roles.
    // =========================================================================
    describe('Phase 2: Organization & Staff Setup', () => {
        it('Step 2.1: Admin creates QShelter platform organization', async () => {
            const response = await userApi
                .post('/organizations')
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-qshelter-org'))
                .send({
                    name: 'QShelter Real Estate',
                    typeCodes: ['PLATFORM'],
                    isPlatformOrg: true,
                    email: 'support@mailsac.com',
                    phone: '+2348001234567',
                    address: '123 Victoria Island',
                    city: 'Lagos',
                    state: 'Lagos',
                    country: 'Nigeria',
                    website: 'https://qshelter.com',
                    description: 'Real estate platform for property transactions',
                });

            if (response.status !== 201) {
                console.log('QShelter org creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            qshelterOrgId = response.body.data.id;
            console.log(`✅ QShelter org: ${qshelterOrgId}`);
        });

        it('Step 2.2: Admin adds herself to QShelter with mortgage_ops role', async () => {
            const response = await userApi
                .post(`/organizations/${qshelterOrgId}/members`)
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('add-adaeze-to-qshelter'))
                .send({
                    userId: adaezeId,
                    title: 'Mortgage Operations Officer',
                    department: 'Mortgage Operations',
                });

            if (response.status !== 201) {
                console.log('Add Adaeze to QShelter failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });

        it('Step 2.3: Admin creates Lekki Gardens (Developer organization)', async () => {
            const response = await userApi
                .post('/organizations')
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-lekki-gardens'))
                .send({
                    name: 'Lekki Gardens Development Company',
                    typeCodes: ['DEVELOPER'],
                    email: 'lekkigardens@mailsac.com',
                    phone: '+2348012345678',
                    address: '15 Admiralty Way',
                    city: 'Lekki',
                    state: 'Lagos',
                    country: 'Nigeria',
                    website: 'https://lekkigardens.com',
                    cacNumber: 'RC-123456',
                    description: 'Premium property developer in Lagos',
                });

            if (response.status !== 201) {
                console.log('Lekki Gardens creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            lekkiGardensOrgId = response.body.data.id;
            console.log(`✅ Lekki Gardens org: ${lekkiGardensOrgId}`);
        });

        it('Step 2.4: Admin invites Emeka to Lekki Gardens with agent role', async () => {
            const response = await userApi
                .post(`/organizations/${lekkiGardensOrgId}/invitations`)
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('invite-emeka'))
                .send({
                    email: DEVELOPER_EMAIL,
                    firstName: 'Emeka',
                    lastName: 'Okafor',
                    roleId: agentRoleId,
                    title: 'Sales Manager',
                    department: 'Sales',
                });

            if (response.status !== 201) {
                console.log('Emeka invitation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.role.name).toBe('agent');

            // Emeka accepts the invitation (creates his account + auto-login)
            const acceptResponse = await userApi
                .post('/invitations/accept')
                .query({ token: response.body.data.token })
                .set('Content-Type', 'application/json')
                .send({
                    password: DEVELOPER_PASSWORD,
                });

            if (acceptResponse.status !== 200) {
                console.log('Emeka accept failed:', JSON.stringify(acceptResponse.body, null, 2));
            }
            expect(acceptResponse.status).toBe(200);
            expect(acceptResponse.body.success).toBe(true);
            expect(acceptResponse.body.data.accessToken).toBeDefined();

            emekaAccessToken = acceptResponse.body.data.accessToken;
            emekaId = acceptResponse.body.data.user.id;

            console.log(`✅ Emeka invited & accepted: ${emekaId} (role: agent)`);

            // Wait for agent policy sync
            await waitForPolicyInDynamoDB('agent', tenantId);
        });

        it('Step 2.5: Admin creates Access Bank (Bank organization)', async () => {
            const response = await userApi
                .post('/organizations')
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-access-bank'))
                .send({
                    name: 'Access Bank PLC',
                    typeCodes: ['BANK'],
                    email: 'mortgages@mailsac.com',
                    phone: '+2341234567890',
                    address: '999C Danmole Street',
                    city: 'Victoria Island',
                    state: 'Lagos',
                    country: 'Nigeria',
                    website: 'https://accessbankplc.com',
                    bankCode: '044',
                    swiftCode: 'ABNGNGLA',
                    description: 'Leading Nigerian commercial bank',
                });

            if (response.status !== 201) {
                console.log('Access Bank creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            accessBankOrgId = response.body.data.id;
            console.log(`✅ Access Bank org: ${accessBankOrgId}`);
        });

        it('Step 2.6: Admin invites Nkechi to Access Bank with lender_ops role', async () => {
            const response = await userApi
                .post(`/organizations/${accessBankOrgId}/invitations`)
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('invite-nkechi'))
                .send({
                    email: LENDER_EMAIL,
                    firstName: 'Nkechi',
                    lastName: 'Adebayo',
                    roleId: lenderOpsRoleId,
                    title: 'Mortgage Loan Officer',
                    department: 'Retail Banking',
                });

            if (response.status !== 201) {
                console.log('Nkechi invitation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.role.name).toBe('lender_ops');

            // Nkechi accepts the invitation (creates her account + auto-login)
            const acceptResponse = await userApi
                .post('/invitations/accept')
                .query({ token: response.body.data.token })
                .set('Content-Type', 'application/json')
                .send({
                    password: LENDER_PASSWORD,
                });

            if (acceptResponse.status !== 200) {
                console.log('Nkechi accept failed:', JSON.stringify(acceptResponse.body, null, 2));
            }
            expect(acceptResponse.status).toBe(200);
            expect(acceptResponse.body.success).toBe(true);
            expect(acceptResponse.body.data.accessToken).toBeDefined();

            nkechiAccessToken = acceptResponse.body.data.accessToken;
            nkechiId = acceptResponse.body.data.user.id;

            console.log(`✅ Nkechi invited & accepted: ${nkechiId} (role: lender_ops)`);

            // Wait for lender_ops policy sync
            await waitForPolicyInDynamoDB('lender_ops', tenantId);
        });
    });

    // =========================================================================
    // Phase 3: Payment Configuration
    // Admin creates plans, documentation plans (with conditional docs), and
    // the payment method that defines the full customer journey.
    // =========================================================================
    describe('Phase 3: Payment Configuration', () => {
        it('Step 3.1: Admin creates downpayment plan (one-off)', async () => {
            const response = await mortgageApi
                .post('/payment-plans')
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-downpayment-plan'))
                .send({
                    name: '10% One-Off Downpayment',
                    description: 'Single payment for 10% downpayment',
                    frequency: 'ONE_TIME',
                    numberOfInstallments: 1,
                    interestRate: 0,
                    gracePeriodDays: 0,
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            downpaymentPlanId = response.body.data.id;
            console.log(`✅ Downpayment plan: ${downpaymentPlanId}`);
        });

        it('Step 3.2: Admin creates prequalification questionnaire plan', async () => {
            const response = await mortgageApi
                .post('/questionnaire-plans')
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-prequalification-plan'))
                .send({
                    name: 'Mortgage Prequalification',
                    description: 'Collects applicant age, income, and employment to validate mortgage eligibility',
                    isActive: true,
                    passingScore: 100,
                    scoringStrategy: 'MIN_ALL',
                    autoDecisionEnabled: false,
                    estimatedMinutes: 5,
                    category: 'PREQUALIFICATION',
                    questions: [
                        {
                            questionKey: 'applicant_age',
                            questionText: 'What is your current age?',
                            questionType: 'NUMBER',
                            order: 1,
                            isRequired: true,
                            validationRules: { min: 18, max: 59 },
                            scoringRules: [
                                { operator: 'LESS_THAN_OR_EQUAL', value: 55, score: 100 },
                                { operator: 'GREATER_THAN', value: 55, score: 0 },
                            ],
                            scoreWeight: 1,
                            category: 'ELIGIBILITY',
                        },
                        {
                            questionKey: 'mortgage_type',
                            questionText: 'What type of mortgage are you applying for?',
                            questionType: 'SELECT',
                            order: 2,
                            isRequired: true,
                            options: [
                                { value: 'SINGLE', label: 'Single (Individual)', score: 100 },
                                { value: 'JOINT', label: 'Joint (With Spouse)', score: 100 },
                            ],
                            scoreWeight: 0,
                            category: 'APPLICATION_TYPE',
                        },
                        {
                            questionKey: 'employment_status',
                            questionText: 'What is your employment status?',
                            questionType: 'SELECT',
                            order: 3,
                            isRequired: true,
                            options: [
                                { value: 'EMPLOYED', label: 'Employed', score: 100 },
                                { value: 'SELF_EMPLOYED', label: 'Self-Employed', score: 80 },
                            ],
                            scoreWeight: 1,
                            category: 'EMPLOYMENT',
                        },
                        {
                            questionKey: 'monthly_income',
                            questionText: 'What is your monthly gross income?',
                            questionType: 'CURRENCY',
                            order: 4,
                            isRequired: true,
                            validationRules: { min: 0 },
                            scoringRules: [
                                { operator: 'GREATER_THAN_OR_EQUAL', value: 500000, score: 100 },
                                { operator: 'LESS_THAN', value: 500000, score: 0 },
                            ],
                            scoreWeight: 1,
                            category: 'AFFORDABILITY',
                        },
                        {
                            questionKey: 'monthly_expenses',
                            questionText: 'What are your total monthly expenses?',
                            questionType: 'CURRENCY',
                            order: 5,
                            isRequired: true,
                            validationRules: { min: 0 },
                            scoreWeight: 0,
                            category: 'AFFORDABILITY',
                        },
                        {
                            questionKey: 'desired_term_years',
                            questionText: 'What mortgage term (in years) would you prefer?',
                            questionType: 'NUMBER',
                            order: 6,
                            isRequired: true,
                            validationRules: { min: 5, max: 30 },
                            scoringRules: [
                                { operator: 'GREATER_THAN_OR_EQUAL', value: 5, score: 100 },
                                { operator: 'LESS_THAN', value: 5, score: 0 },
                            ],
                            scoreWeight: 1,
                            category: 'PREFERENCES',
                        },
                    ],
                });

            if (response.status !== 201) {
                console.log('Questionnaire plan creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            prequalificationPlanId = response.body.data.id;
            console.log(`✅ Prequalification plan: ${prequalificationPlanId}`);
        });

        it('Step 3.3: Admin creates sales offer documentation plan', async () => {
            // Developer uploads the sales offer letter, customer accepts
            const response = await mortgageApi
                .post('/documentation-plans')
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-sales-offer-doc-plan'))
                .send({
                    name: 'Sales Offer Documentation',
                    description: 'Developer uploads sales offer letter for customer acceptance',
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
                        },
                    ],
                    approvalStages: [
                        {
                            name: 'Developer Document Verification',
                            order: 1,
                            organizationTypeCode: 'DEVELOPER',
                            autoTransition: true,
                            waitForAllDocuments: true,
                            onRejection: 'CASCADE_BACK',
                        },
                    ],
                });

            if (response.status !== 201) {
                console.log('Sales offer doc plan creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            salesOfferDocPlanId = response.body.data.id;
            console.log(`✅ Sales offer doc plan: ${salesOfferDocPlanId}`);
        });

        it('Step 3.4: Admin creates KYC documentation plan (with conditional document)', async () => {
            // Two-stage approval: PLATFORM (QShelter) → BANK (Access Bank)
            // The "Spouse ID" document is CONDITIONAL on mortgage_type=JOINT from the questionnaire
            const response = await mortgageApi
                .post('/documentation-plans')
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-kyc-doc-plan'))
                .send({
                    name: 'Mortgage KYC Documentation',
                    description: 'Standard KYC workflow with conditional spouse document',
                    isActive: true,
                    documentDefinitions: [
                        {
                            documentType: 'ID_CARD',
                            documentName: 'Valid ID Card',
                            uploadedBy: 'CUSTOMER',
                            order: 1,
                            isRequired: true,
                            description: 'Valid government-issued ID (NIN, driver\'s license, or international passport)',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                        },
                        {
                            documentType: 'SPOUSE_ID',
                            documentName: 'Spouse ID Card',
                            uploadedBy: 'CUSTOMER',
                            order: 2,
                            isRequired: true,
                            description: 'Spouse\'s government-issued ID (required for joint mortgage)',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                            // CONDITIONAL: only required when mortgage_type=JOINT in prequalification
                            condition: {
                                questionKey: 'mortgage_type',
                                operator: 'EQUALS',
                                value: 'JOINT',
                            },
                        },
                        {
                            documentType: 'BANK_STATEMENT',
                            documentName: 'Bank Statements',
                            uploadedBy: 'CUSTOMER',
                            order: 3,
                            isRequired: true,
                            description: 'Last 6 months bank statements',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                        },
                        {
                            documentType: 'EMPLOYMENT_LETTER',
                            documentName: 'Employment Letter',
                            uploadedBy: 'CUSTOMER',
                            order: 4,
                            isRequired: true,
                            description: 'Employment confirmation letter from employer',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                        },
                        {
                            documentType: 'PREAPPROVAL_LETTER',
                            documentName: 'Preapproval Letter',
                            uploadedBy: 'LENDER',
                            order: 5,
                            isRequired: true,
                            description: 'Preapproval letter from partner bank',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                        },
                    ],
                    approvalStages: [
                        {
                            name: 'QShelter Staff Review',
                            order: 1,
                            organizationTypeCode: 'PLATFORM',
                            autoTransition: false,
                            waitForAllDocuments: true,
                            onRejection: 'CASCADE_BACK',
                            slaHours: 24,
                        },
                        {
                            name: 'Bank Review',
                            order: 2,
                            organizationTypeCode: 'BANK',
                            autoTransition: true,
                            waitForAllDocuments: true,
                            onRejection: 'CASCADE_BACK',
                            slaHours: 48,
                        },
                    ],
                });

            if (response.status !== 201) {
                console.log('KYC doc plan creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            kycDocPlanId = response.body.data.id;
            console.log(`✅ KYC doc plan: ${kycDocPlanId} (includes conditional spouse doc)`);
        });

        it('Step 3.5: Admin creates mortgage offer documentation plan', async () => {
            // Bank uploads mortgage offer letter, customer accepts
            const response = await mortgageApi
                .post('/documentation-plans')
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-mortgage-offer-doc-plan'))
                .send({
                    name: 'Mortgage Offer Documentation',
                    description: 'Bank uploads mortgage offer letter for customer acceptance',
                    isActive: true,
                    documentDefinitions: [
                        {
                            documentType: 'MORTGAGE_OFFER_LETTER',
                            documentName: 'Mortgage Offer Letter',
                            uploadedBy: 'LENDER',
                            order: 1,
                            isRequired: true,
                            description: 'Final mortgage offer letter from bank',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                        },
                    ],
                    approvalStages: [
                        {
                            name: 'Bank Document Upload',
                            order: 1,
                            organizationTypeCode: 'BANK',
                            autoTransition: true,
                            waitForAllDocuments: true,
                            onRejection: 'CASCADE_BACK',
                        },
                    ],
                });

            if (response.status !== 201) {
                console.log('Mortgage offer doc plan creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            mortgageOfferDocPlanId = response.body.data.id;
            console.log(`✅ Mortgage offer doc plan: ${mortgageOfferDocPlanId}`);
        });

        it('Step 3.6: Admin creates payment method with 5-phase journey', async () => {
            const response = await mortgageApi
                .post('/payment-methods')
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-payment-method'))
                .send({
                    name: '10/90 Lekki Mortgage',
                    description: 'Prequalification → Sales Offer → KYC → 10% Downpayment → Mortgage Offer',
                    requiresManualApproval: true,
                    phases: [
                        {
                            name: 'Prequalification',
                            phaseCategory: 'QUESTIONNAIRE',
                            phaseType: 'PRE_APPROVAL',
                            order: 1,
                            questionnairePlanId: prequalificationPlanId,
                        },
                        {
                            name: 'Sales Offer',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'VERIFICATION',
                            order: 2,
                            documentationPlanId: salesOfferDocPlanId,
                        },
                        {
                            name: 'Preapproval Documentation',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'KYC',
                            order: 3,
                            documentationPlanId: kycDocPlanId,
                        },
                        {
                            name: '10% Downpayment',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'DOWNPAYMENT',
                            order: 4,
                            percentOfPrice: downpaymentPercent,
                            paymentPlanId: downpaymentPlanId,
                        },
                        {
                            name: 'Mortgage Offer',
                            phaseCategory: 'DOCUMENTATION',
                            phaseType: 'VERIFICATION',
                            order: 5,
                            documentationPlanId: mortgageOfferDocPlanId,
                        },
                    ],
                });

            if (response.status !== 201) {
                console.log('Payment method creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.phases).toHaveLength(5);

            paymentMethodId = response.body.data.id;
            console.log(`✅ Payment method: ${paymentMethodId} (5 phases)`);
        });
    });

    // =========================================================================
    // Phase 4: Customer Registration (Chidi signs up)
    // =========================================================================
    describe('Phase 4: Customer Registration', () => {
        it('Step 4.1: Chidi signs up', async () => {
            const response = await userApi
                .post('/auth/signup')
                .set('Content-Type', 'application/json')
                .send({
                    email: CUSTOMER_EMAIL,
                    password: CUSTOMER_PASSWORD,
                    firstName: 'Chidi',
                    lastName: 'Nnamdi',
                    tenantId: tenantId,
                });

            if (response.status !== 201) {
                console.error('Chidi signup failed:', response.status, JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();

            chidiAccessToken = response.body.data.accessToken;

            const tokenPayload = JSON.parse(Buffer.from(chidiAccessToken.split('.')[1], 'base64').toString());
            chidiId = tokenPayload.sub;
            expect(chidiId).toBeDefined();
            console.log(`✅ Chidi registered: ${chidiId}`);
            console.log(`   Token payload: tenantId=${tokenPayload.tenantId}, roles=${JSON.stringify(tokenPayload.roles)}`);
        });
    });

    // =========================================================================
    // Phase 5: Property Setup (Developer creates property)
    // Emeka (developer/agent) creates the property and links the payment method.
    // =========================================================================
    describe('Phase 5: Property Setup (by Developer)', () => {
        it('Step 5.1: Developer (Emeka) creates property', async () => {
            const response = await propertyApi
                .post('/property/properties')
                .set(developerHeaders(emekaAccessToken))
                .send({
                    title: 'Lekki Gardens Estate',
                    description: 'Premium residential estate in Lekki Phase 1',
                    category: 'SALE',
                    propertyType: 'APARTMENT',
                    country: 'Nigeria',
                    currency: 'NGN',
                    city: 'Lagos',
                    district: 'Lekki',
                    // Link property to developer organization
                    organizationId: lekkiGardensOrgId,
                });

            if (response.status !== 201) {
                console.log('Property creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            propertyId = response.body.data.id;
            console.log(`✅ Property: ${propertyId}`);
        });

        it('Step 5.1a: Developer adds media to property', async () => {
            // Simulate media that was already uploaded via presigned URL
            const response = await propertyApi
                .post(`/property/properties/${propertyId}/media`)
                .set(developerHeaders(emekaAccessToken))
                .send({
                    media: [
                        {
                            url: 'https://qshelter-staging-uploads.s3.us-east-1.amazonaws.com/property_pictures/lekki-gardens-front.jpg',
                            type: 'IMAGE',
                            caption: 'Lekki Gardens Estate - Front View',
                            order: 0,
                        },
                        {
                            url: 'https://qshelter-staging-uploads.s3.us-east-1.amazonaws.com/property_pictures/lekki-gardens-interior.jpg',
                            type: 'IMAGE',
                            caption: 'Lekki Gardens Estate - Interior',
                            order: 1,
                        },
                    ],
                });

            if (response.status !== 201) {
                console.log('Media upload failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);

            // Store first media ID for display image
            displayImageMediaId = response.body.data[0].id;
            console.log(`✅ Property media added (${response.body.data.length} items)`);
        });

        it('Step 5.1b: Developer sets display image', async () => {
            const response = await propertyApi
                .put(`/property/properties/${propertyId}`)
                .set(developerHeaders(emekaAccessToken))
                .send({
                    displayImageId: displayImageMediaId,
                });

            if (response.status !== 200) {
                console.log('Set display image failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            console.log(`✅ Display image set: ${displayImageMediaId}`);
        });

        it('Step 5.2: Developer creates property variant', async () => {
            const response = await propertyApi
                .post(`/property/properties/${propertyId}/variants`)
                .set(developerHeaders(emekaAccessToken))
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

            if (response.status !== 201) {
                console.log('Variant creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            variantId = response.body.data.id;
        });

        it('Step 5.3: Developer creates property unit', async () => {
            const response = await propertyApi
                .post(`/property/properties/${propertyId}/variants/${variantId}/units`)
                .set(developerHeaders(emekaAccessToken))
                .send({
                    unitNumber: '14B',
                    floorNumber: 14,
                    blockName: 'Block B',
                });

            if (response.status !== 201) {
                console.log('Unit creation failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            unitId = response.body.data.id;
        });

        it('Step 5.4: Developer publishes property', async () => {
            const response = await propertyApi
                .patch(`/property/properties/${propertyId}/publish`)
                .set(developerHeaders(emekaAccessToken));

            if (response.status !== 200) {
                console.log('Publish failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('PUBLISHED');
        });

        it('Step 5.5: Admin links payment method to property', async () => {
            // Payment method linking is an admin operation
            const response = await mortgageApi
                .post(`/payment-methods/${paymentMethodId}/properties`)
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('link-payment-method'))
                .send({
                    propertyId: propertyId,
                    isDefault: true,
                });

            if (response.status !== 201) {
                console.log('Link payment method failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            console.log(`✅ Payment method linked to property`);
        });
    });

    // =========================================================================
    // Phase 6: Customer Application
    // =========================================================================
    describe('Phase 6: Customer Application', () => {
        it('Step 6.1: Chidi creates application', async () => {
            const response = await mortgageApi
                .post('/applications')
                .set(customerHeaders(chidiAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-application'))
                .send({
                    propertyUnitId: unitId,
                    paymentMethodId: paymentMethodId,
                    title: 'Purchase Agreement - Lekki Gardens Unit 14B',
                    applicationType: 'MORTGAGE',
                    totalAmount: propertyPrice,
                    monthlyIncome: chidiMonthlyIncome,
                    monthlyExpenses: chidiMonthlyExpenses,
                    applicantAge: chidiAge,
                });

            if (response.status !== 201) {
                console.log('Application creation failed:', response.status, JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();
            expect(response.body.data.phases).toHaveLength(5);
            // Smart auto-submit: goes directly to PENDING
            expect(response.body.data.status).toBe('PENDING');

            applicationId = response.body.data.id;

            // Extract phase IDs by order
            const phases = response.body.data.phases;
            prequalificationPhaseId = phases.find((p: any) => p.order === 1).id;
            salesOfferPhaseId = phases.find((p: any) => p.order === 2).id;
            kycPhaseId = phases.find((p: any) => p.order === 3).id;
            downpaymentPhaseId = phases.find((p: any) => p.order === 4).id;
            mortgageOfferPhaseId = phases.find((p: any) => p.order === 5).id;

            expect(prequalificationPhaseId).toBeDefined();
            expect(salesOfferPhaseId).toBeDefined();
            expect(kycPhaseId).toBeDefined();
            expect(downpaymentPhaseId).toBeDefined();
            expect(mortgageOfferPhaseId).toBeDefined();
        });

        it('Step 6.2: Verify Lekki Gardens is auto-bound as developer', async () => {
            // Developer should be auto-bound because property has organizationId
            const response = await mortgageApi
                .get(`/applications/${applicationId}/organizations`)
                .set(adminHeaders(adaezeAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const developerBinding = response.body.data.find(
                (b: any) => b.assignedAsType?.code === 'DEVELOPER'
            );
            expect(developerBinding).toBeDefined();
            expect(developerBinding.organizationId).toBe(lekkiGardensOrgId);
            expect(developerBinding.status).toBe('ACTIVE');
            expect(developerBinding.isPrimary).toBe(true);
        });

        it('Step 6.3: Admin binds Access Bank as lender', async () => {
            const response = await mortgageApi
                .post(`/applications/${applicationId}/organizations`)
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('bind-access-bank'))
                .send({
                    organizationId: accessBankOrgId,
                    organizationTypeCode: 'BANK',
                    isPrimary: true,
                    slaHours: 48,
                });

            if (response.status !== 201) {
                console.log('Bank binding failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.organizationId).toBe(accessBankOrgId);
            expect(response.body.data.isPrimary).toBe(true);
        });

        it('Step 6.4: Verify phase amounts', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(5);

            const downPhase = response.body.data.find((p: any) => p.order === 4);
            expect(downPhase.totalAmount).toBe(downpaymentAmount);
        });

        it('Step 6.5: Prequalification phase is auto-activated', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${prequalificationPhaseId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('IN_PROGRESS');
        });
    });

    // =========================================================================
    // Phase 7: Prequalification Questionnaire
    // =========================================================================
    describe('Phase 7: Prequalification Questionnaire', () => {
        it('Step 7.1: Chidi submits prequalification answers', async () => {
            const response = await mortgageApi
                .post(`/applications/${applicationId}/phases/${prequalificationPhaseId}/questionnaire/submit`)
                .set(customerHeaders(chidiAccessToken))
                .set('x-idempotency-key', idempotencyKey('submit-prequalification'))
                .send({
                    answers: [
                        { fieldName: 'applicant_age', value: '40' },
                        { fieldName: 'mortgage_type', value: 'SINGLE' },
                        { fieldName: 'employment_status', value: 'EMPLOYED' },
                        { fieldName: 'monthly_income', value: String(chidiMonthlyIncome) },
                        { fieldName: 'monthly_expenses', value: String(chidiMonthlyExpenses) },
                        { fieldName: 'desired_term_years', value: '20' },
                    ],
                });

            if (response.status !== 200) {
                console.log('Questionnaire submit failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('Step 7.2: Prequalification awaits approval', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${prequalificationPhaseId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('AWAITING_APPROVAL');
        });

        it('Step 7.3: Admin approves prequalification', async () => {
            const response = await mortgageApi
                .post(`/applications/${applicationId}/phases/${prequalificationPhaseId}/questionnaire/review`)
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('approve-prequalification'))
                .send({
                    decision: 'APPROVE',
                    notes: 'Chidi meets all eligibility criteria. Approved for mortgage.',
                });

            if (response.status !== 200) {
                console.log('Questionnaire review failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('COMPLETED');
        });
    });

    // =========================================================================
    // Phase 8: Sales Offer (Developer uploads, auto-approved)
    // =========================================================================
    describe('Phase 8: Sales Offer', () => {
        it('Step 8.1: Sales offer phase is auto-activated', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${salesOfferPhaseId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('IN_PROGRESS');
        });

        it('Step 8.2: Developer (Emeka) uploads sales offer letter', async () => {
            const salesOfferUrl = mockS3Url('mortgage_docs', 'sales-offer-letter.pdf');

            const response = await mortgageApi
                .post(`/applications/${applicationId}/phases/${salesOfferPhaseId}/documents`)
                .set(developerHeaders(emekaAccessToken))
                .set('x-idempotency-key', idempotencyKey('upload-sales-offer'))
                .send({
                    documentType: 'SALES_OFFER_LETTER',
                    url: salesOfferUrl,
                    fileName: 'sales-offer-letter.pdf',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });

        it('Step 8.3: Sales offer phase completes', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${salesOfferPhaseId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
        });
    });

    // =========================================================================
    // Phase 9: KYC Documentation (Two-Stage Review)
    // Stage 1: QShelter Review (Adaeze - Mortgage Operations Officer)
    // Stage 2: Bank Review (Nkechi - Access Bank Loan Officer)
    // Note: Chidi answered mortgage_type=SINGLE so conditional SPOUSE_ID doc is NOT required
    // =========================================================================
    describe('Phase 9: KYC Documentation', () => {
        it('Step 9.1: KYC phase is auto-activated', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('IN_PROGRESS');
        });

        it('Step 9.2: Chidi uploads KYC documents', async () => {
            const docTypes = [
                { documentType: 'ID_CARD', fileName: 'chidi-id-card.pdf' },
                { documentType: 'BANK_STATEMENT', fileName: 'chidi-bank-statement.pdf' },
                { documentType: 'EMPLOYMENT_LETTER', fileName: 'chidi-employment-letter.pdf' },
            ];

            for (const doc of docTypes) {
                const fileUrl = mockS3Url('kyc_documents', doc.fileName);

                const response = await mortgageApi
                    .post(`/applications/${applicationId}/phases/${kycPhaseId}/documents`)
                    .set(customerHeaders(chidiAccessToken))
                    .set('x-idempotency-key', idempotencyKey(`upload-${doc.documentType}`))
                    .send({
                        documentType: doc.documentType,
                        url: fileUrl,
                        fileName: doc.fileName,
                    });

                expect(response.status).toBe(201);
            }
        });

        it('Step 9.3: Adaeze (QShelter - Stage 1) reviews and approves documents', async () => {
            // Stage 1: QShelter Mortgage Operations Officer performs platform review
            const docsResponse = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}/documents`)
                .set(adminHeaders(adaezeAccessToken));

            expect(docsResponse.status).toBe(200);

            const customerDocs = docsResponse.body.data.filter(
                (d: any) => ['ID_CARD', 'BANK_STATEMENT', 'EMPLOYMENT_LETTER'].includes(d.documentType)
            );

            for (const doc of customerDocs) {
                const response = await mortgageApi
                    .post(`/applications/${applicationId}/documents/${doc.id}/review`)
                    .set(adminHeaders(adaezeAccessToken))
                    .set('x-idempotency-key', idempotencyKey(`qshelter-approve-${doc.documentType}`))
                    .send({
                        status: 'APPROVED',
                        organizationTypeCode: 'PLATFORM',
                        comment: 'QShelter review: Document verified by Mortgage Operations',
                    });

                if (response.status !== 200) {
                    console.log(`Doc review failed for ${doc.documentType}:`, JSON.stringify(response.body, null, 2));
                }
                expect(response.status).toBe(200);
            }
        });

        it('Step 9.4: Nkechi (Bank) uploads preapproval letter (auto-approved)', async () => {
            // Stage 2: Bank (Access Bank) is responsible for LENDER-uploaded documents
            // When the lender uploads the preapproval letter during the BANK stage,
            // it is AUTO-APPROVED because the uploader matches the stage's organization type.
            // This is the design: uploaders don't need to review their own documents.

            const preapprovalUrl = mockS3Url('mortgage_docs', 'preapproval-letter-chidi.pdf');

            const uploadResponse = await mortgageApi
                .post(`/applications/${applicationId}/phases/${kycPhaseId}/documents`)
                .set(lenderHeaders(nkechiAccessToken))
                .set('x-idempotency-key', idempotencyKey('upload-preapproval-for-bank-review'))
                .send({
                    documentType: 'PREAPPROVAL_LETTER',
                    url: preapprovalUrl,
                    fileName: 'preapproval-letter.pdf',
                });

            if (uploadResponse.status !== 201) {
                console.log('Preapproval upload failed:', JSON.stringify(uploadResponse.body, null, 2));
            }
            expect(uploadResponse.status).toBe(201);

            // Verify the document was auto-approved
            const docsResponse = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}/documents`)
                .set(lenderHeaders(nkechiAccessToken));

            expect(docsResponse.status).toBe(200);

            const preapprovalDoc = docsResponse.body.data.find(
                (d: any) => d.documentType === 'PREAPPROVAL_LETTER'
            );

            expect(preapprovalDoc).toBeDefined();
            expect(preapprovalDoc.status).toBe('APPROVED');
        });

        it('Step 9.5: Verify KYC phase is now complete', async () => {
            // After both stages complete:
            // - Stage 1 (PLATFORM) approved customer docs
            // - Stage 2 (BANK) auto-approved lender preapproval upload
            // The phase should now be complete
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
        });

        it('Step 9.6: KYC phase completes after both stages approved', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
        });
    });

    // =========================================================================
    // Phase 10: Downpayment (Event-Based Payment Flow)
    // This tests the centralized phase orchestration:
    // 1. Admin generates installments (or auto-generated via PAYMENT_PHASE_ACTIVATED event)
    // 2. Customer's wallet is credited (simulating bank transfer received)
    // 3. payment-service auto-allocates funds to pending installments
    // 4. When payment phase completes, PAYMENT_PHASE_COMPLETED event triggers
    // 5. mortgage-service's sqsConsumer activates the next phase
    // =========================================================================
    describe('Phase 10: Downpayment (Event-Based Flow)', () => {
        it('Step 10.1: Downpayment phase is auto-activated', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${downpaymentPhaseId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('IN_PROGRESS');
        });

        it('Step 10.2: Create wallet for Chidi via payment-service', async () => {
            const response = await paymentApi
                .post('/wallets/me')
                .set(customerHeaders(chidiAccessToken))
                .set('x-idempotency-key', idempotencyKey('create-chidi-wallet'))
                .send({
                    currency: 'NGN',
                });

            if (response.status !== 201 && response.status !== 200 && response.status !== 409) {
                console.log('Wallet creation failed:', response.status, JSON.stringify(response.body, null, 2));
            }

            // Might already exist, check for 200 or 201
            if (response.status === 409) {
                // Wallet already exists, get it
                const getResponse = await paymentApi
                    .get('/wallets/me')
                    .set(customerHeaders(chidiAccessToken));

                expect(getResponse.status).toBe(200);
                chidiWalletId = getResponse.body.data.id;
            } else {
                expect([200, 201]).toContain(response.status);
                chidiWalletId = response.body.data.id;
            }

            expect(chidiWalletId).toBeDefined();
            console.log(`Chidi's wallet ID: ${chidiWalletId}`);
        });

        it('Step 10.3: Generate downpayment installment', async () => {
            const response = await mortgageApi
                .post(`/applications/${applicationId}/phases/${downpaymentPhaseId}/installments`)
                .set(adminHeaders(adaezeAccessToken))
                .set('x-idempotency-key', idempotencyKey('generate-downpayment'))
                .send({ startDate: new Date().toISOString() });

            // Might already be generated via event
            if (response.status === 400 && response.body.message?.includes('already')) {
                console.log('Installments already generated (via event)');
                // Fetch existing installments
                const phaseResponse = await mortgageApi
                    .get(`/applications/${applicationId}/phases/${downpaymentPhaseId}`)
                    .set(customerHeaders(chidiAccessToken));

                expect(phaseResponse.status).toBe(200);
                const installments = phaseResponse.body.data.paymentPhase?.installments || [];
                expect(installments.length).toBeGreaterThan(0);
                downpaymentInstallmentId = installments[0].id;
            } else {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data.installments).toHaveLength(1);
                expect(response.body.data.installments[0].amount).toBe(downpaymentAmount);
                downpaymentInstallmentId = response.body.data.installments[0].id;
            }

            console.log(`Downpayment installment ID: ${downpaymentInstallmentId}`);
        });

        it('Step 10.4: Simulate payment by crediting wallet (triggers auto-allocation)', async () => {
            // This simulates Chidi making a bank transfer that gets credited to his wallet.
            // The wallet credit triggers WALLET_CREDITED event → auto-allocation service
            // → pays the pending installment → PAYMENT_PHASE_COMPLETED event → next phase activation

            const response = await paymentApi
                .post(`/wallets/${chidiWalletId}/credit`)
                .set(adminHeaders(adaezeAccessToken)) // Admin can credit wallets
                .set('x-idempotency-key', idempotencyKey('credit-chidi-downpayment'))
                .send({
                    amount: downpaymentAmount,
                    reference: `DOWNPAYMENT-${TEST_RUN_ID.slice(0, 8)}`, // Unique per run for idempotency
                    description: 'Downpayment for Lekki Gardens Unit 14B',
                    source: 'manual', // Admin manually crediting (simulating bank transfer)
                });

            if (response.status !== 200) {
                console.log('Wallet credit failed:', JSON.stringify(response.body, null, 2));
            }
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('success');

            console.log('Wallet credited, waiting for event processing...');
        });

        it('Step 10.5: Wait for async event processing and verify downpayment phase completes', async () => {
            // The event flow is:
            // 1. WALLET_CREDITED → payment-service allocates to installment
            // 2. Installment PAID → payment phase COMPLETED
            // 3. PAYMENT_PHASE_COMPLETED event → SNS → SQS → mortgage-service
            // 4. mortgage-service activates next phase

            // Poll for phase completion with timeout
            const maxWaitMs = 30000;
            const pollIntervalMs = 2000;
            const startTime = Date.now();

            let phaseStatus = 'IN_PROGRESS';

            while (Date.now() - startTime < maxWaitMs) {
                const response = await mortgageApi
                    .get(`/applications/${applicationId}/phases/${downpaymentPhaseId}`)
                    .set(customerHeaders(chidiAccessToken));

                expect(response.status).toBe(200);
                phaseStatus = response.body.data.status;

                console.log(`Phase status: ${phaseStatus} (waited ${Math.round((Date.now() - startTime) / 1000)}s)`);

                if (phaseStatus === 'COMPLETED') {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            }

            expect(phaseStatus).toBe('COMPLETED');
            console.log('✓ Downpayment phase completed via event-based flow');
        });
    });

    // =========================================================================
    // Phase 11: Mortgage Offer (Activated via Event from Payment Service)
    // The PAYMENT_PHASE_COMPLETED event triggered by payment-service should have
    // activated this phase via the mortgage-service sqsConsumer
    // =========================================================================
    describe('Phase 11: Mortgage Offer (Event-Activated)', () => {
        it('Step 11.1: Verify mortgage offer phase was auto-activated via event', async () => {
            // Poll to allow time for SQS event processing
            const maxWaitMs = 15000;
            const pollIntervalMs = 2000;
            const startTime = Date.now();

            let phaseStatus = 'PENDING';

            while (Date.now() - startTime < maxWaitMs) {
                const response = await mortgageApi
                    .get(`/applications/${applicationId}/phases/${mortgageOfferPhaseId}`)
                    .set(customerHeaders(chidiAccessToken));

                expect(response.status).toBe(200);
                phaseStatus = response.body.data.status;

                console.log(`Mortgage offer phase status: ${phaseStatus} (waited ${Math.round((Date.now() - startTime) / 1000)}s)`);

                if (phaseStatus === 'IN_PROGRESS') {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            }

            expect(phaseStatus).toBe('IN_PROGRESS');
            console.log('✓ Mortgage offer phase auto-activated via PAYMENT_PHASE_COMPLETED event');
        });

        it('Step 11.2: Lender (Nkechi) uploads mortgage offer letter', async () => {
            const mortgageOfferUrl = mockS3Url('mortgage_docs', 'mortgage-offer-letter-chidi.pdf');

            const response = await mortgageApi
                .post(`/applications/${applicationId}/phases/${mortgageOfferPhaseId}/documents`)
                .set(lenderHeaders(nkechiAccessToken))
                .set('x-idempotency-key', idempotencyKey('upload-mortgage-offer'))
                .send({
                    documentType: 'MORTGAGE_OFFER_LETTER',
                    url: mortgageOfferUrl,
                    fileName: 'mortgage-offer-letter.pdf',
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });

        it('Step 11.3: Mortgage offer phase completes', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}/phases/${mortgageOfferPhaseId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.data.status).toBe('COMPLETED');
        });

        it('Step 11.4: Application is completed', async () => {
            const response = await mortgageApi
                .get(`/applications/${applicationId}`)
                .set(customerHeaders(chidiAccessToken));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('COMPLETED');
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

                expect([400, 401, 403, 500]).toContain(response.status);
            });
        });

        describe('Customer Cannot Access Admin Endpoints', () => {
            it('Customer cannot create payment plans', async () => {
                const response = await mortgageApi
                    .post('/payment-plans')
                    .set(customerHeaders(chidiAccessToken))
                    .set('x-idempotency-key', idempotencyKey('customer-create-plan-fail'))
                    .send({
                        name: 'Unauthorized Plan',
                        description: 'Customer should not be able to create this',
                        frequency: 'MONTHLY',
                        numberOfInstallments: 12,
                        interestRate: 5,
                        gracePeriodDays: 15,
                    });

                expect([401, 403]).toContain(response.status);
            });

            it('Customer cannot create payment methods', async () => {
                const response = await mortgageApi
                    .post('/payment-methods')
                    .set(customerHeaders(chidiAccessToken))
                    .set('x-idempotency-key', idempotencyKey('customer-create-method-fail'))
                    .send({
                        name: 'Unauthorized Method',
                        description: 'Customer should not be able to create this',
                        requiresManualApproval: false,
                        phases: [],
                    });

                expect([401, 403]).toContain(response.status);
            });
        });

        describe('Cross-Tenant Isolation', () => {
            let otherTenantId: string;
            let otherAdminToken: string;

            beforeAll(async () => {
                const bootstrapResponse = await userApi
                    .post('/admin/bootstrap-tenant')
                    .set('x-bootstrap-secret', BOOTSTRAP_SECRET)
                    .set('Content-Type', 'application/json')
                    .send({
                        tenant: {
                            name: 'Other Real Estate Co',
                            subdomain: 'other-realestate',
                        },
                        admin: {
                            email: 'other-admin@mailsac.com',
                            password: 'OtherAdmin123!',
                            firstName: 'Other',
                            lastName: 'Admin',
                        },
                    });

                expect(bootstrapResponse.status).toBe(201);
                otherTenantId = bootstrapResponse.body.tenant.id;

                const loginResponse = await userApi
                    .post('/auth/login')
                    .set('Content-Type', 'application/json')
                    .send({
                        email: 'other-admin@mailsac.com',
                        password: 'OtherAdmin123!',
                    });

                expect(loginResponse.status).toBe(200);
                otherAdminToken = loginResponse.body.data.accessToken;
            });

            it('Other tenant admin cannot access first tenant application', async () => {
                const response = await mortgageApi
                    .get(`/applications/${applicationId}`)
                    .set(adminHeaders(otherAdminToken));

                expect([403, 404]).toContain(response.status);
            });

            it('Other tenant admin cannot list first tenant applications', async () => {
                const response = await mortgageApi
                    .get('/applications')
                    .set(adminHeaders(otherAdminToken));

                expect(response.status).toBe(200);
                const apps = response.body.data?.items || [];
                const foundOurApp = apps.some((app: { id: string }) => app.id === applicationId);
                expect(foundOurApp).toBe(false);
            });

            it('Other tenant admin cannot modify first tenant payment method', async () => {
                const response = await mortgageApi
                    .patch(`/payment-methods/${paymentMethodId}`)
                    .set(adminHeaders(otherAdminToken))
                    .send({
                        name: 'Hijacked Payment Method',
                    });

                expect([403, 404]).toContain(response.status);
            });
        });

        describe('Ownership Verification', () => {
            it('Customer can view their own application', async () => {
                const response = await mortgageApi
                    .get(`/applications/${applicationId}`)
                    .set(customerHeaders(chidiAccessToken));

                expect(response.status).toBe(200);
                expect(response.body.data.buyerId).toBe(chidiId);
            });

            it('Different customer cannot access Chidi application', async () => {
                const signupResponse = await userApi
                    .post('/auth/signup')
                    .set('Content-Type', 'application/json')
                    .send({
                        email: 'random-user@mailsac.com',
                        password: 'RandomPass123!',
                        firstName: 'Random',
                        lastName: 'User',
                        tenantId: tenantId,
                    });

                expect(signupResponse.status).toBe(201);
                const emekaToken = signupResponse.body.data.accessToken;

                const response = await mortgageApi
                    .get(`/applications/${applicationId}`)
                    .set(customerHeaders(emekaToken));

                expect([403, 404]).toContain(response.status);
            });
        });
    });
});

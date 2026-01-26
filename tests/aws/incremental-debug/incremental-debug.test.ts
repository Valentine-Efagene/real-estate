/**
 * Incremental Debug Test (AWS Staging)
 *
 * This test mirrors the Postman collection flow step-by-step.
 * Use it to debug issues with the API flow before running in Postman.
 *
 * Each test is independent and can be run in isolation using Jest's focused tests.
 * The tests are designed to be run sequentially to build up state.
 *
 * Prerequisites:
 * - All services deployed to AWS staging
 * - Bootstrap secret configured in SSM
 *
 * Run with:
 *   npm run test:incremental
 *
 * Run specific steps with Jest's focused tests:
 *   npm run test:incremental -- --testNamePattern="Step 1.1"
 *
 * Flow mirrors Postman collection:
 * 1. Reset Database (clear all data)
 * 2. Bootstrap Tenant (create tenant, roles, admin)
 * 3. Admin Login
 * 4. Create Organizations (Access Bank, Lekki Gardens)
 * 5. Create Organization Members (Nkechi, Emeka)
 * 6. Create Property, Variant, Units
 * 7. Create Payment Plans & Methods
 * 8. Customer Signup (Chidi)
 * 9. Create Application
 * ... (continue as needed)
 */

import supertest from 'supertest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Service URLs - MUST be set via environment
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL;
const MORTGAGE_SERVICE_URL = process.env.MORTGAGE_SERVICE_URL;

// Bootstrap secret for protected endpoints
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET || 'local-bootstrap-secret';

// DynamoDB table for role policies
const ROLE_POLICIES_TABLE = process.env.ROLE_POLICIES_TABLE || 'role-policies-staging';

// Validate required environment variables
function validateEnvVars() {
    const missing: string[] = [];
    if (!USER_SERVICE_URL) missing.push('USER_SERVICE_URL');
    if (!PROPERTY_SERVICE_URL) missing.push('PROPERTY_SERVICE_URL');
    if (!MORTGAGE_SERVICE_URL) missing.push('MORTGAGE_SERVICE_URL');

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            `Run this test using: ./scripts/run-incremental-debug.sh`
        );
    }
}

validateEnvVars();

// API clients
const userApi = supertest(USER_SERVICE_URL!);
const propertyApi = supertest(PROPERTY_SERVICE_URL!);
const mortgageApi = supertest(MORTGAGE_SERVICE_URL!);

// DynamoDB client for verifying policy sync
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// =============================================================================
// SHARED STATE (accumulated across tests)
// =============================================================================

interface TestState {
    // Tenant & Auth
    tenantId?: string;
    bootstrapSecret: string;

    // Admin (Adaeze)
    adminId?: string;
    adminEmail: string;
    adminPassword: string;
    adminAccessToken?: string;

    // Customer (Chidi)
    customerId?: string;
    customerEmail: string;
    customerPassword: string;
    customerAccessToken?: string;

    // Developer (Emeka from Lekki Gardens)
    developerId?: string;
    developerEmail: string;
    developerPassword: string;
    developerAccessToken?: string;
    developerOrgId?: string;
    developerMembershipId?: string;

    // Lender (Nkechi from Access Bank)
    lenderId?: string;
    lenderEmail: string;
    lenderPassword: string;
    lenderAccessToken?: string;
    lenderOrgId?: string;
    lenderMembershipId?: string;

    // Property
    propertyId?: string;
    variantId?: string;
    unitId?: string;

    // Payment Configuration
    downpaymentPlanId?: string;
    mortgagePlanId?: string;
    prequalificationPlanId?: string;
    salesOfferDocPlanId?: string;
    kycDocPlanId?: string;
    mortgageOfferDocPlanId?: string;
    paymentMethodId?: string;

    // Application
    applicationId?: string;
}

// Use fixed values matching Chidi-Lekki scenario (with mailsac.com emails for testing)
const state: TestState = {
    bootstrapSecret: BOOTSTRAP_SECRET,

    // Admin
    adminEmail: 'adaeze@mailsac.com',
    adminPassword: 'SecureAdmin123!',

    // Customer
    customerEmail: 'chidi@mailsac.com',
    customerPassword: 'CustomerPass123!',

    // Developer
    developerEmail: 'emeka@mailsac.com',
    developerPassword: 'DeveloperPass123!',

    // Lender
    lenderEmail: 'nkechi@mailsac.com',
    lenderPassword: 'LenderPass123!',
};

// Property pricing (Chidi-Lekki scenario)
const PROPERTY_PRICE = 85_000_000; // ₦85M
const DOWNPAYMENT_PERCENT = 10;
const DOWNPAYMENT_AMOUNT = PROPERTY_PRICE * DOWNPAYMENT_PERCENT / 100; // ₦8.5M

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function authHeaders(accessToken: string): Record<string, string> {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
}

function bootstrapHeaders(): Record<string, string> {
    return {
        'x-bootstrap-secret': state.bootstrapSecret,
        'Content-Type': 'application/json',
    };
}

async function waitForPolicyInDynamoDB(
    roleName: string,
    tenantId: string,
    maxWaitMs: number = 30000,
    pollIntervalMs: number = 1000
): Promise<boolean> {
    const startTime = Date.now();
    const pk = `TENANT#${tenantId}#ROLE#${roleName}`;

    console.log(`  Polling DynamoDB for policy: ${pk}`);

    while (Date.now() - startTime < maxWaitMs) {
        try {
            const result = await docClient.send(new GetCommand({
                TableName: ROLE_POLICIES_TABLE,
                Key: { PK: pk, SK: 'POLICY' },
            }));

            if (result.Item && result.Item.policy) {
                console.log(`  ✅ Policy found after ${Date.now() - startTime}ms`);
                return true;
            }
        } catch (error) {
            // Ignore errors, keep polling
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    console.warn(`  ⚠️  Policy not found after ${maxWaitMs}ms`);
    return false;
}

async function verifyUserEmail(userId: string): Promise<void> {
    // Get user details including verification token
    const userResponse = await userApi
        .get(`/admin/users/${userId}`)
        .set('x-bootstrap-secret', state.bootstrapSecret);

    if (userResponse.status !== 200) {
        throw new Error(`Failed to get user details: ${userResponse.status}`);
    }

    const { emailVerificationToken, emailVerifiedAt } = userResponse.body.data;

    if (emailVerifiedAt) {
        console.log(`  User already verified`);
        return;
    }

    if (!emailVerificationToken) {
        throw new Error(`No verification token for user ${userId}`);
    }

    const verifyResponse = await userApi
        .get(`/auth/verify-email`)
        .query({ token: emailVerificationToken });

    if (verifyResponse.status !== 200) {
        throw new Error(`Failed to verify email: ${verifyResponse.status}`);
    }

    console.log(`  ✅ Email verified`);
}

// =============================================================================
// TESTS
// =============================================================================

describe('Incremental Debug Flow', () => {

    beforeAll(() => {
        console.log('\n=== Incremental Debug Test ===');
        console.log(`User Service: ${USER_SERVICE_URL}`);
        console.log(`Property Service: ${PROPERTY_SERVICE_URL}`);
        console.log(`Mortgage Service: ${MORTGAGE_SERVICE_URL}`);
        console.log('================================\n');
    });

    afterAll(() => {
        console.log('\n=== Final State ===');
        console.log(JSON.stringify({
            tenantId: state.tenantId,
            adminId: state.adminId,
            customerId: state.customerId,
            developerOrgId: state.developerOrgId,
            lenderOrgId: state.lenderOrgId,
            propertyId: state.propertyId,
            applicationId: state.applicationId,
        }, null, 2));
        console.log('====================\n');
    });

    // =========================================================================
    // STEP 1: Reset & Bootstrap
    // =========================================================================
    describe('Step 1: Reset & Bootstrap', () => {

        it('Step 1.1: Reset database', async () => {
            console.log('\n--- Step 1.1: Reset Database ---');

            const response = await userApi
                .post('/admin/reset')
                .set('x-bootstrap-secret', state.bootstrapSecret);

            console.log(`Response: ${response.status}`);
            console.log(JSON.stringify(response.body, null, 2));

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Database reset complete');

            console.log(`✅ Deleted ${response.body.totalDeleted} records`);
        });

        it('Step 1.2: Bootstrap tenant with roles and admin', async () => {
            console.log('\n--- Step 1.2: Bootstrap Tenant ---');

            const response = await userApi
                .post('/admin/bootstrap-tenant')
                .set(bootstrapHeaders())
                .send({
                    tenant: {
                        name: 'QShelter Real Estate',
                        subdomain: 'qshelter',
                    },
                    admin: {
                        email: state.adminEmail,
                        password: state.adminPassword,
                        firstName: 'Adaeze',
                        lastName: 'Okonkwo',
                    },
                });

            console.log(`Response: ${response.status}`);
            console.log(JSON.stringify(response.body, null, 2));

            expect(response.status).toBe(201);
            expect(response.body.tenant).toBeDefined();
            expect(response.body.admin).toBeDefined();
            expect(response.body.roles.length).toBeGreaterThanOrEqual(5);

            state.tenantId = response.body.tenant.id;
            state.adminId = response.body.admin.id;

            console.log(`✅ Tenant: ${state.tenantId}`);
            console.log(`✅ Admin: ${state.adminId}`);

            // Wait for admin role policy to sync to DynamoDB
            await waitForPolicyInDynamoDB('admin', state.tenantId!);
        });
    });

    // =========================================================================
    // STEP 2: Admin Login
    // =========================================================================
    describe('Step 2: Admin Login', () => {

        it('Step 2.1: Admin (Adaeze) logs in', async () => {
            console.log('\n--- Step 2.1: Admin Login ---');

            const response = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({
                    email: state.adminEmail,
                    password: state.adminPassword,
                });

            console.log(`Response: ${response.status}`);
            if (response.status !== 200) {
                console.log(JSON.stringify(response.body, null, 2));
            }

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();

            state.adminAccessToken = response.body.data.accessToken;

            console.log(`✅ Got access token (${state.adminAccessToken!.substring(0, 20)}...)`);
        });
    });

    // =========================================================================
    // STEP 3: Create Organizations
    // =========================================================================
    describe('Step 3: Create Organizations', () => {

        it('Step 3.1: Create Access Bank (BANK organization)', async () => {
            console.log('\n--- Step 3.1: Create Access Bank ---');

            expect(state.adminAccessToken).toBeDefined();

            const response = await userApi
                .post('/organizations')
                .set(authHeaders(state.adminAccessToken!))
                .send({
                    name: 'Access Bank PLC',
                    typeCodes: ['BANK'],
                    email: 'mortgages@mailsac.com',
                    phone: '+234-1-280-2800',
                    address: '999c Danmole Street, Victoria Island, Lagos',
                    bankCode: '044',
                    cacNumber: '',  // Empty string - should be normalized to null
                    swiftCode: '',  // Empty string - should be normalized to null
                });

            console.log(`Response: ${response.status}`);
            console.log(JSON.stringify(response.body, null, 2));

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            state.lenderOrgId = response.body.data.id;

            console.log(`✅ Access Bank Org ID: ${state.lenderOrgId}`);
        });

        it('Step 3.2: Create Lekki Gardens (DEVELOPER organization)', async () => {
            console.log('\n--- Step 3.2: Create Lekki Gardens ---');

            expect(state.adminAccessToken).toBeDefined();

            const response = await userApi
                .post('/organizations')
                .set(authHeaders(state.adminAccessToken!))
                .send({
                    name: 'Lekki Gardens Estate Limited',
                    typeCodes: ['DEVELOPER'],
                    email: 'lekkigardens@mailsac.com',
                    phone: '+234-1-453-0000',
                    address: 'Lekki-Epe Expressway, Lekki, Lagos',
                    cacNumber: '',  // Empty string - should be normalized to null
                    swiftCode: '',  // Empty string - should be normalized to null
                });

            console.log(`Response: ${response.status}`);
            console.log(JSON.stringify(response.body, null, 2));

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBeDefined();

            state.developerOrgId = response.body.data.id;

            console.log(`✅ Lekki Gardens Org ID: ${state.developerOrgId}`);
        });
    });

    // =========================================================================
    // STEP 4: Create Organization Members
    // =========================================================================
    describe('Step 4: Create Organization Members', () => {

        it('Step 4.1: Create Nkechi as Access Bank loan officer (LENDER role)', async () => {
            console.log('\n--- Step 4.1: Create Nkechi (Lender) ---');

            expect(state.adminAccessToken).toBeDefined();
            expect(state.lenderOrgId).toBeDefined();

            // First, register Nkechi as a user
            const signupResponse = await userApi
                .post('/auth/signup')
                .set('Content-Type', 'application/json')
                .send({
                    email: state.lenderEmail,
                    password: state.lenderPassword,
                    firstName: 'Nkechi',
                    lastName: 'Eze',
                    tenantId: state.tenantId,
                });

            console.log(`Signup Response: ${signupResponse.status}`);
            if (signupResponse.status !== 201) {
                console.log(JSON.stringify(signupResponse.body, null, 2));
            }

            expect(signupResponse.status).toBe(201);

            // Extract user ID from token
            const tokenPayload = JSON.parse(
                Buffer.from(signupResponse.body.data.accessToken.split('.')[1], 'base64').toString()
            );
            state.lenderId = tokenPayload.sub;
            console.log(`  Nkechi User ID: ${state.lenderId}`);

            // Verify email
            await verifyUserEmail(state.lenderId!);

            // Now add as organization member
            const memberResponse = await userApi
                .post(`/organizations/${state.lenderOrgId}/members`)
                .set(authHeaders(state.adminAccessToken!))
                .send({
                    userId: state.lenderId,
                    roleName: 'LENDER', // This should match the role created during bootstrap
                    title: 'Loan Officer',
                });

            console.log(`Member Response: ${memberResponse.status}`);
            console.log(JSON.stringify(memberResponse.body, null, 2));

            expect(memberResponse.status).toBe(201);

            state.lenderMembershipId = memberResponse.body.data.id;
            console.log(`✅ Nkechi Membership ID: ${state.lenderMembershipId}`);
        });

        it('Step 4.2: Create Emeka as Lekki Gardens developer rep (DEVELOPER role)', async () => {
            console.log('\n--- Step 4.2: Create Emeka (Developer) ---');

            expect(state.adminAccessToken).toBeDefined();
            expect(state.developerOrgId).toBeDefined();

            // First, register Emeka as a user
            const signupResponse = await userApi
                .post('/auth/signup')
                .set('Content-Type', 'application/json')
                .send({
                    email: state.developerEmail,
                    password: state.developerPassword,
                    firstName: 'Emeka',
                    lastName: 'Obi',
                    tenantId: state.tenantId,
                });

            console.log(`Signup Response: ${signupResponse.status}`);
            if (signupResponse.status !== 201) {
                console.log(JSON.stringify(signupResponse.body, null, 2));
            }

            expect(signupResponse.status).toBe(201);

            // Extract user ID from token
            const tokenPayload = JSON.parse(
                Buffer.from(signupResponse.body.data.accessToken.split('.')[1], 'base64').toString()
            );
            state.developerId = tokenPayload.sub;
            console.log(`  Emeka User ID: ${state.developerId}`);

            // Verify email
            await verifyUserEmail(state.developerId!);

            // Now add as organization member
            const memberResponse = await userApi
                .post(`/organizations/${state.developerOrgId}/members`)
                .set(authHeaders(state.adminAccessToken!))
                .send({
                    userId: state.developerId,
                    roleName: 'DEVELOPER',
                    title: 'Sales Representative',
                });

            console.log(`Member Response: ${memberResponse.status}`);
            console.log(JSON.stringify(memberResponse.body, null, 2));

            expect(memberResponse.status).toBe(201);

            state.developerMembershipId = memberResponse.body.data.id;
            console.log(`✅ Emeka Membership ID: ${state.developerMembershipId}`);
        });
    });

    // =========================================================================
    // STEP 5: Create Property
    // =========================================================================
    describe('Step 5: Create Property', () => {

        it('Step 5.1: Create Lekki Gardens Estate property', async () => {
            console.log('\n--- Step 5.1: Create Property ---');

            expect(state.adminAccessToken).toBeDefined();
            expect(state.developerOrgId).toBeDefined();

            const response = await propertyApi
                .post('/properties')
                .set(authHeaders(state.adminAccessToken!))
                .send({
                    name: 'Lekki Gardens Estate Phase 3',
                    description: 'Premium waterfront residential development in Lekki Phase 1',
                    type: 'RESIDENTIAL',
                    address: 'Plot 45, Admiralty Way, Lekki Phase 1',
                    city: 'Lagos',
                    state: 'Lagos',
                    country: 'Nigeria',
                    developerId: state.developerOrgId,
                    features: ['24/7 Security', 'Swimming Pool', 'Gym', 'Children Playground', 'Waterfront View'],
                });

            console.log(`Response: ${response.status}`);
            console.log(JSON.stringify(response.body, null, 2));

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();

            state.propertyId = response.body.data.id;

            console.log(`✅ Property ID: ${state.propertyId}`);
        });

        it('Step 5.2: Create 3-Bedroom variant', async () => {
            console.log('\n--- Step 5.2: Create Variant ---');

            expect(state.adminAccessToken).toBeDefined();
            expect(state.propertyId).toBeDefined();

            const response = await propertyApi
                .post(`/properties/${state.propertyId}/variants`)
                .set(authHeaders(state.adminAccessToken!))
                .send({
                    name: '3-Bedroom Flat',
                    description: 'Spacious 3-bedroom apartment with waterfront view',
                    price: PROPERTY_PRICE,
                    currency: 'NGN',
                    squareMeters: 150,
                    bedrooms: 3,
                    bathrooms: 3,
                    parkingSpaces: 1,
                    features: ['Fitted Kitchen', 'Ensuite Rooms', 'Balcony', 'Guest Toilet'],
                });

            console.log(`Response: ${response.status}`);
            console.log(JSON.stringify(response.body, null, 2));

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();

            state.variantId = response.body.data.id;

            console.log(`✅ Variant ID: ${state.variantId}`);
        });

        it('Step 5.3: Create Unit 14B', async () => {
            console.log('\n--- Step 5.3: Create Unit ---');

            expect(state.adminAccessToken).toBeDefined();
            expect(state.variantId).toBeDefined();

            const response = await propertyApi
                .post(`/variants/${state.variantId}/units`)
                .set(authHeaders(state.adminAccessToken!))
                .send({
                    unitNumber: '14B',
                    floor: 14,
                    block: 'B',
                    status: 'AVAILABLE',
                });

            console.log(`Response: ${response.status}`);
            console.log(JSON.stringify(response.body, null, 2));

            expect(response.status).toBe(201);
            expect(response.body.data.id).toBeDefined();

            state.unitId = response.body.data.id;

            console.log(`✅ Unit ID: ${state.unitId}`);
        });
    });

    // =========================================================================
    // STEP 6: Customer Signup
    // =========================================================================
    describe('Step 6: Customer Signup', () => {

        it('Step 6.1: Chidi signs up', async () => {
            console.log('\n--- Step 6.1: Chidi Signup ---');

            expect(state.tenantId).toBeDefined();

            const response = await userApi
                .post('/auth/signup')
                .set('Content-Type', 'application/json')
                .send({
                    email: state.customerEmail,
                    password: state.customerPassword,
                    firstName: 'Chidi',
                    lastName: 'Nnamdi',
                    tenantId: state.tenantId,
                });

            console.log(`Response: ${response.status}`);
            if (response.status !== 201) {
                console.log(JSON.stringify(response.body, null, 2));
            }

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();

            state.customerAccessToken = response.body.data.accessToken;

            // Extract user ID from token
            const tokenPayload = JSON.parse(
                Buffer.from(state.customerAccessToken!.split('.')[1], 'base64').toString()
            );
            state.customerId = tokenPayload.sub;

            console.log(`✅ Chidi User ID: ${state.customerId}`);
        });

        it('Step 6.2: Verify Chidi\'s email', async () => {
            console.log('\n--- Step 6.2: Verify Chidi Email ---');

            expect(state.customerId).toBeDefined();

            await verifyUserEmail(state.customerId!);

            console.log(`✅ Email verified`);
        });

        it('Step 6.3: Chidi logs in (get fresh token after verification)', async () => {
            console.log('\n--- Step 6.3: Chidi Login ---');

            const response = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({
                    email: state.customerEmail,
                    password: state.customerPassword,
                });

            console.log(`Response: ${response.status}`);
            if (response.status !== 200) {
                console.log(JSON.stringify(response.body, null, 2));
            }

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.accessToken).toBeDefined();

            state.customerAccessToken = response.body.data.accessToken;

            console.log(`✅ Got fresh access token`);
        });
    });

    // =========================================================================
    // Continue adding more steps as needed...
    // =========================================================================

    // Placeholder for future steps - uncomment and implement as needed:

    // describe('Step 7: Payment Plans & Methods', () => {
    //     it('Step 7.1: Create downpayment plan', async () => {});
    //     it('Step 7.2: Create prequalification plan', async () => {});
    //     it('Step 7.3: Create documentation plans', async () => {});
    //     it('Step 7.4: Create payment method', async () => {});
    // });

    // describe('Step 8: Create Application', () => {
    //     it('Step 8.1: Chidi creates application for Unit 14B', async () => {});
    // });

    // describe('Step 9: Prequalification Phase', () => {
    //     it('Step 9.1: Chidi submits questionnaire responses', async () => {});
    // });
});

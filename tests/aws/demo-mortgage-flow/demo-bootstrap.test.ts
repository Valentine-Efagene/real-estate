/**
 * Demo Bootstrap: Full Mortgage Flow (Environment Setup → Application → Completion)
 *
 * Sets up the complete demo environment AND runs through the full mortgage application
 * flow to completion. All operations are performed via REST APIs only — NO DATABASE ACCESS.
 *
 * Environment Setup (Steps 1–11):
 * 1. Tenant & Admin (Adaeze) via bootstrap
 * 2. QShelter mortgage_ops staff (Yinka)
 * 3. Developer org (Lekki Gardens) with completed onboarding by agent Nneka
 * 4. Bank org (Access Bank) with completed onboarding by mortgage_ops Eniola
 * 5. Customer (Emeka Okoro)
 * 6. Property (Sunrise Heights) created by Nneka, published
 * 7. MREIF 10/90 payment method with 5 phases, linked to property by Yinka
 *
 * Application Flow (Steps 12–18):
 * 12. Emeka creates mortgage application
 * 13. Admin binds Access Bank as lender
 * 14. Prequalification: Emeka answers questionnaire → Adaeze approves
 * 15. Sales Offer: Nneka (developer) uploads sales offer → auto-approved
 * 16. KYC Documentation: Emeka uploads 4 docs → Adaeze reviews (Stage 1) →
 *     Eniola uploads preapproval letter (Stage 2, auto-approved)
 * 17. Downpayment: Emeka pays 10% via wallet → event-based auto-completion
 * 18. Mortgage Offer: Eniola uploads mortgage offer → auto-approved → Application COMPLETED
 *
 * Actors:
 * - Adaeze (adaeze@mailsac.com) — QShelter admin
 * - Yinka (yinka@mailsac.com) — QShelter mortgage_ops staff
 * - Nneka (nneka@mailsac.com) — Lekki Gardens agent + onboarder
 * - Eniola (eniola@mailsac.com) — Access Bank mortgage_ops + onboarder
 * - Emeka (emeka@mailsac.com) — Customer (first-time homebuyer)
 *
 * Run with:
 *   npm run test:demo-bootstrap
 *   # or:
 *   ./scripts/run-demo-bootstrap.sh
 */

import supertest from 'supertest';
import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// =============================================================================
// Environment & Configuration
// =============================================================================

const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL;
const MORTGAGE_SERVICE_URL = process.env.MORTGAGE_SERVICE_URL;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL;
const ROLE_POLICIES_TABLE = process.env.ROLE_POLICIES_TABLE || 'qshelter-staging-role-policies';
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET || 'local-bootstrap-secret';

function validateEnvVars() {
    const missing: string[] = [];
    if (!USER_SERVICE_URL) missing.push('USER_SERVICE_URL');
    if (!PROPERTY_SERVICE_URL) missing.push('PROPERTY_SERVICE_URL');
    if (!MORTGAGE_SERVICE_URL) missing.push('MORTGAGE_SERVICE_URL');
    if (!PAYMENT_SERVICE_URL) missing.push('PAYMENT_SERVICE_URL');
    if (missing.length > 0) {
        throw new Error(
            `Missing environment variables: ${missing.join(', ')}\n` +
            `Run with: ./scripts/run-demo-bootstrap.sh`,
        );
    }
}
validateEnvVars();

const userApi = supertest(USER_SERVICE_URL!);
const propertyApi = supertest(PROPERTY_SERVICE_URL!);
const mortgageApi = supertest(MORTGAGE_SERVICE_URL!);
const paymentApi = supertest(PAYMENT_SERVICE_URL!);

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// =============================================================================
// Scenario Constants
// =============================================================================

const TENANT_NAME = 'QShelter Demo';
const TENANT_SUBDOMAIN = 'qshelter-demo';
const TEST_RUN_ID = randomUUID();

const propertyPrice = 75_000_000; // ₦75M
const downpaymentPercent = 10;

// =============================================================================
// Helpers
// =============================================================================

function idempotencyKey(op: string): string {
    return `${TEST_RUN_ID}:${op}`;
}

function authHeaders(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function mockS3Url(folder: string, fileName: string): string {
    return `https://qshelter-uploads-staging.s3.amazonaws.com/${folder}/${randomUUID()}/${fileName}`;
}

async function waitForPolicyInDynamoDB(
    roleName: string,
    tenantId: string,
    maxWaitMs = 30000,
    pollIntervalMs = 1000,
): Promise<boolean> {
    const startTime = Date.now();
    const pk = `TENANT#${tenantId}#ROLE#${roleName}`;
    while (Date.now() - startTime < maxWaitMs) {
        try {
            const result = await docClient.send(
                new GetCommand({
                    TableName: ROLE_POLICIES_TABLE,
                    Key: { PK: pk, SK: 'POLICY' },
                }),
            );
            if (result.Item?.policy) {
                console.log(`  ✅ Policy ${roleName} synced (${Date.now() - startTime}ms)`);
                return true;
            }
        } catch { }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    console.warn(`  ⚠️  Policy ${roleName} not found after ${maxWaitMs}ms`);
    return false;
}

async function verifyUserEmail(userId: string): Promise<void> {
    const userRes = await userApi
        .get(`/admin/users/${userId}`)
        .set('x-bootstrap-secret', BOOTSTRAP_SECRET);
    if (userRes.status !== 200) throw new Error(`Failed to get user: ${userRes.status}`);
    const { emailVerificationToken, emailVerifiedAt } = userRes.body.data;
    if (emailVerifiedAt) return;
    if (!emailVerificationToken) throw new Error(`No verification token for ${userId}`);
    const verifyRes = await userApi.get('/auth/verify-email').query({ token: emailVerificationToken });
    if (verifyRes.status !== 200) throw new Error(`Verify failed: ${verifyRes.status}`);
    console.log(`  ✅ Email verified for ${userId}`);
}

/**
 * Complete an organization's onboarding by driving through all phases.
 * Returns the final onboarding state.
 */
async function completeOnboarding(
    orgId: string,
    adminToken: string,
    onboarderToken: string,
): Promise<any> {
    // 1. Get onboarding to discover phases
    const onbRes = await userApi
        .get(`/organizations/${orgId}/onboarding`)
        .set(authHeaders(adminToken));
    expect(onbRes.status).toBe(200);
    const onboarding = onbRes.body.data;

    const sortedPhases = [...onboarding.phases].sort((a: any, b: any) => a.order - b.order);
    console.log(`  Onboarding has ${sortedPhases.length} phases: ${sortedPhases.map((p: any) => `${p.name} (${p.phaseCategory})`).join(' → ')}`);

    for (const phase of sortedPhases) {
        if (phase.status === 'COMPLETED') {
            console.log(`  ⏭️  Phase "${phase.name}" already completed`);
            continue;
        }

        if (phase.phaseCategory === 'QUESTIONNAIRE' && phase.questionnairePhase) {
            // Submit all required questionnaire fields
            const fields = phase.questionnairePhase.fields;
            const fieldsToSubmit = fields.map((f: any) => ({
                fieldId: f.id,
                value: generateFieldValue(f),
            }));

            console.log(`  📝 Submitting ${fieldsToSubmit.length} questionnaire fields for "${phase.name}"...`);
            const submitRes = await userApi
                .post(`/organizations/${orgId}/onboarding/phases/${phase.id}/questionnaire`)
                .set(authHeaders(onboarderToken))
                .send({ fields: fieldsToSubmit });

            if (submitRes.status !== 200) {
                console.error(`  Questionnaire submit failed:`, JSON.stringify(submitRes.body, null, 2));
            }
            expect(submitRes.status).toBe(200);
            console.log(`  ✅ Questionnaire "${phase.name}" submitted`);

        } else if (phase.phaseCategory === 'DOCUMENTATION' && phase.documentationPhase) {
            // Upload required documents
            const snapshot = phase.documentationPhase.documentDefinitionsSnapshot || [];
            const requiredDocs = Array.isArray(snapshot) ? snapshot.filter((d: any) => d.isRequired) : [];

            console.log(`  📄 Uploading ${requiredDocs.length} required documents for "${phase.name}"...`);
            for (const doc of requiredDocs) {
                const uploadRes = await userApi
                    .post(`/organizations/${orgId}/onboarding/phases/${phase.id}/documents`)
                    .set(authHeaders(onboarderToken))
                    .send({
                        documentType: doc.documentType,
                        url: mockS3Url('onboarding_docs', `${doc.documentType.toLowerCase()}.pdf`),
                        fileName: `${doc.documentName || doc.documentType}.pdf`,
                    });

                if (uploadRes.status !== 201) {
                    console.error(`  Doc upload "${doc.documentType}" failed:`, JSON.stringify(uploadRes.body, null, 2));
                }
                expect(uploadRes.status).toBe(201);
            }
            console.log(`  ✅ Documentation "${phase.name}" completed`);

        } else if (phase.phaseCategory === 'GATE' && phase.gatePhase) {
            // Admin approves the gate
            console.log(`  🔍 Admin approving gate "${phase.name}"...`);
            const reviewRes = await userApi
                .post(`/organizations/${orgId}/onboarding/phases/${phase.id}/gate/review`)
                .set(authHeaders(adminToken))
                .send({ decision: 'APPROVED', notes: 'All requirements met. Approved for platform access.' });

            if (reviewRes.status !== 200) {
                console.error(`  Gate review failed:`, JSON.stringify(reviewRes.body, null, 2));
            }
            expect(reviewRes.status).toBe(200);
            console.log(`  ✅ Gate "${phase.name}" approved`);
        }
    }

    // Verify final state
    const finalRes = await userApi
        .get(`/organizations/${orgId}/onboarding`)
        .set(authHeaders(adminToken));
    expect(finalRes.status).toBe(200);
    return finalRes.body.data;
}

/**
 * Generate a reasonable value for a questionnaire field based on its type.
 */
function generateFieldValue(field: any): any {
    switch (field.fieldType || field.questionType) {
        case 'TEXT':
            if (field.questionKey?.includes('name') || field.name?.includes('name')) return 'Sample Company Ltd';
            if (field.questionKey?.includes('address') || field.name?.includes('address')) return '15 Admiralty Way, Lekki, Lagos';
            if (field.questionKey?.includes('cac') || field.name?.includes('cac')) return 'RC-987654';
            if (field.questionKey?.includes('tax') || field.name?.includes('tax')) return 'TIN-1234567890';
            if (field.questionKey?.includes('swift') || field.name?.includes('swift')) return 'ABNGNGLA';
            if (field.questionKey?.includes('sort') || field.name?.includes('sort')) return '044150013';
            if (field.questionKey?.includes('license') || field.name?.includes('license')) return 'CBN/2020/001';
            return 'Sample Value';
        case 'NUMBER':
            if (field.questionKey?.includes('year') || field.name?.includes('year')) return 2005;
            if (field.questionKey?.includes('branch') || field.name?.includes('branch')) return 250;
            if (field.questionKey?.includes('completed') || field.name?.includes('completed')) return 45;
            if (field.questionKey?.includes('ongoing') || field.name?.includes('ongoing')) return 12;
            return 100;
        case 'CURRENCY':
            return 50_000_000_000; // ₦50B
        case 'EMAIL':
            return 'contact@mailsac.com';
        case 'PHONE':
            return '+2348012345678';
        case 'ADDRESS':
            return '15 Admiralty Way, Lekki Phase 1, Lagos, Nigeria';
        default:
            return 'Default value';
    }
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe('Demo Bootstrap: Mortgage Flow Environment Setup', () => {
    // State accumulated across steps
    let tenantId: string;
    let adminToken: string;
    let adminId: string;

    // Role IDs
    let adminRoleId: string;
    let userRoleId: string;
    let mortgageOpsRoleId: string;
    let agentRoleId: string;
    let lenderOpsRoleId: string;

    // Organization IDs
    let platformOrgId: string;
    let developerOrgId: string;
    let bankOrgId: string;

    // User tokens & IDs
    let yinkaToken: string;
    let yinkaId: string;
    let nnekaToken: string;
    let nnekaId: string;
    let eniolaToken: string;
    let eniolaId: string;
    let emekaToken: string;
    let emekaId: string;

    // Payment configuration
    let questionnairePlanId: string;
    let salesOfferDocPlanId: string;
    let preapprovalDocPlanId: string;
    let mortgageOfferDocPlanId: string;
    let paymentPlanId: string;
    let paymentMethodId: string;

    // Property
    let propertyId: string;
    let variantId: string;
    let unitId: string;

    // Application flow
    let applicationId: string;
    let prequalificationPhaseId: string;
    let salesOfferPhaseId: string;
    let kycPhaseId: string;
    let downpaymentPhaseId: string;
    let mortgageOfferPhaseId: string;
    let emekaWalletId: string;

    beforeAll(() => {
        console.log('=== Demo Bootstrap: Mortgage Flow Setup ===');
        console.log(`Test Run ID: ${TEST_RUN_ID}`);
        console.log(`User Service: ${USER_SERVICE_URL}`);
        console.log(`Property Service: ${PROPERTY_SERVICE_URL}`);
        console.log(`Mortgage Service: ${MORTGAGE_SERVICE_URL}`);
        console.log('============================================');
    });

    afterAll(() => {
        console.log('\n=== Demo Bootstrap Summary ===');
        console.log(`Tenant ID: ${tenantId}`);
        console.log(`Admin (Adaeze): ${adminId}`);
        console.log(`Yinka (mortgage_ops): ${yinkaId}`);
        console.log(`Nneka (agent/developer onboarder): ${nnekaId}`);
        console.log(`Eniola (mortgage_ops/bank onboarder): ${eniolaId}`);
        console.log(`Emeka (customer): ${emekaId}`);
        console.log(`Platform Org: ${platformOrgId}`);
        console.log(`Developer Org (Lekki Gardens): ${developerOrgId}`);
        console.log(`Bank Org (Access Bank): ${bankOrgId}`);
        console.log(`Property: ${propertyId}`);
        console.log(`Payment Method (MREIF): ${paymentMethodId}`);
        console.log(`Application: ${applicationId}`);
        console.log('==============================');
    });

    // =========================================================================
    // Step 1: Reset & Bootstrap
    // =========================================================================
    describe('Step 1: Reset & Bootstrap', () => {
        it('1.1: Reset database', async () => {
            const res = await userApi
                .post('/admin/reset')
                .set('x-bootstrap-secret', BOOTSTRAP_SECRET);
            expect(res.status).toBe(200);
            console.log(`✅ Reset: deleted ${res.body.totalDeleted} records`);
        });

        it('1.2: Bootstrap tenant with Adaeze as admin', async () => {
            const res = await userApi
                .post('/admin/bootstrap-tenant')
                .set('x-bootstrap-secret', BOOTSTRAP_SECRET)
                .set('Content-Type', 'application/json')
                .send({
                    tenant: { name: TENANT_NAME, subdomain: TENANT_SUBDOMAIN },
                    admin: { email: 'adaeze@mailsac.com', password: 'password', firstName: 'Adaeze', lastName: 'Okonkwo' },
                });

            expect(res.status).toBe(201);
            tenantId = res.body.tenant.id;
            adminId = res.body.admin.id;

            const roles = res.body.roles as Array<{ id: string; name: string }>;
            adminRoleId = roles.find((r) => r.name === 'admin')!.id;
            userRoleId = roles.find((r) => r.name === 'user')!.id;
            mortgageOpsRoleId = roles.find((r) => r.name === 'mortgage_ops')!.id;
            agentRoleId = roles.find((r) => r.name === 'agent')!.id;
            lenderOpsRoleId = roles.find((r) => r.name === 'lender_ops')!.id;

            console.log(`✅ Tenant: ${tenantId}`);
            console.log(`✅ Admin: ${adminId}`);
            console.log(`✅ Roles: admin=${adminRoleId}, mortgage_ops=${mortgageOpsRoleId}, agent=${agentRoleId}`);

            await waitForPolicyInDynamoDB('admin', tenantId);
        });

        it('1.3: Admin logs in', async () => {
            const res = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'adaeze@mailsac.com', password: 'password' });

            expect(res.status).toBe(200);
            adminToken = res.body.data.accessToken;
            console.log(`✅ Adaeze logged in`);
        });
    });

    // =========================================================================
    // Step 2: Find Platform Org
    // =========================================================================
    describe('Step 2: Discover Platform Organization', () => {
        it('2.1: Find QShelter platform org (created by bootstrap)', async () => {
            const res = await userApi
                .get('/organizations')
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);

            const orgs = res.body.data.items || res.body.data;
            const platformOrg = orgs.find((o: any) => o.isPlatformOrg === true);
            expect(platformOrg).toBeDefined();

            platformOrgId = platformOrg.id;
            console.log(`✅ Platform org: ${platformOrgId} (${platformOrg.name})`);
        });
    });

    // =========================================================================
    // Step 3: Create QShelter Staff (Yinka — mortgage_ops)
    // =========================================================================
    describe('Step 3: Create QShelter Staff — Yinka', () => {
        it('3.1: Invite Yinka to QShelter with mortgage_ops role', async () => {
            const inviteRes = await userApi
                .post(`/organizations/${platformOrgId}/invitations`)
                .set(authHeaders(adminToken))
                .set('x-idempotency-key', idempotencyKey('invite-yinka'))
                .send({
                    email: 'yinka@mailsac.com',
                    firstName: 'Yinka',
                    lastName: 'Adewale',
                    roleId: mortgageOpsRoleId,
                    title: 'Mortgage Operations Manager',
                    department: 'Mortgage Operations',
                });

            if (inviteRes.status !== 201) {
                console.error('Invite Yinka failed:', JSON.stringify(inviteRes.body, null, 2));
            }
            expect(inviteRes.status).toBe(201);
            expect(inviteRes.body.data.token).toBeDefined();

            const acceptRes = await userApi
                .post('/invitations/accept')
                .query({ token: inviteRes.body.data.token })
                .set('Content-Type', 'application/json')
                .send({ password: 'password' });

            expect(acceptRes.status).toBe(200);
            yinkaToken = acceptRes.body.data.accessToken;
            yinkaId = acceptRes.body.data.user.id;

            console.log(`✅ Yinka invited & accepted: ${yinkaId} (mortgage_ops)`);
            await waitForPolicyInDynamoDB('mortgage_ops', tenantId);
        });
    });

    // =========================================================================
    // Step 4: Create Developer Org (Lekki Gardens) + Complete Onboarding
    // =========================================================================
    describe('Step 4: Developer Org — Lekki Gardens', () => {
        it('4.1: Create Lekki Gardens organization', async () => {
            const res = await userApi
                .post('/organizations')
                .set(authHeaders(adminToken))
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

            if (res.status !== 201) {
                console.error('Lekki Gardens creation failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            developerOrgId = res.body.data.id;
            console.log(`✅ Lekki Gardens org: ${developerOrgId}`);
        });

        it('4.2: Ensure onboarding exists for Lekki Gardens', async () => {
            const res = await userApi
                .post(`/organizations/${developerOrgId}/onboarding`)
                .set(authHeaders(adminToken));

            // 201 = created, 409 = already exists (auto-created with org)
            expect([201, 409]).toContain(res.status);
            if (res.status === 201) {
                console.log(`✅ Developer onboarding created: ${res.body.data.id}`);
            } else {
                console.log(`✅ Developer onboarding already exists (auto-created with org)`);
            }
        });

        it('4.3: Invite Nneka to Lekki Gardens as agent + onboarder', async () => {
            const inviteRes = await userApi
                .post(`/organizations/${developerOrgId}/invitations`)
                .set(authHeaders(adminToken))
                .set('x-idempotency-key', idempotencyKey('invite-nneka'))
                .send({
                    email: 'nneka@mailsac.com',
                    firstName: 'Nneka',
                    lastName: 'Obi',
                    roleId: agentRoleId,
                    title: 'Development Manager',
                    department: 'Development',
                    isOnboarder: true,
                });

            if (inviteRes.status !== 201) {
                console.error('Invite Nneka failed:', JSON.stringify(inviteRes.body, null, 2));
            }
            expect(inviteRes.status).toBe(201);

            const acceptRes = await userApi
                .post('/invitations/accept')
                .query({ token: inviteRes.body.data.token })
                .set('Content-Type', 'application/json')
                .send({ password: 'password' });

            expect(acceptRes.status).toBe(200);
            nnekaToken = acceptRes.body.data.accessToken;
            nnekaId = acceptRes.body.data.user.id;

            console.log(`✅ Nneka invited & accepted: ${nnekaId} (agent + onboarder)`);
            await waitForPolicyInDynamoDB('agent', tenantId);
        });

        it('4.4: Complete developer onboarding (questionnaire → docs → gate)', async () => {
            const result = await completeOnboarding(developerOrgId, adminToken, nnekaToken);
            expect(result.status).toBe('COMPLETED');
            console.log(`✅ Developer onboarding COMPLETED`);
        });

        it('4.5: Verify Lekki Gardens is now ACTIVE', async () => {
            const res = await userApi
                .get(`/organizations/${developerOrgId}`)
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('ACTIVE');
            console.log(`✅ Lekki Gardens status: ACTIVE`);
        });
    });

    // =========================================================================
    // Step 5: Create Bank Org (Access Bank) + Complete Onboarding
    // =========================================================================
    describe('Step 5: Bank Org — Access Bank', () => {
        it('5.1: Create Access Bank organization', async () => {
            const res = await userApi
                .post('/organizations')
                .set(authHeaders(adminToken))
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

            if (res.status !== 201) {
                console.error('Access Bank creation failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            bankOrgId = res.body.data.id;
            console.log(`✅ Access Bank org: ${bankOrgId}`);
        });

        it('5.2: Ensure onboarding exists for Access Bank', async () => {
            const res = await userApi
                .post(`/organizations/${bankOrgId}/onboarding`)
                .set(authHeaders(adminToken));

            // 201 = created, 409 = already exists (auto-created with org)
            expect([201, 409]).toContain(res.status);
            if (res.status === 201) {
                console.log(`✅ Bank onboarding created: ${res.body.data.id}`);
            } else {
                console.log(`✅ Bank onboarding already exists (auto-created with org)`);
            }
        });

        it('5.3: Invite Eniola to Access Bank as mortgage_ops + onboarder', async () => {
            const inviteRes = await userApi
                .post(`/organizations/${bankOrgId}/invitations`)
                .set(authHeaders(adminToken))
                .set('x-idempotency-key', idempotencyKey('invite-eniola'))
                .send({
                    email: 'eniola@mailsac.com',
                    firstName: 'Eniola',
                    lastName: 'Adeyemi',
                    roleId: mortgageOpsRoleId,
                    title: 'Mortgage Operations Officer',
                    department: 'Mortgage Lending',
                    isOnboarder: true,
                });

            if (inviteRes.status !== 201) {
                console.error('Invite Eniola failed:', JSON.stringify(inviteRes.body, null, 2));
            }
            expect(inviteRes.status).toBe(201);

            const acceptRes = await userApi
                .post('/invitations/accept')
                .query({ token: inviteRes.body.data.token })
                .set('Content-Type', 'application/json')
                .send({ password: 'password' });

            expect(acceptRes.status).toBe(200);
            eniolaToken = acceptRes.body.data.accessToken;
            eniolaId = acceptRes.body.data.user.id;

            console.log(`✅ Eniola invited & accepted: ${eniolaId} (mortgage_ops + onboarder)`);
            // mortgage_ops policy should already be synced from Yinka
        });

        it('5.4: Complete bank onboarding (questionnaire → docs → gate)', async () => {
            const result = await completeOnboarding(bankOrgId, adminToken, eniolaToken);
            expect(result.status).toBe('COMPLETED');
            console.log(`✅ Bank onboarding COMPLETED`);
        });

        it('5.5: Verify Access Bank is now ACTIVE', async () => {
            const res = await userApi
                .get(`/organizations/${bankOrgId}`)
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('ACTIVE');
            console.log(`✅ Access Bank status: ACTIVE`);
        });
    });

    // =========================================================================
    // Step 6: Register Customer (Emeka Okoro)
    // =========================================================================
    describe('Step 6: Customer Registration — Emeka Okoro', () => {
        it('6.1: Emeka signs up', async () => {
            const res = await userApi
                .post('/auth/signup')
                .set('Content-Type', 'application/json')
                .send({
                    email: 'emeka@mailsac.com',
                    password: 'password',
                    firstName: 'Emeka',
                    lastName: 'Okoro',
                    tenantId,
                });

            if (res.status !== 201) {
                console.error('Emeka signup failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            emekaToken = res.body.data.accessToken;

            const payload = JSON.parse(Buffer.from(emekaToken.split('.')[1], 'base64').toString());
            emekaId = payload.sub;
            console.log(`✅ Emeka registered: ${emekaId}`);

            // Verify email for full access
            await verifyUserEmail(emekaId);
            await waitForPolicyInDynamoDB('user', tenantId);
        });
    });

    // =========================================================================
    // Step 7: Nneka Creates Property (Sunrise Heights Estate)
    // =========================================================================
    describe('Step 7: Property Setup — by Nneka (developer agent)', () => {
        it('7.1: Nneka creates property', async () => {
            // Nneka needs a fresh token (original may have expired)
            const loginRes = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'nneka@mailsac.com', password: 'password' });
            expect(loginRes.status).toBe(200);
            nnekaToken = loginRes.body.data.accessToken;

            const res = await propertyApi
                .post('/property/properties')
                .set(authHeaders(nnekaToken))
                .send({
                    title: 'Sunrise Heights Estate',
                    description: 'Premium residential estate in Lekki Phase 1, Lagos. Modern finishes, 24/7 security, swimming pool, gym.',
                    category: 'SALE',
                    propertyType: 'APARTMENT',
                    country: 'Nigeria',
                    currency: 'NGN',
                    city: 'Lagos',
                    district: 'Lekki Phase 1',
                    organizationId: developerOrgId,
                });

            if (res.status !== 201) {
                console.error('Property creation failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            propertyId = res.body.data.id;
            console.log(`✅ Property created: ${propertyId}`);
        });

        it('7.2: Nneka adds media', async () => {
            const res = await propertyApi
                .post(`/property/properties/${propertyId}/media`)
                .set(authHeaders(nnekaToken))
                .send({
                    media: [
                        {
                            url: mockS3Url('property_pictures', 'sunrise-heights-exterior.jpg'),
                            type: 'IMAGE',
                            caption: 'Sunrise Heights Estate - Exterior View',
                            order: 0,
                        },
                        {
                            url: mockS3Url('property_pictures', 'sunrise-heights-interior.jpg'),
                            type: 'IMAGE',
                            caption: 'Sunrise Heights Estate - Interior',
                            order: 1,
                        },
                    ],
                });

            if (res.status !== 201) {
                console.error('Media upload failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);

            // Set display image
            const displayImageId = res.body.data[0].id;
            const updateRes = await propertyApi
                .put(`/property/properties/${propertyId}`)
                .set(authHeaders(nnekaToken))
                .send({ displayImageId });
            expect(updateRes.status).toBe(200);
            console.log(`✅ Media added + display image set`);
        });

        it('7.3: Nneka creates variant', async () => {
            const res = await propertyApi
                .post(`/property/properties/${propertyId}/variants`)
                .set(authHeaders(nnekaToken))
                .send({
                    name: '3-Bedroom Luxury Apartment',
                    nBedrooms: 3,
                    nBathrooms: 3,
                    nParkingSpots: 1,
                    area: 180,
                    price: propertyPrice,
                    totalUnits: 24,
                    availableUnits: 20,
                });

            if (res.status !== 201) {
                console.error('Variant creation failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            variantId = res.body.data.id;
            console.log(`✅ Variant: ${variantId} (₦${propertyPrice.toLocaleString()})`);
        });

        it('7.4: Nneka creates unit', async () => {
            const res = await propertyApi
                .post(`/property/properties/${propertyId}/variants/${variantId}/units`)
                .set(authHeaders(nnekaToken))
                .send({
                    unitNumber: 'A-201',
                    floorNumber: 2,
                    blockName: 'Block A',
                });

            if (res.status !== 201) {
                console.error('Unit creation failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            unitId = res.body.data.id;
            console.log(`✅ Unit: ${unitId} (A-201)`);
        });

        it('7.5: Nneka publishes property', async () => {
            const res = await propertyApi
                .patch(`/property/properties/${propertyId}/publish`)
                .set(authHeaders(nnekaToken));

            if (res.status !== 200) {
                console.error('Publish failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('PUBLISHED');
            console.log(`✅ Property published`);
        });
    });

    // =========================================================================
    // Step 8: Create MREIF Payment Method Plans (by Yinka — mortgage_ops)
    // =========================================================================
    describe('Step 8: MREIF Payment Plans — by Yinka', () => {
        beforeAll(async () => {
            // Refresh Yinka's token
            const loginRes = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'yinka@mailsac.com', password: 'password' });
            expect(loginRes.status).toBe(200);
            yinkaToken = loginRes.body.data.accessToken;
        });

        it('8.1: Create prequalification questionnaire plan (5 questions)', async () => {
            const res = await mortgageApi
                .post('/questionnaire-plans')
                .set(authHeaders(yinkaToken))
                .set('x-idempotency-key', idempotencyKey('create-preq-plan'))
                .send({
                    name: 'MREIF Prequalification',
                    description: 'Quick eligibility check for 10/90 mortgage applicants',
                    isActive: true,
                    passingScore: 100,
                    scoringStrategy: 'MIN_ALL',
                    autoDecisionEnabled: false,
                    estimatedMinutes: 5,
                    category: 'PREQUALIFICATION',
                    questions: [
                        {
                            questionKey: 'employment_status',
                            questionText: 'What is your employment status?',
                            questionType: 'SELECT',
                            order: 1,
                            isRequired: true,
                            options: [
                                { value: 'EMPLOYED', label: 'Employed', score: 100 },
                                { value: 'SELF_EMPLOYED', label: 'Self-Employed', score: 100 },
                                { value: 'RETIRED', label: 'Retired', score: 50 },
                                { value: 'UNEMPLOYED', label: 'Unemployed', score: 0 },
                            ],
                            scoreWeight: 1,
                            category: 'EMPLOYMENT',
                        },
                        {
                            questionKey: 'monthly_income',
                            questionText: 'What is your monthly net income (₦)?',
                            questionType: 'CURRENCY',
                            order: 2,
                            isRequired: true,
                            validationRules: { min: 0 },
                            scoringRules: [
                                { operator: 'GREATER_THAN', value: 500000, score: 100 },
                                { operator: 'LESS_THAN_OR_EQUAL', value: 500000, score: 50 },
                            ],
                            scoreWeight: 1,
                            category: 'INCOME',
                        },
                        {
                            questionKey: 'years_employed',
                            questionText: 'How many years at your current employer?',
                            questionType: 'NUMBER',
                            order: 3,
                            isRequired: true,
                            validationRules: { min: 0, max: 50 },
                            scoringRules: [
                                { operator: 'GREATER_THAN_OR_EQUAL', value: 2, score: 100 },
                                { operator: 'LESS_THAN', value: 2, score: 50 },
                            ],
                            scoreWeight: 1,
                            category: 'EMPLOYMENT',
                        },
                        {
                            questionKey: 'existing_mortgage',
                            questionText: 'Do you have an existing mortgage?',
                            questionType: 'SELECT',
                            order: 4,
                            isRequired: true,
                            options: [
                                { value: 'NO', label: 'No', score: 100 },
                                { value: 'YES', label: 'Yes', score: 50 },
                            ],
                            scoreWeight: 1,
                            category: 'CREDIT',
                        },
                        {
                            questionKey: 'property_purpose',
                            questionText: 'What is the purpose of this property?',
                            questionType: 'SELECT',
                            order: 5,
                            isRequired: true,
                            options: [
                                { value: 'PRIMARY_RESIDENCE', label: 'Primary Residence', score: 100 },
                                { value: 'INVESTMENT', label: 'Investment Property', score: 80 },
                                { value: 'VACATION', label: 'Vacation Home', score: 60 },
                            ],
                            scoreWeight: 1,
                            category: 'PREFERENCES',
                        },
                    ],
                });

            if (res.status !== 201) {
                console.error('Questionnaire plan failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            questionnairePlanId = res.body.data.id;
            console.log(`✅ Questionnaire plan: ${questionnairePlanId} (5 questions)`);
        });

        it('8.2: Create sales offer documentation plan', async () => {
            const res = await mortgageApi
                .post('/documentation-plans')
                .set(authHeaders(yinkaToken))
                .set('x-idempotency-key', idempotencyKey('create-sales-offer-plan'))
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

            if (res.status !== 201) {
                console.error('Sales offer plan failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            salesOfferDocPlanId = res.body.data.id;
            console.log(`✅ Sales offer doc plan: ${salesOfferDocPlanId}`);
        });

        it('8.3: Create preapproval documentation plan (5 docs, 2-stage review)', async () => {
            const res = await mortgageApi
                .post('/documentation-plans')
                .set(authHeaders(yinkaToken))
                .set('x-idempotency-key', idempotencyKey('create-preapproval-plan'))
                .send({
                    name: 'MREIF Preapproval Documentation',
                    description: 'Customer uploads documents for QShelter and bank review',
                    isActive: true,
                    documentDefinitions: [
                        {
                            documentType: 'ID_CARD',
                            documentName: 'Valid Government ID',
                            uploadedBy: 'CUSTOMER',
                            order: 1,
                            isRequired: true,
                            description: 'National ID, passport, or driver\'s license',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                        },
                        {
                            documentType: 'BANK_STATEMENT',
                            documentName: 'Bank Statement (6 months)',
                            uploadedBy: 'CUSTOMER',
                            order: 2,
                            isRequired: true,
                            description: 'Last 6 months bank statement showing salary credits',
                            maxSizeBytes: 10 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                        },
                        {
                            documentType: 'EMPLOYMENT_LETTER',
                            documentName: 'Employment Confirmation Letter',
                            uploadedBy: 'CUSTOMER',
                            order: 3,
                            isRequired: true,
                            description: 'Letter from employer confirming employment and salary',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['application/pdf'],
                        },
                        {
                            documentType: 'PROOF_OF_ADDRESS',
                            documentName: 'Proof of Address',
                            uploadedBy: 'CUSTOMER',
                            order: 4,
                            isRequired: true,
                            description: 'Utility bill or official letter showing current address',
                            maxSizeBytes: 5 * 1024 * 1024,
                            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                        },
                        {
                            documentType: 'PREAPPROVAL_LETTER',
                            documentName: 'Bank Preapproval Letter',
                            uploadedBy: 'LENDER',
                            order: 5,
                            isRequired: true,
                            description: 'Preapproval letter from the partner bank',
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
                        },
                        {
                            name: 'Bank Review',
                            order: 2,
                            organizationTypeCode: 'BANK',
                            autoTransition: true,
                            waitForAllDocuments: true,
                            onRejection: 'CASCADE_BACK',
                        },
                    ],
                });

            if (res.status !== 201) {
                console.error('Preapproval plan failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            preapprovalDocPlanId = res.body.data.id;
            console.log(`✅ Preapproval doc plan: ${preapprovalDocPlanId} (5 docs, 2 stages)`);
        });

        it('8.4: Create mortgage offer documentation plan', async () => {
            const res = await mortgageApi
                .post('/documentation-plans')
                .set(authHeaders(yinkaToken))
                .set('x-idempotency-key', idempotencyKey('create-mortgage-offer-plan'))
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
                            description: 'Final mortgage offer from the bank with terms and conditions',
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

            if (res.status !== 201) {
                console.error('Mortgage offer plan failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            mortgageOfferDocPlanId = res.body.data.id;
            console.log(`✅ Mortgage offer doc plan: ${mortgageOfferDocPlanId}`);
        });

        it('8.5: Create one-time downpayment plan (10%, 0% interest)', async () => {
            const res = await mortgageApi
                .post('/payment-plans')
                .set(authHeaders(yinkaToken))
                .set('x-idempotency-key', idempotencyKey('create-payment-plan'))
                .send({
                    name: 'MREIF 10% Downpayment',
                    description: 'One-time 10% downpayment at 0% interest',
                    frequency: 'ONE_TIME',
                    numberOfInstallments: 1,
                    interestRate: 0,
                    lateFeePercentage: 0,
                    gracePeriodDays: 14,
                });

            if (res.status !== 201) {
                console.error('Payment plan failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            paymentPlanId = res.body.data.id;
            console.log(`✅ Payment plan: ${paymentPlanId} (ONE_TIME, 0% interest)`);
        });
    });

    // =========================================================================
    // Step 9: Create MREIF Payment Method (5 phases)
    // =========================================================================
    describe('Step 9: Create MREIF Payment Method', () => {
        it('9.1: Yinka creates MREIF with 5 phases', async () => {
            const res = await mortgageApi
                .post('/payment-methods')
                .set(authHeaders(yinkaToken))
                .set('x-idempotency-key', idempotencyKey('create-mreif'))
                .send({
                    name: 'MREIF 10/90 Mortgage',
                    description: 'Prequalification → Sales Offer → Preapproval Docs → 10% Downpayment → Mortgage Offer',
                    requiresManualApproval: true,
                    phases: [
                        {
                            name: 'Prequalification',
                            phaseCategory: 'QUESTIONNAIRE',
                            phaseType: 'PRE_APPROVAL',
                            order: 1,
                            questionnairePlanId,
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
                            documentationPlanId: preapprovalDocPlanId,
                        },
                        {
                            name: '10% Downpayment',
                            phaseCategory: 'PAYMENT',
                            phaseType: 'DOWNPAYMENT',
                            order: 4,
                            percentOfPrice: downpaymentPercent,
                            paymentPlanId,
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

            if (res.status !== 201) {
                console.error('MREIF creation failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            expect(res.body.data.phases).toHaveLength(5);
            paymentMethodId = res.body.data.id;
            console.log(`✅ MREIF payment method: ${paymentMethodId} (5 phases)`);
        });
    });

    // =========================================================================
    // Step 10: Link Payment Method to Property
    // =========================================================================
    describe('Step 10: Link MREIF to Property', () => {
        it('10.1: Yinka links MREIF to Sunrise Heights', async () => {
            const res = await mortgageApi
                .post(`/payment-methods/${paymentMethodId}/properties`)
                .set(authHeaders(yinkaToken))
                .set('x-idempotency-key', idempotencyKey('link-mreif'))
                .send({
                    propertyId,
                    isDefault: true,
                });

            if (res.status !== 201) {
                console.error('Link payment method failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            console.log(`✅ MREIF linked to Sunrise Heights`);
        });
    });

    // =========================================================================
    // Step 11: Final Verification — Validate entire setup is correct
    // =========================================================================
    describe('Step 11: Final Verification', () => {
        it('11.1: All organizations exist and have correct status', async () => {
            const res = await userApi
                .get('/organizations')
                .set(authHeaders(adminToken));
            expect(res.status).toBe(200);

            const orgs = res.body.data.items || res.body.data;

            // Platform org
            const platform = orgs.find((o: any) => o.id === platformOrgId);
            expect(platform).toBeDefined();
            expect(platform.isPlatformOrg).toBe(true);

            // Developer org — ACTIVE (onboarding completed)
            const developer = orgs.find((o: any) => o.id === developerOrgId);
            expect(developer).toBeDefined();
            expect(developer.status).toBe('ACTIVE');
            expect(developer.name).toBe('Lekki Gardens Development Company');

            // Bank org — ACTIVE (onboarding completed)
            const bank = orgs.find((o: any) => o.id === bankOrgId);
            expect(bank).toBeDefined();
            expect(bank.status).toBe('ACTIVE');
            expect(bank.name).toBe('Access Bank PLC');

            console.log(`✅ All 3 orgs verified: Platform, Lekki Gardens (ACTIVE), Access Bank (ACTIVE)`);
        });

        it('11.2: All users exist with correct roles', async () => {
            // Verify via /auth/me for each user
            const users = [
                { name: 'Adaeze', email: 'adaeze@mailsac.com', password: 'password', expectedRole: 'admin' },
                { name: 'Yinka', email: 'yinka@mailsac.com', password: 'password', expectedRole: 'mortgage_ops' },
                { name: 'Nneka', email: 'nneka@mailsac.com', password: 'password', expectedRole: 'agent' },
                { name: 'Eniola', email: 'eniola@mailsac.com', password: 'password', expectedRole: 'mortgage_ops' },
                { name: 'Emeka', email: 'emeka@mailsac.com', password: 'password', expectedRole: 'user' },
            ];

            for (const user of users) {
                const loginRes = await userApi
                    .post('/auth/login')
                    .set('Content-Type', 'application/json')
                    .send({ email: user.email, password: user.password });
                expect(loginRes.status).toBe(200);

                const meRes = await userApi
                    .get('/auth/me')
                    .set(authHeaders(loginRes.body.data.accessToken));
                expect(meRes.status).toBe(200);
                expect(meRes.body.data.email).toBe(user.email);

                console.log(`  ✅ ${user.name} (${user.email}): verified`);
            }
        });

        it('11.3: Property is published with variant and unit', async () => {
            // Refresh admin token
            const loginRes = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'adaeze@mailsac.com', password: 'password' });
            adminToken = loginRes.body.data.accessToken;

            const propRes = await propertyApi
                .get(`/property/properties/${propertyId}`)
                .set(authHeaders(adminToken));

            expect(propRes.status).toBe(200);
            expect(propRes.body.data.status).toBe('PUBLISHED');
            expect(propRes.body.data.title).toBe('Sunrise Heights Estate');
            console.log(`✅ Property verified: ${propRes.body.data.title} (PUBLISHED)`);

            // Verify variant
            const varRes = await propertyApi
                .get(`/property/properties/${propertyId}/variants`)
                .set(authHeaders(adminToken));
            expect(varRes.status).toBe(200);
            const variants = varRes.body.data.items || varRes.body.data;
            expect(variants.length).toBeGreaterThanOrEqual(1);
            console.log(`✅ Variant verified: ${variants[0].name} (₦${variants[0].price?.toLocaleString()})`);

            // Verify unit
            const unitRes = await propertyApi
                .get(`/property/properties/${propertyId}/variants/${variantId}/units`)
                .set(authHeaders(adminToken));
            expect(unitRes.status).toBe(200);
            const units = unitRes.body.data.items || unitRes.body.data;
            expect(units.length).toBeGreaterThanOrEqual(1);
            console.log(`✅ Unit verified: ${units[0].unitNumber}`);
        });

        it('11.4: MREIF payment method exists with 5 phases', async () => {
            const res = await mortgageApi
                .get(`/payment-methods/${paymentMethodId}`)
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('MREIF 10/90 Mortgage');
            expect(res.body.data.phases).toHaveLength(5);

            const phases = res.body.data.phases.sort((a: any, b: any) => a.order - b.order);
            expect(phases[0].phaseCategory).toBe('QUESTIONNAIRE');
            expect(phases[1].phaseCategory).toBe('DOCUMENTATION');
            expect(phases[2].phaseCategory).toBe('DOCUMENTATION');
            expect(phases[3].phaseCategory).toBe('PAYMENT');
            expect(phases[4].phaseCategory).toBe('DOCUMENTATION');
            console.log(`✅ MREIF verified: ${phases.map((p: any) => p.name).join(' → ')}`);
        });

        it('11.5: MREIF is linked to the property', async () => {
            const res = await mortgageApi
                .get(`/payment-methods/property/${propertyId}`)
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);
            const methods = res.body.data.items || res.body.data;
            expect(methods.length).toBeGreaterThanOrEqual(1);

            const mreif = methods.find((m: any) =>
                m.paymentMethodId === paymentMethodId ||
                m.paymentMethod?.id === paymentMethodId ||
                m.id === paymentMethodId,
            );
            expect(mreif).toBeDefined();
            console.log(`✅ MREIF linked to Sunrise Heights property`);
        });

        it('11.6: Developer and bank onboardings are COMPLETED', async () => {
            // Developer onboarding
            const devOnb = await userApi
                .get(`/organizations/${developerOrgId}/onboarding/current-action`)
                .set(authHeaders(adminToken));
            expect(devOnb.status).toBe(200);
            expect(devOnb.body.data.onboardingStatus).toBe('COMPLETED');
            expect(devOnb.body.data.progress.completedPhases).toBe(devOnb.body.data.progress.totalPhases);

            // Bank onboarding
            const bankOnb = await userApi
                .get(`/organizations/${bankOrgId}/onboarding/current-action`)
                .set(authHeaders(adminToken));
            expect(bankOnb.status).toBe(200);
            expect(bankOnb.body.data.onboardingStatus).toBe('COMPLETED');
            expect(bankOnb.body.data.progress.completedPhases).toBe(bankOnb.body.data.progress.totalPhases);

            console.log(`✅ Both onboardings verified COMPLETED`);
        });

        it('11.7: Customer can browse property and see payment methods', async () => {
            // Login as Emeka
            const loginRes = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'emeka@mailsac.com', password: 'password' });
            expect(loginRes.status).toBe(200);
            const emekaFreshToken = loginRes.body.data.accessToken;

            // Browse properties
            const propRes = await propertyApi
                .get('/property/properties')
                .set(authHeaders(emekaFreshToken));
            expect(propRes.status).toBe(200);
            const properties = propRes.body.data.items || propRes.body.data;
            const sunrise = properties.find((p: any) => p.id === propertyId);
            expect(sunrise).toBeDefined();
            expect(sunrise.status).toBe('PUBLISHED');

            // Get payment methods for property (on mortgage service)
            const pmRes = await mortgageApi
                .get(`/payment-methods/property/${propertyId}`)
                .set(authHeaders(emekaFreshToken));
            expect(pmRes.status).toBe(200);
            const paymentMethods = pmRes.body.data.items || pmRes.body.data;
            expect(paymentMethods.length).toBeGreaterThanOrEqual(1);

            console.log(`✅ Emeka can browse property and see ${paymentMethods.length} payment method(s)`);
            console.log(`\n🎉 Demo environment is fully set up and ready!`);
            console.log(`\n=== Starting Full Application Flow ===`);
        });
    });

    // =========================================================================
    // Step 12: Emeka Creates Mortgage Application
    // =========================================================================
    describe('Step 12: Emeka Creates Mortgage Application', () => {
        it('12.1: Emeka logs in with fresh token', async () => {
            const loginRes = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'emeka@mailsac.com', password: 'password' });
            expect(loginRes.status).toBe(200);
            emekaToken = loginRes.body.data.accessToken;
            console.log(`✅ Emeka logged in`);
        });

        it('12.2: Emeka creates application for Sunrise Heights', async () => {
            const res = await mortgageApi
                .post('/applications')
                .set(authHeaders(emekaToken))
                .set('x-idempotency-key', idempotencyKey('create-application'))
                .send({
                    propertyUnitId: unitId,
                    paymentMethodId,
                    title: 'Purchase Agreement - Sunrise Heights A-201',
                    applicationType: 'MORTGAGE',
                    totalAmount: propertyPrice,
                    monthlyIncome: 2_500_000,
                    monthlyExpenses: 800_000,
                    applicantAge: 35,
                });

            if (res.status !== 201) {
                console.error('Application creation failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            expect(res.body.data.phases).toHaveLength(5);
            expect(res.body.data.status).toBe('PENDING');

            applicationId = res.body.data.id;

            const phases = res.body.data.phases;
            prequalificationPhaseId = phases.find((p: any) => p.order === 1).id;
            salesOfferPhaseId = phases.find((p: any) => p.order === 2).id;
            kycPhaseId = phases.find((p: any) => p.order === 3).id;
            downpaymentPhaseId = phases.find((p: any) => p.order === 4).id;
            mortgageOfferPhaseId = phases.find((p: any) => p.order === 5).id;

            console.log(`✅ Application: ${applicationId}`);
            console.log(`   Phases: ${phases.map((p: any) => `${p.order}:${p.name}`).join(' → ')}`);
        });
    });

    // =========================================================================
    // Step 13: Admin Binds Access Bank as Lender
    // =========================================================================
    describe('Step 13: Bind Access Bank to Application', () => {
        it('13.1: Refresh admin token', async () => {
            const loginRes = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'adaeze@mailsac.com', password: 'password' });
            expect(loginRes.status).toBe(200);
            adminToken = loginRes.body.data.accessToken;
        });

        it('13.2: Verify Lekki Gardens auto-bound as developer', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/organizations`)
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);
            const devBinding = res.body.data.find(
                (b: any) => b.assignedAsType?.code === 'DEVELOPER',
            );
            expect(devBinding).toBeDefined();
            expect(devBinding.organizationId).toBe(developerOrgId);
            console.log(`✅ Lekki Gardens auto-bound as DEVELOPER`);
        });

        it('13.3: Admin binds Access Bank as BANK', async () => {
            const res = await mortgageApi
                .post(`/applications/${applicationId}/organizations`)
                .set(authHeaders(adminToken))
                .set('x-idempotency-key', idempotencyKey('bind-access-bank'))
                .send({
                    organizationId: bankOrgId,
                    organizationTypeCode: 'BANK',
                    isPrimary: true,
                    slaHours: 48,
                });

            if (res.status !== 201) {
                console.error('Bank binding failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            console.log(`✅ Access Bank bound as BANK`);
        });
    });

    // =========================================================================
    // Step 14: Prequalification Questionnaire (Phase 1)
    // =========================================================================
    describe('Step 14: Prequalification Questionnaire', () => {
        it('14.1: Phase 1 is auto-activated IN_PROGRESS', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${prequalificationPhaseId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('IN_PROGRESS');
            console.log(`✅ Prequalification phase: IN_PROGRESS`);
        });

        it('14.2: Emeka checks current-action — should be QUESTIONNAIRE', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            const action = res.body.data;

            expect(action.currentPhase.id).toBe(prequalificationPhaseId);
            expect(action.currentPhase.phaseCategory).toBe('QUESTIONNAIRE');
            expect(action.actionRequired).toBe('QUESTIONNAIRE');
            expect(action.userPartyType).toBe('CUSTOMER');
            expect(action.partyActions?.CUSTOMER?.action).toBe('QUESTIONNAIRE');
            expect(action.partyActions?.CUSTOMER?.canCurrentUserAct).toBe(true);
            console.log(`✅ Current action: ${action.actionRequired} — ${action.actionMessage}`);
        });

        it('14.3: Emeka submits questionnaire answers', async () => {
            const res = await mortgageApi
                .post(`/applications/${applicationId}/phases/${prequalificationPhaseId}/questionnaire/submit`)
                .set(authHeaders(emekaToken))
                .set('x-idempotency-key', idempotencyKey('submit-prequalification'))
                .send({
                    answers: [
                        { fieldName: 'employment_status', value: 'EMPLOYED' },
                        { fieldName: 'monthly_income', value: '2500000' },
                        { fieldName: 'years_employed', value: '5' },
                        { fieldName: 'existing_mortgage', value: 'NO' },
                        { fieldName: 'property_purpose', value: 'PRIMARY_RESIDENCE' },
                    ],
                });

            if (res.status !== 200) {
                console.error('Questionnaire submit failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(200);
            console.log(`✅ Questionnaire submitted`);
        });

        it('14.4: Phase is AWAITING_APPROVAL', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${prequalificationPhaseId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('AWAITING_APPROVAL');
            console.log(`✅ Prequalification: AWAITING_APPROVAL`);
        });

        it('14.5: Current action — Emeka sees WAIT_FOR_REVIEW, Admin sees REVIEW', async () => {
            // Customer perspective
            const custRes = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(emekaToken));
            expect(custRes.status).toBe(200);
            expect(custRes.body.data.actionRequired).toBe('WAIT_FOR_REVIEW');
            expect(custRes.body.data.partyActions?.CUSTOMER?.action).toBe('WAIT');

            // Admin perspective
            const adminRes = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(adminToken));
            expect(adminRes.status).toBe(200);
            expect(adminRes.body.data.actionRequired).toBe('REVIEW');
            expect(adminRes.body.data.partyActions?.PLATFORM?.action).toBe('REVIEW');
            expect(adminRes.body.data.partyActions?.PLATFORM?.canCurrentUserAct).toBe(true);
            console.log(`✅ Customer: WAIT_FOR_REVIEW | Admin: REVIEW`);
        });

        it('14.6: Adaeze approves prequalification', async () => {
            const res = await mortgageApi
                .post(`/applications/${applicationId}/phases/${prequalificationPhaseId}/questionnaire/review`)
                .set(authHeaders(adminToken))
                .set('x-idempotency-key', idempotencyKey('approve-prequalification'))
                .send({
                    decision: 'APPROVE',
                    notes: 'Emeka meets all eligibility criteria. Approved for mortgage.',
                });

            if (res.status !== 200) {
                console.error('Questionnaire review failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('COMPLETED');
            console.log(`✅ Prequalification COMPLETED`);
        });
    });

    // =========================================================================
    // Step 15: Sales Offer Documentation (Phase 2)
    // =========================================================================
    describe('Step 15: Sales Offer Documentation', () => {
        it('15.1: Sales offer phase auto-activated', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${salesOfferPhaseId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('IN_PROGRESS');
            console.log(`✅ Sales Offer phase: IN_PROGRESS`);
        });

        it('15.2: Current action — Nneka (developer) should UPLOAD, Emeka should WAIT', async () => {
            // Refresh Nneka's token
            const nnekaLoginRes = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'nneka@mailsac.com', password: 'password' });
            expect(nnekaLoginRes.status).toBe(200);
            nnekaToken = nnekaLoginRes.body.data.accessToken;

            // Developer perspective
            const devRes = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(nnekaToken));
            expect(devRes.status).toBe(200);

            const devAction = devRes.body.data;
            expect(devAction.currentPhase.id).toBe(salesOfferPhaseId);
            expect(devAction.userPartyType).toBe('DEVELOPER');
            expect(devAction.actionRequired).toBe('UPLOAD');
            expect(devAction.partyActions?.DEVELOPER?.action).toBe('UPLOAD');
            expect(devAction.partyActions?.DEVELOPER?.canCurrentUserAct).toBe(true);
            console.log(`✅ Developer sees: UPLOAD — pending: ${devAction.partyActions?.DEVELOPER?.pendingDocuments?.join(', ')}`);

            // Customer perspective — should WAIT
            const custRes = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(emekaToken));
            expect(custRes.status).toBe(200);
            expect(['WAIT_FOR_REVIEW', 'NONE']).toContain(custRes.body.data.actionRequired);
            console.log(`✅ Customer sees: ${custRes.body.data.actionRequired}`);
        });

        it('15.3: Nneka uploads sales offer letter (auto-approved)', async () => {
            const res = await mortgageApi
                .post(`/applications/${applicationId}/phases/${salesOfferPhaseId}/documents`)
                .set(authHeaders(nnekaToken))
                .set('x-idempotency-key', idempotencyKey('upload-sales-offer'))
                .send({
                    documentType: 'SALES_OFFER_LETTER',
                    url: mockS3Url('mortgage_docs', 'sales-offer-letter.pdf'),
                    fileName: 'sales-offer-letter.pdf',
                });

            if (res.status !== 201) {
                console.error('Sales offer upload failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            console.log(`✅ Sales offer letter uploaded (auto-approved)`);
        });

        it('15.4: Sales offer phase COMPLETED', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${salesOfferPhaseId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('COMPLETED');
            console.log(`✅ Sales Offer COMPLETED`);
        });
    });

    // =========================================================================
    // Step 16: KYC Preapproval Documentation (Phase 3) — Two-Stage Review
    // Stage 1: PLATFORM (Adaeze) reviews customer docs
    // Stage 2: BANK (Eniola) uploads preapproval letter (auto-approved)
    // =========================================================================
    describe('Step 16: KYC Documentation (Two-Stage Review)', () => {
        it('16.1: KYC phase auto-activated', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('IN_PROGRESS');
            console.log(`✅ KYC phase: IN_PROGRESS`);
        });

        it('16.2: Current action — Emeka should UPLOAD customer docs', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            const action = res.body.data;

            expect(action.currentPhase.id).toBe(kycPhaseId);
            expect(action.currentPhase.phaseCategory).toBe('DOCUMENTATION');
            expect(action.userPartyType).toBe('CUSTOMER');
            expect(action.actionRequired).toBe('UPLOAD');
            expect(action.partyActions?.CUSTOMER?.action).toBe('UPLOAD');
            expect(action.partyActions?.CUSTOMER?.pendingDocuments?.length).toBeGreaterThan(0);

            console.log(`✅ Customer sees: UPLOAD — pending: ${action.partyActions?.CUSTOMER?.pendingDocuments?.join(', ')}`);
        });

        it('16.3: Emeka uploads 4 customer documents', async () => {
            const customerDocs = [
                { documentType: 'ID_CARD', fileName: 'emeka-id-card.pdf' },
                { documentType: 'BANK_STATEMENT', fileName: 'emeka-bank-statement.pdf' },
                { documentType: 'EMPLOYMENT_LETTER', fileName: 'emeka-employment-letter.pdf' },
                { documentType: 'PROOF_OF_ADDRESS', fileName: 'emeka-proof-of-address.pdf' },
            ];

            for (const doc of customerDocs) {
                const res = await mortgageApi
                    .post(`/applications/${applicationId}/phases/${kycPhaseId}/documents`)
                    .set(authHeaders(emekaToken))
                    .set('x-idempotency-key', idempotencyKey(`upload-${doc.documentType}`))
                    .send({
                        documentType: doc.documentType,
                        url: mockS3Url('kyc_documents', doc.fileName),
                        fileName: doc.fileName,
                    });

                if (res.status !== 201) {
                    console.error(`Upload ${doc.documentType} failed:`, JSON.stringify(res.body, null, 2));
                }
                expect(res.status).toBe(201);
            }
            console.log(`✅ 4 customer documents uploaded`);
        });

        it('16.4: Current action — after customer upload, Admin (PLATFORM) should REVIEW, Bank should UPLOAD', async () => {
            // Admin sees REVIEW (Stage 1 is active, customer docs uploaded)
            const adminRes = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(adminToken));

            expect(adminRes.status).toBe(200);
            const adminAction = adminRes.body.data;

            expect(adminAction.currentPhase.id).toBe(kycPhaseId);
            expect(adminAction.userPartyType).toBe('PLATFORM');
            if (adminAction.currentStep) {
                expect(adminAction.currentStep.stepType).toBe('PLATFORM');
                expect(adminAction.currentStep.order).toBe(1);
            }
            console.log(`✅ Admin sees: ${adminAction.actionRequired} — ${adminAction.actionMessage}`);

            // Bank should see UPLOAD (preapproval letter still needed)
            const eniolaLoginRes = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'eniola@mailsac.com', password: 'password' });
            expect(eniolaLoginRes.status).toBe(200);
            eniolaToken = eniolaLoginRes.body.data.accessToken;

            const bankRes = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(eniolaToken));
            expect(bankRes.status).toBe(200);
            const bankAction = bankRes.body.data;
            expect(bankAction.partyActions?.BANK?.action).toBe('UPLOAD');
            expect(bankAction.partyActions?.BANK?.pendingDocuments).toContain('PREAPPROVAL_LETTER');
            console.log(`✅ Bank sees: ${bankAction.partyActions?.BANK?.action} — pending: ${bankAction.partyActions?.BANK?.pendingDocuments?.join(', ')}`);

            // Customer should WAIT
            const custRes = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(emekaToken));
            expect(custRes.status).toBe(200);
            expect(custRes.body.data.partyActions?.CUSTOMER?.action).toBe('WAIT');
            console.log(`✅ Customer sees: WAIT`);
        });

        it('16.5: Adaeze (Stage 1 PLATFORM) reviews and approves customer documents', async () => {
            // Get uploaded documents
            const docsRes = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}/documents`)
                .set(authHeaders(adminToken));

            expect(docsRes.status).toBe(200);
            const customerDocs = docsRes.body.data.filter(
                (d: any) => ['ID_CARD', 'BANK_STATEMENT', 'EMPLOYMENT_LETTER', 'PROOF_OF_ADDRESS'].includes(d.documentType),
            );
            expect(customerDocs.length).toBe(4);

            for (const doc of customerDocs) {
                const res = await mortgageApi
                    .post(`/applications/${applicationId}/documents/${doc.id}/review`)
                    .set(authHeaders(adminToken))
                    .set('x-idempotency-key', idempotencyKey(`approve-${doc.documentType}`))
                    .send({
                        status: 'APPROVED',
                        organizationTypeCode: 'PLATFORM',
                        comment: `Document verified: ${doc.documentType}`,
                    });

                if (res.status !== 200) {
                    console.error(`Review ${doc.documentType} failed:`, JSON.stringify(res.body, null, 2));
                }
                expect(res.status).toBe(200);
            }
            console.log(`✅ Stage 1 (PLATFORM): All 4 customer docs approved`);
        });

        it('16.6: KYC phase still IN_PROGRESS after Stage 1 (multi-stage regression check)', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);
            const phase = res.body.data;

            // CRITICAL: Phase must NOT be completed yet — Stage 2 hasn't finished
            expect(phase.status).toBe('IN_PROGRESS');

            const docPhase = phase.documentationPhase;
            expect(docPhase.currentStageOrder).toBe(2);

            const stageProgress = docPhase.stageProgress || [];
            expect(stageProgress.length).toBe(2);

            const stage1 = stageProgress.find((s: any) => s.order === 1);
            const stage2 = stageProgress.find((s: any) => s.order === 2);
            expect(stage1.status).toBe('COMPLETED');
            expect(stage2.status).toBe('IN_PROGRESS');

            console.log(`✅ Phase still IN_PROGRESS: Stage 1 COMPLETED, Stage 2 IN_PROGRESS`);
        });

        it('16.7: Current action — Stage 2 active, Eniola (BANK) should UPLOAD preapproval', async () => {
            const bankRes = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(eniolaToken));

            expect(bankRes.status).toBe(200);
            const bankAction = bankRes.body.data;

            expect(bankAction.currentPhase.id).toBe(kycPhaseId);
            expect(bankAction.currentPhase.status).toBe('IN_PROGRESS');
            expect(bankAction.userPartyType).toBe('BANK');
            expect(bankAction.actionRequired).toBe('UPLOAD');
            expect(bankAction.partyActions?.BANK?.action).toBe('UPLOAD');
            expect(bankAction.partyActions?.BANK?.canCurrentUserAct).toBe(true);

            if (bankAction.currentStep) {
                expect(bankAction.currentStep.stepType).toBe('BANK');
                expect(bankAction.currentStep.order).toBe(2);
            }

            console.log(`✅ Bank sees: UPLOAD — pending: ${bankAction.partyActions?.BANK?.pendingDocuments?.join(', ')}`);
        });

        it('16.8: Eniola (BANK) uploads preapproval letter (auto-approved)', async () => {
            const res = await mortgageApi
                .post(`/applications/${applicationId}/phases/${kycPhaseId}/documents`)
                .set(authHeaders(eniolaToken))
                .set('x-idempotency-key', idempotencyKey('upload-preapproval'))
                .send({
                    documentType: 'PREAPPROVAL_LETTER',
                    url: mockS3Url('mortgage_docs', 'preapproval-letter.pdf'),
                    fileName: 'preapproval-letter.pdf',
                });

            if (res.status !== 201) {
                console.error('Preapproval upload failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);

            // Verify auto-approval
            const docsRes = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}/documents`)
                .set(authHeaders(eniolaToken));
            expect(docsRes.status).toBe(200);

            const preapprovalDoc = docsRes.body.data.find(
                (d: any) => d.documentType === 'PREAPPROVAL_LETTER',
            );
            expect(preapprovalDoc).toBeDefined();
            expect(preapprovalDoc.status).toBe('APPROVED');
            console.log(`✅ Preapproval letter uploaded and auto-approved`);
        });

        it('16.9: KYC phase COMPLETED (both stages done)', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('COMPLETED');
            console.log(`✅ KYC Documentation COMPLETED`);
        });

        it('16.10: Both approval stages verified COMPLETED', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${kycPhaseId}`)
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);
            const stageProgress = res.body.data.documentationPhase?.stageProgress || [];
            for (const stage of stageProgress) {
                expect(stage.status).toBe('COMPLETED');
                console.log(`   Stage ${stage.order} (${stage.name}): ${stage.status}`);
            }

            // All docs approved
            const docs = res.body.data.phaseDocuments?.documents || [];
            const approved = docs.filter((d: any) => d.status === 'APPROVED');
            expect(approved.length).toBe(docs.length);
            console.log(`✅ All ${docs.length} documents APPROVED`);
        });
    });

    // =========================================================================
    // Step 17: 10% Downpayment (Phase 4) — Event-Based Payment Flow
    // =========================================================================
    describe('Step 17: Downpayment (Event-Based Flow)', () => {
        it('17.1: Downpayment phase auto-activated', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${downpaymentPhaseId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('IN_PROGRESS');
            console.log(`✅ Downpayment phase: IN_PROGRESS`);
        });

        it('17.2: Current action — Emeka should see PAYMENT', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            const action = res.body.data;

            expect(action.currentPhase.id).toBe(downpaymentPhaseId);
            expect(action.currentPhase.phaseCategory).toBe('PAYMENT');
            expect(action.actionRequired).toBe('PAYMENT');
            expect(action.partyActions?.CUSTOMER?.action).toBe('PAYMENT');
            expect(action.partyActions?.CUSTOMER?.canCurrentUserAct).toBe(true);
            console.log(`✅ Customer sees: PAYMENT — ${action.actionMessage}`);
        });

        it('17.3: Create wallet for Emeka', async () => {
            const res = await paymentApi
                .post('/wallets/me')
                .set(authHeaders(emekaToken))
                .set('x-idempotency-key', idempotencyKey('create-emeka-wallet'))
                .send({ currency: 'NGN' });

            if (res.status === 409 || res.status === 400) {
                // Wallet already exists
                const getRes = await paymentApi
                    .get('/wallets/me')
                    .set(authHeaders(emekaToken));
                expect(getRes.status).toBe(200);
                emekaWalletId = getRes.body.data.id;
                console.log(`✅ Wallet already exists: ${emekaWalletId}`);
            } else {
                expect([200, 201]).toContain(res.status);
                emekaWalletId = res.body.data.id;
                console.log(`✅ Wallet created: ${emekaWalletId}`);
            }
        });

        it('17.4: Generate downpayment installment', async () => {
            const downpaymentAmount = Math.round(propertyPrice * downpaymentPercent / 100);

            const res = await mortgageApi
                .post(`/applications/${applicationId}/phases/${downpaymentPhaseId}/installments`)
                .set(authHeaders(adminToken))
                .set('x-idempotency-key', idempotencyKey('generate-downpayment'))
                .send({ startDate: new Date().toISOString() });

            if (res.status === 400 && res.body.message?.includes('already')) {
                console.log('Installments already generated (via event)');
            } else {
                expect(res.status).toBe(200);
                expect(res.body.data.installments).toHaveLength(1);
                expect(res.body.data.installments[0].amount).toBe(downpaymentAmount);
                console.log(`✅ Downpayment installment generated: ₦${downpaymentAmount.toLocaleString()}`);
            }
        });

        it('17.5: Credit Emeka wallet with downpayment amount (triggers auto-allocation)', async () => {
            const downpaymentAmount = Math.round(propertyPrice * downpaymentPercent / 100);

            const res = await paymentApi
                .post(`/wallets/${emekaWalletId}/credit`)
                .set(authHeaders(adminToken))
                .set('x-idempotency-key', idempotencyKey('credit-emeka-downpayment'))
                .send({
                    amount: downpaymentAmount,
                    reference: `DOWNPAYMENT-${TEST_RUN_ID.slice(0, 8)}`,
                    description: 'Downpayment for Sunrise Heights A-201',
                    source: 'manual',
                });

            if (res.status !== 200) {
                console.error('Wallet credit failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(200);
            console.log(`✅ Wallet credited ₦${downpaymentAmount.toLocaleString()}, waiting for event processing...`);
        });

        it('17.6: Poll for downpayment phase completion (event-driven)', async () => {
            const maxWaitMs = 30000;
            const pollIntervalMs = 2000;
            const startTime = Date.now();
            let phaseStatus = 'IN_PROGRESS';

            while (Date.now() - startTime < maxWaitMs) {
                const res = await mortgageApi
                    .get(`/applications/${applicationId}/phases/${downpaymentPhaseId}`)
                    .set(authHeaders(emekaToken));

                expect(res.status).toBe(200);
                phaseStatus = res.body.data.status;

                console.log(`   Phase status: ${phaseStatus} (${Math.round((Date.now() - startTime) / 1000)}s)`);
                if (phaseStatus === 'COMPLETED') break;

                await new Promise((r) => setTimeout(r, pollIntervalMs));
            }

            expect(phaseStatus).toBe('COMPLETED');
            console.log(`✅ Downpayment COMPLETED via event-based flow`);
        });
    });

    // =========================================================================
    // Step 18: Mortgage Offer Documentation (Phase 5) — Event-Activated
    // =========================================================================
    describe('Step 18: Mortgage Offer Documentation', () => {
        it('18.1: Mortgage offer phase auto-activated via event', async () => {
            const maxWaitMs = 15000;
            const pollIntervalMs = 2000;
            const startTime = Date.now();
            let phaseStatus = 'PENDING';

            while (Date.now() - startTime < maxWaitMs) {
                const res = await mortgageApi
                    .get(`/applications/${applicationId}/phases/${mortgageOfferPhaseId}`)
                    .set(authHeaders(emekaToken));

                expect(res.status).toBe(200);
                phaseStatus = res.body.data.status;

                if (phaseStatus === 'IN_PROGRESS') break;
                await new Promise((r) => setTimeout(r, pollIntervalMs));
            }

            expect(phaseStatus).toBe('IN_PROGRESS');
            console.log(`✅ Mortgage Offer phase: IN_PROGRESS (event-activated)`);
        });

        it('18.2: Current action — Eniola (BANK) should UPLOAD mortgage offer', async () => {
            // Refresh Eniola token
            const eniolaLoginRes = await userApi
                .post('/auth/login')
                .set('Content-Type', 'application/json')
                .send({ email: 'eniola@mailsac.com', password: 'password' });
            expect(eniolaLoginRes.status).toBe(200);
            eniolaToken = eniolaLoginRes.body.data.accessToken;

            const res = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(eniolaToken));

            expect(res.status).toBe(200);
            const action = res.body.data;

            expect(action.currentPhase.id).toBe(mortgageOfferPhaseId);
            expect(action.currentPhase.name).toBe('Mortgage Offer');
            expect(action.userPartyType).toBe('BANK');
            expect(action.actionRequired).toBe('UPLOAD');
            expect(action.partyActions?.BANK?.action).toBe('UPLOAD');
            expect(action.partyActions?.BANK?.canCurrentUserAct).toBe(true);

            console.log(`✅ Bank sees: UPLOAD — pending: ${action.partyActions?.BANK?.pendingDocuments?.join(', ')}`);
        });

        it('18.3: Eniola uploads mortgage offer letter (auto-approved)', async () => {
            const res = await mortgageApi
                .post(`/applications/${applicationId}/phases/${mortgageOfferPhaseId}/documents`)
                .set(authHeaders(eniolaToken))
                .set('x-idempotency-key', idempotencyKey('upload-mortgage-offer'))
                .send({
                    documentType: 'MORTGAGE_OFFER_LETTER',
                    url: mockS3Url('mortgage_docs', 'mortgage-offer-letter.pdf'),
                    fileName: 'mortgage-offer-letter.pdf',
                });

            if (res.status !== 201) {
                console.error('Mortgage offer upload failed:', JSON.stringify(res.body, null, 2));
            }
            expect(res.status).toBe(201);
            console.log(`✅ Mortgage offer letter uploaded (auto-approved)`);
        });

        it('18.4: Mortgage offer phase COMPLETED', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases/${mortgageOfferPhaseId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('COMPLETED');
            console.log(`✅ Mortgage Offer COMPLETED`);
        });

        it('18.5: Application status is COMPLETED', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('COMPLETED');
            console.log(`✅ Application COMPLETED! 🎉`);
        });

        it('18.6: Current action — application COMPLETED, no active phase', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/current-action`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            const action = res.body.data;

            expect(action.applicationStatus).toBe('COMPLETED');
            expect(action.currentPhase).toBeNull();
            expect(action.actionRequired).toBe('COMPLETE');
            expect(action.currentStep).toBeNull();
            console.log(`✅ Final: ${action.actionRequired} — ${action.actionMessage}`);
        });
    });

    // =========================================================================
    // Step 19: Post-Completion Verification
    // =========================================================================
    describe('Step 19: Post-Completion Verification', () => {
        it('19.1: All 5 phases are COMPLETED', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/phases`)
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);
            const phases = res.body.data;
            expect(phases).toHaveLength(5);

            for (const phase of phases) {
                expect(phase.status).toBe('COMPLETED');
            }
            console.log(`✅ All 5 phases COMPLETED`);
        });

        it('19.2: All organizations bound correctly', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}/organizations`)
                .set(authHeaders(adminToken));

            expect(res.status).toBe(200);
            const orgs = res.body.data;

            const developer = orgs.find((o: any) => o.assignedAsType?.code === 'DEVELOPER');
            const bank = orgs.find((o: any) => o.assignedAsType?.code === 'BANK');
            expect(developer).toBeDefined();
            expect(bank).toBeDefined();
            console.log(`✅ DEVELOPER and BANK organizations bound`);
        });

        it('19.3: Emeka can view his completed application', async () => {
            const res = await mortgageApi
                .get(`/applications/${applicationId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('COMPLETED');
            expect(res.body.data.totalAmount).toBe(propertyPrice);
            console.log(`✅ Application verified: COMPLETED, ₦${res.body.data.totalAmount.toLocaleString()}`);
        });

        it('19.4: Property still PUBLISHED', async () => {
            const res = await propertyApi
                .get(`/property/properties/${propertyId}`)
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('PUBLISHED');
            console.log(`✅ Property still PUBLISHED`);
        });

        it('19.5: Emeka lists completed applications', async () => {
            const res = await mortgageApi
                .get('/applications?status=COMPLETED')
                .set(authHeaders(emekaToken));

            expect(res.status).toBe(200);
            const apps = res.body.data.items || res.body.data;
            const myApp = apps.find((a: any) => a.id === applicationId);
            expect(myApp).toBeDefined();
            expect(myApp.status).toBe('COMPLETED');
            console.log(`\n🎉🎉🎉 Full mortgage flow completed successfully! 🎉🎉🎉`);
        });
    });
});

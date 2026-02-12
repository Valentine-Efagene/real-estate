/**
 * Demo Bootstrap E2E Test — Mortgage Application Flow
 *
 * Uses the bootstrap orchestrator to set up the environment (reset DB, create
 * tenant, orgs, users, property, payment method), then exercises the complete
 * 5-phase MREIF 10/90 mortgage application flow via REST APIs.
 *
 * Run with:
 *   npm run test:demo-bootstrap
 *   # or directly:
 *   ./scripts/run-demo-bootstrap.sh
 *
 * Actors (created by orchestrator):
 *   Adaeze  — QShelter admin
 *   Yinka   — QShelter mortgage_ops
 *   Nneka   — Lekki Gardens agent (developer)
 *   Eniola  — Access Bank mortgage_ops (lender)
 *   Emeka   — Customer
 */

import { randomUUID } from 'crypto';

// =============================================================================
// Types — matches the backend DemoBootstrapResult
// =============================================================================

interface ActorInfo {
    name: string;
    email: string;
    role: string;
    id: string;
    token: string;
}

interface BootstrapResult {
    success: boolean;
    tenantId: string;
    actors: {
        adaeze: ActorInfo;
        yinka: ActorInfo;
        nneka: ActorInfo;
        eniola: ActorInfo;
        emeka: ActorInfo;
    };
    organizations: {
        platform: { name: string; type: string; id: string };
        developer: { name: string; type: string; id: string };
        bank: { name: string; type: string; id: string };
    };
    property: {
        id: string;
        title: string;
        variantId: string;
        variantName: string;
        unitId: string;
        unitNumber: string;
        price: number;
    };
    paymentMethod: { id: string; name: string; phases: number };
    steps: Array<{ step: string; status: string; detail?: string }>;
}

const PROPERTY_PRICE = 75_000_000; // ₦75M
const DOWNPAYMENT_PERCENT = 10;

// =============================================================================
// Environment
// =============================================================================

const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL;
const MORTGAGE_SERVICE_URL = process.env.MORTGAGE_SERVICE_URL;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL;
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET || 'local-bootstrap-secret';

function validateEnv() {
    const missing: string[] = [];
    if (!USER_SERVICE_URL) missing.push('USER_SERVICE_URL');
    if (!PROPERTY_SERVICE_URL) missing.push('PROPERTY_SERVICE_URL');
    if (!MORTGAGE_SERVICE_URL) missing.push('MORTGAGE_SERVICE_URL');
    if (!PAYMENT_SERVICE_URL) missing.push('PAYMENT_SERVICE_URL');
    if (missing.length > 0) {
        throw new Error(
            `Missing env vars: ${missing.join(', ')}\nRun with: ./scripts/run-demo-bootstrap.sh`,
        );
    }
}

validateEnv();

// =============================================================================
// HTTP helpers — lightweight, no supertest needed
// =============================================================================

async function fetchJson(
    url: string,
    options: RequestInit = {},
): Promise<{ status: number; data: any }> {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text.substring(0, 500) };
    }
    return { status: res.status, data };
}

function authHeaders(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function idempotencyKey(op: string): string {
    return `${randomUUID()}:${op}`;
}

function mockS3Url(folder: string, fileName: string): string {
    return `https://qshelter-uploads-staging.s3.amazonaws.com/${folder}/${randomUUID()}/${fileName}`;
}

async function login(email: string): Promise<string> {
    const res = await fetchJson(`${USER_SERVICE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password' }),
    });
    if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
    return res.data.data.accessToken;
}

// =============================================================================
// Test state
// =============================================================================

let env: BootstrapResult;

// Phase IDs — populated in "Emeka creates application"
let applicationId: string;
let prequalificationPhaseId: string;
let salesOfferPhaseId: string;
let kycPhaseId: string;
let downpaymentPhaseId: string;
let mortgageOfferPhaseId: string;

// Tokens — refreshed as needed
let adaezeToken: string;
let emekaToken: string;
let nnekaToken: string;
let eniolaToken: string;

const MORTGAGE_URL = MORTGAGE_SERVICE_URL!;
const PAYMENT_URL = PAYMENT_SERVICE_URL!;

// =============================================================================
// Bootstrap — runs once before all tests
// =============================================================================

describe('Demo Mortgage Flow', () => {
    beforeAll(async () => {
        console.log('\n🚀 Calling POST /admin/demo-bootstrap...\n');

        const res = await fetchJson(`${USER_SERVICE_URL}/admin/demo-bootstrap`, {
            method: 'POST',
            headers: {
                'x-bootstrap-secret': BOOTSTRAP_SECRET,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                propertyServiceUrl: PROPERTY_SERVICE_URL,
                mortgageServiceUrl: MORTGAGE_SERVICE_URL,
                paymentServiceUrl: PAYMENT_SERVICE_URL,
            }),
        });

        if (res.status !== 201) {
            console.error('Demo bootstrap failed:', JSON.stringify(res.data, null, 2));
            throw new Error(`Demo bootstrap failed with status ${res.status}`);
        }

        env = res.data as BootstrapResult;

        // Print step log
        for (const step of env.steps) {
            console.log(`  ✅ ${step.step}${step.detail ? ` — ${step.detail}` : ''}`);
        }

        console.log(`\n✅ Bootstrap complete. Tenant: ${env.tenantId}`);
        console.log(`   Property: ${env.property.title} (${env.property.unitNumber})`);
        console.log(`   Payment method: ${env.paymentMethod.name} (${env.paymentMethod.phases} phases)\n`);

        // Set tokens from bootstrap result
        adaezeToken = env.actors.adaeze.token;
        emekaToken = env.actors.emeka.token;
        nnekaToken = env.actors.nneka.token;
        eniolaToken = env.actors.eniola.token;
    }, 180_000); // 3 min timeout for full setup

    // =========================================================================
    // Verify bootstrap results
    // =========================================================================

    describe('Bootstrap Verification', () => {
        it('created 5 actors with valid IDs', () => {
            expect(env.actors.adaeze.id).toBeDefined();
            expect(env.actors.yinka.id).toBeDefined();
            expect(env.actors.nneka.id).toBeDefined();
            expect(env.actors.eniola.id).toBeDefined();
            expect(env.actors.emeka.id).toBeDefined();
        });

        it('created 3 organizations', () => {
            expect(env.organizations.platform.id).toBeDefined();
            expect(env.organizations.developer.id).toBeDefined();
            expect(env.organizations.bank.id).toBeDefined();
        });

        it('created property with variant and unit', () => {
            expect(env.property.id).toBeDefined();
            expect(env.property.variantId).toBeDefined();
            expect(env.property.unitId).toBeDefined();
            expect(env.property.price).toBe(PROPERTY_PRICE);
        });

        it('created MREIF payment method with 5 phases', () => {
            expect(env.paymentMethod.id).toBeDefined();
            expect(env.paymentMethod.phases).toBe(5);
        });
    });

    // =========================================================================
    // Phase 1: Create Application
    // =========================================================================

    describe('Phase 1: Create Application', () => {
        it('Emeka creates a mortgage application', async () => {
            const res = await fetchJson(`${MORTGAGE_URL}/applications`, {
                method: 'POST',
                headers: { ...authHeaders(emekaToken), 'x-idempotency-key': idempotencyKey('create-app') },
                body: JSON.stringify({
                    propertyUnitId: env.property.unitId,
                    paymentMethodId: env.paymentMethod.id,
                    title: 'Purchase Agreement - Sunrise Heights A-201',
                    applicationType: 'MORTGAGE',
                    totalAmount: PROPERTY_PRICE,
                    monthlyIncome: 2_500_000,
                    monthlyExpenses: 800_000,
                    applicantAge: 35,
                }),
            });

            if (res.status !== 201) {
                console.log('Application creation failed:', res.status, JSON.stringify(res.data, null, 2));
            }
            expect(res.status).toBe(201);
            expect(res.data.success).toBe(true);
            expect(res.data.data.phases).toHaveLength(5);
            expect(res.data.data.status).toBe('PENDING');

            applicationId = res.data.data.id;
            const phases = res.data.data.phases;
            prequalificationPhaseId = phases.find((p: any) => p.order === 1).id;
            salesOfferPhaseId = phases.find((p: any) => p.order === 2).id;
            kycPhaseId = phases.find((p: any) => p.order === 3).id;
            downpaymentPhaseId = phases.find((p: any) => p.order === 4).id;
            mortgageOfferPhaseId = phases.find((p: any) => p.order === 5).id;
        });

        it('Developer is auto-bound to the application', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/organizations`,
                { headers: authHeaders(adaezeToken) },
            );

            expect(res.status).toBe(200);
            const devBinding = res.data.data.find(
                (b: any) => b.assignedAsType?.code === 'DEVELOPER',
            );
            expect(devBinding).toBeDefined();
            expect(devBinding.organizationId).toBe(env.organizations.developer.id);
        });

        it('Adaeze binds Access Bank as lender', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/organizations`,
                {
                    method: 'POST',
                    headers: { ...authHeaders(adaezeToken), 'x-idempotency-key': idempotencyKey('bind-bank') },
                    body: JSON.stringify({
                        organizationId: env.organizations.bank.id,
                        organizationTypeCode: 'BANK',
                        isPrimary: true,
                        slaHours: 48,
                    }),
                },
            );

            expect(res.status).toBe(201);
            expect(res.data.data.organizationId).toBe(env.organizations.bank.id);
        });

        it('Prequalification phase is auto-activated', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${prequalificationPhaseId}`,
                { headers: authHeaders(emekaToken) },
            );

            expect(res.status).toBe(200);
            expect(res.data.data.status).toBe('IN_PROGRESS');
        });
    });

    // =========================================================================
    // Phase 2: Prequalification
    // =========================================================================

    describe('Phase 2: Prequalification', () => {
        it('Emeka submits questionnaire answers', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${prequalificationPhaseId}/questionnaire/submit`,
                {
                    method: 'POST',
                    headers: { ...authHeaders(emekaToken), 'x-idempotency-key': idempotencyKey('submit-preq') },
                    body: JSON.stringify({
                        answers: [
                            { fieldName: 'employment_status', value: 'EMPLOYED' },
                            { fieldName: 'monthly_income', value: '2500000' },
                            { fieldName: 'years_employed', value: '5' },
                            { fieldName: 'existing_mortgage', value: 'NO' },
                            { fieldName: 'property_purpose', value: 'PRIMARY_RESIDENCE' },
                        ],
                    }),
                },
            );

            expect(res.status).toBe(200);
        });

        it('Adaeze approves prequalification', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${prequalificationPhaseId}/questionnaire/review`,
                {
                    method: 'POST',
                    headers: { ...authHeaders(adaezeToken), 'x-idempotency-key': idempotencyKey('approve-preq') },
                    body: JSON.stringify({
                        decision: 'APPROVE',
                        notes: 'Emeka meets all eligibility criteria.',
                    }),
                },
            );

            expect(res.status).toBe(200);
        });

        it('Sales Offer phase is now active', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${salesOfferPhaseId}`,
                { headers: authHeaders(emekaToken) },
            );

            expect(res.status).toBe(200);
            expect(res.data.data.status).toBe('IN_PROGRESS');
        });
    });

    // =========================================================================
    // Phase 3: Sales Offer
    // =========================================================================

    describe('Phase 3: Sales Offer', () => {
        it('Nneka (developer) uploads sales offer letter — auto-approved', async () => {
            nnekaToken = await login('nneka@mailsac.com');

            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${salesOfferPhaseId}/documents`,
                {
                    method: 'POST',
                    headers: { ...authHeaders(nnekaToken), 'x-idempotency-key': idempotencyKey('upload-sales-offer') },
                    body: JSON.stringify({
                        documentType: 'SALES_OFFER_LETTER',
                        url: mockS3Url('mortgage_docs', 'sales-offer-letter.pdf'),
                        fileName: 'sales-offer-letter.pdf',
                    }),
                },
            );

            expect(res.status).toBe(201);
        });

        it('KYC Documentation phase is now active', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${kycPhaseId}`,
                { headers: authHeaders(emekaToken) },
            );

            expect(res.status).toBe(200);
            expect(res.data.data.status).toBe('IN_PROGRESS');
        });
    });

    // =========================================================================
    // Phase 4: KYC Documentation (two-stage review)
    // =========================================================================

    describe('Phase 4: KYC Documentation', () => {
        it('Emeka uploads 4 customer documents', async () => {
            const docs = [
                { documentType: 'ID_CARD', fileName: 'emeka-id-card.pdf' },
                { documentType: 'BANK_STATEMENT', fileName: 'emeka-bank-statement.pdf' },
                { documentType: 'EMPLOYMENT_LETTER', fileName: 'emeka-employment-letter.pdf' },
                { documentType: 'PROOF_OF_ADDRESS', fileName: 'emeka-proof-of-address.pdf' },
            ];

            for (const doc of docs) {
                const res = await fetchJson(
                    `${MORTGAGE_URL}/applications/${applicationId}/phases/${kycPhaseId}/documents`,
                    {
                        method: 'POST',
                        headers: { ...authHeaders(emekaToken), 'x-idempotency-key': idempotencyKey(`upload-${doc.documentType}`) },
                        body: JSON.stringify({
                            documentType: doc.documentType,
                            url: mockS3Url('kyc_documents', doc.fileName),
                            fileName: doc.fileName,
                        }),
                    },
                );
                expect(res.status).toBe(201);
            }
        });

        it('Current action: Admin should REVIEW, Customer should WAIT_FOR_REVIEW', async () => {
            // Admin perspective — all Stage 1 (CUSTOMER) docs uploaded → REVIEW
            adaezeToken = await login('adaeze@mailsac.com');
            const adminRes = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/current-action`,
                { headers: authHeaders(adaezeToken) },
            );

            expect(adminRes.status).toBe(200);
            const adminAction = adminRes.data.data;
            expect(adminAction.currentPhase.id).toBe(kycPhaseId);
            expect(adminAction.userPartyType).toBe('PLATFORM');
            expect(adminAction.actionRequired).toBe('REVIEW');
            expect(adminAction.partyActions?.PLATFORM?.action).toBe('REVIEW');
            console.log(`✅ Admin: ${adminAction.actionRequired} — ${adminAction.actionMessage}`);

            // Customer perspective — waiting for review
            const custRes = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/current-action`,
                { headers: authHeaders(emekaToken) },
            );

            expect(custRes.status).toBe(200);
            const custAction = custRes.data.data;
            expect(custAction.actionRequired).toBe('WAIT_FOR_REVIEW');
            console.log(`✅ Customer: ${custAction.actionRequired}`);

            // Bank perspective — waiting for Stage 2
            eniolaToken = await login('eniola@mailsac.com');
            const bankRes = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/current-action`,
                { headers: authHeaders(eniolaToken) },
            );

            expect(bankRes.status).toBe(200);
            const bankAction = bankRes.data.data;
            expect(bankAction.partyActions?.BANK?.action).toBe('WAIT');
            console.log(`✅ Bank: WAIT (Stage 2 not active yet)`);
        });

        it('Adaeze (Stage 1 — PLATFORM) approves all customer documents', async () => {
            const docsRes = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${kycPhaseId}/documents`,
                { headers: authHeaders(adaezeToken) },
            );

            expect(docsRes.status).toBe(200);

            const customerDocs = docsRes.data.data.filter(
                (d: any) => ['ID_CARD', 'BANK_STATEMENT', 'EMPLOYMENT_LETTER', 'PROOF_OF_ADDRESS'].includes(d.documentType),
            );
            expect(customerDocs.length).toBe(4);

            for (const doc of customerDocs) {
                const res = await fetchJson(
                    `${MORTGAGE_URL}/applications/${applicationId}/documents/${doc.id}/review`,
                    {
                        method: 'POST',
                        headers: { ...authHeaders(adaezeToken), 'x-idempotency-key': idempotencyKey(`approve-${doc.documentType}`) },
                        body: JSON.stringify({
                            status: 'APPROVED',
                            organizationTypeCode: 'PLATFORM',
                            comment: `Verified: ${doc.documentType}`,
                        }),
                    },
                );
                expect(res.status).toBe(200);
            }
        });

        it('Eniola (Stage 2 — BANK) uploads preapproval letter — auto-approved', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${kycPhaseId}/documents`,
                {
                    method: 'POST',
                    headers: { ...authHeaders(eniolaToken), 'x-idempotency-key': idempotencyKey('upload-preapproval') },
                    body: JSON.stringify({
                        documentType: 'PREAPPROVAL_LETTER',
                        url: mockS3Url('mortgage_docs', 'preapproval-letter.pdf'),
                        fileName: 'preapproval-letter.pdf',
                    }),
                },
            );

            expect(res.status).toBe(201);
        });

        it('KYC phase is now COMPLETED', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${kycPhaseId}`,
                { headers: authHeaders(emekaToken) },
            );

            expect(res.status).toBe(200);
            expect(res.data.data.status).toBe('COMPLETED');
        });
    });

    // =========================================================================
    // Phase 5: Downpayment (event-based flow)
    // =========================================================================

    describe('Phase 5: 10% Downpayment', () => {
        const downpaymentAmount = Math.round(PROPERTY_PRICE * DOWNPAYMENT_PERCENT / 100);
        let walletId: string;

        it('Downpayment phase is now active', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${downpaymentPhaseId}`,
                { headers: authHeaders(emekaToken) },
            );

            expect(res.status).toBe(200);
            expect(res.data.data.status).toBe('IN_PROGRESS');
        });

        it('Emeka creates a wallet', async () => {
            const createRes = await fetchJson(`${PAYMENT_URL}/wallets/me`, {
                method: 'POST',
                headers: { ...authHeaders(emekaToken), 'x-idempotency-key': idempotencyKey('create-wallet') },
                body: JSON.stringify({ currency: 'NGN' }),
            });

            if (createRes.status === 409 || createRes.status === 400) {
                // Wallet already exists
                const getRes = await fetchJson(`${PAYMENT_URL}/wallets/me`, {
                    headers: authHeaders(emekaToken),
                });
                expect(getRes.status).toBe(200);
                walletId = getRes.data.data.id;
            } else {
                expect([200, 201]).toContain(createRes.status);
                walletId = createRes.data.data.id;
            }
            expect(walletId).toBeDefined();
        });

        it('Admin generates downpayment installments', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${downpaymentPhaseId}/installments`,
                {
                    method: 'POST',
                    headers: { ...authHeaders(adaezeToken), 'x-idempotency-key': idempotencyKey('gen-installments') },
                    body: JSON.stringify({ startDate: new Date().toISOString() }),
                },
            );

            // 200 or 400 (already generated) are both acceptable
            expect([200, 400]).toContain(res.status);
        });

        it('Admin credits wallet → triggers auto-allocation', async () => {
            const res = await fetchJson(`${PAYMENT_URL}/wallets/${walletId}/credit`, {
                method: 'POST',
                headers: { ...authHeaders(adaezeToken), 'x-idempotency-key': idempotencyKey('credit-downpayment') },
                body: JSON.stringify({
                    amount: downpaymentAmount,
                    reference: `DOWNPAYMENT-${randomUUID().slice(0, 8)}`,
                    description: 'Downpayment for Sunrise Heights A-201',
                    source: 'manual',
                }),
            });

            expect(res.status).toBe(200);
        });

        it('Downpayment phase completes (event-driven, polling)', async () => {
            const maxWaitMs = 30_000;
            const pollMs = 2_000;
            const start = Date.now();
            let status = 'IN_PROGRESS';

            while (Date.now() - start < maxWaitMs) {
                const res = await fetchJson(
                    `${MORTGAGE_URL}/applications/${applicationId}/phases/${downpaymentPhaseId}`,
                    { headers: authHeaders(emekaToken) },
                );
                if (res.status === 200) {
                    status = res.data.data.status;
                    if (status === 'COMPLETED') break;
                }
                await new Promise((r) => setTimeout(r, pollMs));
            }

            expect(status).toBe('COMPLETED');
        }, 35_000);
    });

    // =========================================================================
    // Phase 6: Mortgage Offer (event-activated)
    // =========================================================================

    describe('Phase 6: Mortgage Offer', () => {
        it('Mortgage offer phase activates (polling)', async () => {
            const maxWaitMs = 15_000;
            const pollMs = 2_000;
            const start = Date.now();
            let status = 'PENDING';

            while (Date.now() - start < maxWaitMs) {
                const res = await fetchJson(
                    `${MORTGAGE_URL}/applications/${applicationId}/phases/${mortgageOfferPhaseId}`,
                    { headers: authHeaders(emekaToken) },
                );
                if (res.status === 200) {
                    status = res.data.data.status;
                    if (status === 'IN_PROGRESS') break;
                }
                await new Promise((r) => setTimeout(r, pollMs));
            }

            expect(status).toBe('IN_PROGRESS');
        }, 20_000);

        it('Eniola (bank) uploads mortgage offer letter — auto-approved', async () => {
            eniolaToken = await login('eniola@mailsac.com');

            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}/phases/${mortgageOfferPhaseId}/documents`,
                {
                    method: 'POST',
                    headers: { ...authHeaders(eniolaToken), 'x-idempotency-key': idempotencyKey('upload-mortgage-offer') },
                    body: JSON.stringify({
                        documentType: 'MORTGAGE_OFFER_LETTER',
                        url: mockS3Url('mortgage_docs', 'mortgage-offer-letter.pdf'),
                        fileName: 'mortgage-offer-letter.pdf',
                    }),
                },
            );

            expect(res.status).toBe(201);
        });

        it('Application is COMPLETED 🎉', async () => {
            const res = await fetchJson(
                `${MORTGAGE_URL}/applications/${applicationId}`,
                { headers: authHeaders(emekaToken) },
            );

            expect(res.status).toBe(200);
            expect(res.data.data.status).toBe('COMPLETED');
            console.log('\n🎉 Full mortgage flow completed successfully!\n');
        });
    });
});

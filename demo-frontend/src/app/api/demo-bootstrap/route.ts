import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { randomUUID } from 'crypto';

// =============================================================================
// Types
// =============================================================================

interface StepResult {
    step: string;
    status: 'success' | 'error';
    detail?: string;
}

interface DemoBootstrapResult {
    success: boolean;
    steps: StepResult[];
    summary?: {
        tenantId: string;
        actors: Array<{ name: string; email: string; role: string; id: string }>;
        organizations: Array<{ name: string; type: string; status: string; id: string }>;
        property: { title: string; id: string; variant: string; unit: string };
        paymentMethod: { name: string; id: string; phases: number };
    };
    error?: string;
}

// =============================================================================
// Constants — mirrors tests/aws/demo-mortgage-flow/demo-bootstrap.test.ts
// =============================================================================

const TENANT_NAME = 'QShelter Demo';
const TENANT_SUBDOMAIN = 'qshelter-demo';
const PROPERTY_PRICE = 75_000_000; // ₦75M
const DOWNPAYMENT_PERCENT = 10;

// =============================================================================
// Helpers
// =============================================================================

function idempotencyKey(op: string): string {
    return `${randomUUID()}:${op}`;
}

function mockS3Url(folder: string, fileName: string): string {
    return `https://qshelter-uploads-staging.s3.amazonaws.com/${folder}/${randomUUID()}/${fileName}`;
}

async function fetchJson(
    url: string,
    options: RequestInit,
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

function adminHeaders(bootstrapSecret: string): Record<string, string> {
    return { 'x-bootstrap-secret': bootstrapSecret, 'Content-Type': 'application/json' };
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
            return 50_000_000_000;
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
// Onboarding completion helper
// =============================================================================

async function completeOnboarding(
    orgId: string,
    adminToken: string,
    onboarderToken: string,
): Promise<void> {
    const { data: onbData } = await fetchJson(
        `${env.userServiceUrl}/organizations/${orgId}/onboarding`,
        { headers: authHeaders(adminToken) },
    );
    const onboarding = onbData.data;
    const sortedPhases = [...onboarding.phases].sort((a: any, b: any) => a.order - b.order);

    for (const phase of sortedPhases) {
        if (phase.status === 'COMPLETED') continue;

        if (phase.phaseCategory === 'QUESTIONNAIRE' && phase.questionnairePhase) {
            const fields = phase.questionnairePhase.fields;
            const fieldsToSubmit = fields.map((f: any) => ({
                fieldId: f.id,
                value: generateFieldValue(f),
            }));

            const { status } = await fetchJson(
                `${env.userServiceUrl}/organizations/${orgId}/onboarding/phases/${phase.id}/questionnaire`,
                {
                    method: 'POST',
                    headers: authHeaders(onboarderToken),
                    body: JSON.stringify({ fields: fieldsToSubmit }),
                },
            );
            if (status !== 200) throw new Error(`Questionnaire submit failed (${status})`);
        } else if (phase.phaseCategory === 'DOCUMENTATION' && phase.documentationPhase) {
            const snapshot = phase.documentationPhase.documentDefinitionsSnapshot || [];
            const requiredDocs = Array.isArray(snapshot) ? snapshot.filter((d: any) => d.isRequired) : [];

            for (const doc of requiredDocs) {
                const { status } = await fetchJson(
                    `${env.userServiceUrl}/organizations/${orgId}/onboarding/phases/${phase.id}/documents`,
                    {
                        method: 'POST',
                        headers: authHeaders(onboarderToken),
                        body: JSON.stringify({
                            documentType: doc.documentType,
                            url: mockS3Url('onboarding_docs', `${doc.documentType.toLowerCase()}.pdf`),
                            fileName: `${doc.documentName || doc.documentType}.pdf`,
                        }),
                    },
                );
                if (status !== 201) throw new Error(`Doc upload "${doc.documentType}" failed (${status})`);
            }
        } else if (phase.phaseCategory === 'GATE' && phase.gatePhase) {
            const { status } = await fetchJson(
                `${env.userServiceUrl}/organizations/${orgId}/onboarding/phases/${phase.id}/gate/review`,
                {
                    method: 'POST',
                    headers: authHeaders(adminToken),
                    body: JSON.stringify({ decision: 'APPROVED', notes: 'Auto-approved by demo bootstrap.' }),
                },
            );
            if (status !== 200) throw new Error(`Gate review failed (${status})`);
        }
    }
}

// =============================================================================
// Verify user email helper
// =============================================================================

async function verifyUserEmail(userId: string, bootstrapSecret: string): Promise<void> {
    const { data: userData } = await fetchJson(
        `${env.userServiceUrl}/admin/users/${userId}`,
        { headers: adminHeaders(bootstrapSecret) },
    );
    const { emailVerificationToken, emailVerifiedAt } = userData.data;
    if (emailVerifiedAt) return;
    if (!emailVerificationToken) return;

    await fetchJson(
        `${env.userServiceUrl}/auth/verify-email?token=${emailVerificationToken}`,
        { headers: { 'Content-Type': 'application/json' } },
    );
}

// =============================================================================
// Main handler
// =============================================================================

export async function POST(request: NextRequest) {
    const bootstrapSecret = request.headers.get('X-Bootstrap-Secret');
    if (!bootstrapSecret) {
        return NextResponse.json(
            { success: false, error: 'Bootstrap secret is required' },
            { status: 400 },
        );
    }

    const steps: StepResult[] = [];
    const log = (step: string, detail?: string) => {
        steps.push({ step, status: 'success', detail });
    };

    try {
        // =====================================================================
        // Step 1: Reset database
        // =====================================================================
        const resetRes = await fetchJson(`${env.userServiceUrl}/admin/reset`, {
            method: 'POST',
            headers: adminHeaders(bootstrapSecret),
        });
        if (resetRes.status !== 200) throw new Error(`Reset failed: ${resetRes.status}`);
        log('Reset database', `Deleted ${resetRes.data.totalDeleted} records`);

        // =====================================================================
        // Step 2: Bootstrap tenant with Adaeze as admin
        // =====================================================================
        const bootstrapRes = await fetchJson(`${env.userServiceUrl}/admin/bootstrap-tenant`, {
            method: 'POST',
            headers: adminHeaders(bootstrapSecret),
            body: JSON.stringify({
                tenant: { name: TENANT_NAME, subdomain: TENANT_SUBDOMAIN },
                admin: { email: 'adaeze@mailsac.com', password: 'password', firstName: 'Adaeze', lastName: 'Okonkwo' },
            }),
        });
        if (bootstrapRes.status !== 201) throw new Error(`Bootstrap failed: ${bootstrapRes.status} — ${JSON.stringify(bootstrapRes.data)}`);

        const tenantId = bootstrapRes.data.tenant.id;
        const adminId = bootstrapRes.data.admin.id;
        const roles = bootstrapRes.data.roles as Array<{ id: string; name: string }>;
        const mortgageOpsRoleId = roles.find((r) => r.name === 'mortgage_ops')!.id;
        const agentRoleId = roles.find((r) => r.name === 'agent')!.id;
        log('Bootstrap tenant', `Tenant: ${tenantId}, Admin: ${adminId}`);

        // Wait for admin policy to sync to DynamoDB
        await new Promise((r) => setTimeout(r, 3000));

        // =====================================================================
        // Step 3: Admin login
        // =====================================================================
        const loginRes = await fetchJson(`${env.userServiceUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'adaeze@mailsac.com', password: 'password' }),
        });
        if (loginRes.status !== 200) throw new Error(`Admin login failed: ${loginRes.status}`);
        let adminToken = loginRes.data.data.accessToken;
        log('Admin login');

        // =====================================================================
        // Step 4: Find platform org
        // =====================================================================
        const orgsRes = await fetchJson(`${env.userServiceUrl}/organizations`, {
            headers: authHeaders(adminToken),
        });
        if (orgsRes.status !== 200) throw new Error(`Get orgs failed: ${orgsRes.status}`);
        const orgs = orgsRes.data.data.items || orgsRes.data.data;
        const platformOrg = orgs.find((o: any) => o.isPlatformOrg === true);
        if (!platformOrg) throw new Error('Platform org not found');
        const platformOrgId = platformOrg.id;
        log('Find platform org', platformOrg.name);

        // =====================================================================
        // Step 5: Invite Yinka (mortgage_ops) to platform org
        // =====================================================================
        const inviteYinkaRes = await fetchJson(
            `${env.userServiceUrl}/organizations/${platformOrgId}/invitations`,
            {
                method: 'POST',
                headers: { ...authHeaders(adminToken), 'x-idempotency-key': idempotencyKey('invite-yinka') },
                body: JSON.stringify({
                    email: 'yinka@mailsac.com',
                    firstName: 'Yinka',
                    lastName: 'Adewale',
                    roleId: mortgageOpsRoleId,
                    title: 'Mortgage Operations Manager',
                    department: 'Mortgage Operations',
                }),
            },
        );
        if (inviteYinkaRes.status !== 201) throw new Error(`Invite Yinka failed: ${inviteYinkaRes.status}`);

        const acceptYinkaRes = await fetchJson(
            `${env.userServiceUrl}/invitations/accept?token=${inviteYinkaRes.data.data.token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: 'password' }),
            },
        );
        if (acceptYinkaRes.status !== 200) throw new Error(`Accept Yinka failed: ${acceptYinkaRes.status}`);
        const yinkaId = acceptYinkaRes.data.data.user.id;
        let yinkaToken = acceptYinkaRes.data.data.accessToken;
        log('Create Yinka (mortgage_ops)', yinkaId);

        // Wait for mortgage_ops policy
        await new Promise((r) => setTimeout(r, 2000));

        // =====================================================================
        // Step 6: Create Lekki Gardens (DEVELOPER) + onboarding
        // =====================================================================
        const createDevRes = await fetchJson(`${env.userServiceUrl}/organizations`, {
            method: 'POST',
            headers: { ...authHeaders(adminToken), 'x-idempotency-key': idempotencyKey('create-lekki') },
            body: JSON.stringify({
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
            }),
        });
        if (createDevRes.status !== 201) throw new Error(`Create Lekki Gardens failed: ${createDevRes.status}`);
        const developerOrgId = createDevRes.data.data.id;
        log('Create Lekki Gardens org', developerOrgId);

        // Ensure onboarding exists
        await fetchJson(`${env.userServiceUrl}/organizations/${developerOrgId}/onboarding`, {
            method: 'POST',
            headers: authHeaders(adminToken),
        });

        // Invite Nneka as agent + onboarder
        const inviteNnekaRes = await fetchJson(
            `${env.userServiceUrl}/organizations/${developerOrgId}/invitations`,
            {
                method: 'POST',
                headers: { ...authHeaders(adminToken), 'x-idempotency-key': idempotencyKey('invite-nneka') },
                body: JSON.stringify({
                    email: 'nneka@mailsac.com',
                    firstName: 'Nneka',
                    lastName: 'Obi',
                    roleId: agentRoleId,
                    title: 'Development Manager',
                    department: 'Development',
                    isOnboarder: true,
                }),
            },
        );
        if (inviteNnekaRes.status !== 201) throw new Error(`Invite Nneka failed: ${inviteNnekaRes.status}`);

        const acceptNnekaRes = await fetchJson(
            `${env.userServiceUrl}/invitations/accept?token=${inviteNnekaRes.data.data.token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: 'password' }),
            },
        );
        if (acceptNnekaRes.status !== 200) throw new Error(`Accept Nneka failed: ${acceptNnekaRes.status}`);
        const nnekaId = acceptNnekaRes.data.data.user.id;
        let nnekaToken = acceptNnekaRes.data.data.accessToken;
        log('Create Nneka (agent/onboarder)', nnekaId);

        // Wait for agent policy
        await new Promise((r) => setTimeout(r, 2000));

        // Complete developer onboarding
        await completeOnboarding(developerOrgId, adminToken, nnekaToken);
        log('Complete developer onboarding');

        // =====================================================================
        // Step 7: Create Access Bank (BANK) + onboarding
        // =====================================================================
        const createBankRes = await fetchJson(`${env.userServiceUrl}/organizations`, {
            method: 'POST',
            headers: { ...authHeaders(adminToken), 'x-idempotency-key': idempotencyKey('create-bank') },
            body: JSON.stringify({
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
            }),
        });
        if (createBankRes.status !== 201) throw new Error(`Create Access Bank failed: ${createBankRes.status}`);
        const bankOrgId = createBankRes.data.data.id;
        log('Create Access Bank org', bankOrgId);

        // Ensure onboarding exists
        await fetchJson(`${env.userServiceUrl}/organizations/${bankOrgId}/onboarding`, {
            method: 'POST',
            headers: authHeaders(adminToken),
        });

        // Invite Eniola as mortgage_ops + onboarder
        const inviteEniolaRes = await fetchJson(
            `${env.userServiceUrl}/organizations/${bankOrgId}/invitations`,
            {
                method: 'POST',
                headers: { ...authHeaders(adminToken), 'x-idempotency-key': idempotencyKey('invite-eniola') },
                body: JSON.stringify({
                    email: 'eniola@mailsac.com',
                    firstName: 'Eniola',
                    lastName: 'Adeyemi',
                    roleId: mortgageOpsRoleId,
                    title: 'Mortgage Operations Officer',
                    department: 'Mortgage Lending',
                    isOnboarder: true,
                }),
            },
        );
        if (inviteEniolaRes.status !== 201) throw new Error(`Invite Eniola failed: ${inviteEniolaRes.status}`);

        const acceptEniolaRes = await fetchJson(
            `${env.userServiceUrl}/invitations/accept?token=${inviteEniolaRes.data.data.token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: 'password' }),
            },
        );
        if (acceptEniolaRes.status !== 200) throw new Error(`Accept Eniola failed: ${acceptEniolaRes.status}`);
        const eniolaId = acceptEniolaRes.data.data.user.id;
        const eniolaToken = acceptEniolaRes.data.data.accessToken;
        log('Create Eniola (mortgage_ops/onboarder)', eniolaId);

        // Complete bank onboarding
        await completeOnboarding(bankOrgId, adminToken, eniolaToken);
        log('Complete bank onboarding');

        // =====================================================================
        // Step 8: Register Emeka (customer)
        // =====================================================================
        const signupRes = await fetchJson(`${env.userServiceUrl}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'emeka@mailsac.com',
                password: 'password',
                firstName: 'Emeka',
                lastName: 'Okoro',
                tenantId,
            }),
        });
        if (signupRes.status !== 201) throw new Error(`Emeka signup failed: ${signupRes.status}`);
        const emekaToken = signupRes.data.data.accessToken;
        const payload = JSON.parse(Buffer.from(emekaToken.split('.')[1], 'base64').toString());
        const emekaId = payload.sub;
        log('Register Emeka (customer)', emekaId);

        // Verify Emeka's email
        await verifyUserEmail(emekaId, bootstrapSecret);

        // =====================================================================
        // Step 9: Nneka creates property (Sunrise Heights)
        // =====================================================================
        // Refresh Nneka's token
        const nnekaLoginRes = await fetchJson(`${env.userServiceUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nneka@mailsac.com', password: 'password' }),
        });
        if (nnekaLoginRes.status !== 200) throw new Error(`Nneka login failed: ${nnekaLoginRes.status}`);
        nnekaToken = nnekaLoginRes.data.data.accessToken;

        const createPropRes = await fetchJson(`${env.propertyServiceUrl}/property/properties`, {
            method: 'POST',
            headers: authHeaders(nnekaToken),
            body: JSON.stringify({
                title: 'Sunrise Heights Estate',
                description: 'Premium residential estate in Lekki Phase 1, Lagos. Modern finishes, 24/7 security, swimming pool, gym.',
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: 'Nigeria',
                currency: 'NGN',
                city: 'Lagos',
                district: 'Lekki Phase 1',
                organizationId: developerOrgId,
            }),
        });
        if (createPropRes.status !== 201) throw new Error(`Property creation failed: ${createPropRes.status}`);
        const propertyId = createPropRes.data.data.id;
        log('Create property', 'Sunrise Heights Estate');

        // Add media
        const mediaRes = await fetchJson(
            `${env.propertyServiceUrl}/property/properties/${propertyId}/media`,
            {
                method: 'POST',
                headers: authHeaders(nnekaToken),
                body: JSON.stringify({
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
                }),
            },
        );
        if (mediaRes.status !== 201) throw new Error(`Media upload failed: ${mediaRes.status}`);

        // Set display image
        const displayImageId = mediaRes.data.data[0].id;
        await fetchJson(`${env.propertyServiceUrl}/property/properties/${propertyId}`, {
            method: 'PUT',
            headers: authHeaders(nnekaToken),
            body: JSON.stringify({ displayImageId }),
        });
        log('Add property media');

        // Create variant
        const variantRes = await fetchJson(
            `${env.propertyServiceUrl}/property/properties/${propertyId}/variants`,
            {
                method: 'POST',
                headers: authHeaders(nnekaToken),
                body: JSON.stringify({
                    name: '3-Bedroom Luxury Apartment',
                    nBedrooms: 3,
                    nBathrooms: 3,
                    nParkingSpots: 1,
                    area: 180,
                    price: PROPERTY_PRICE,
                    totalUnits: 24,
                    availableUnits: 20,
                }),
            },
        );
        if (variantRes.status !== 201) throw new Error(`Variant creation failed: ${variantRes.status}`);
        const variantId = variantRes.data.data.id;
        log('Create variant', `₦${PROPERTY_PRICE.toLocaleString()}`);

        // Create unit
        const unitRes = await fetchJson(
            `${env.propertyServiceUrl}/property/properties/${propertyId}/variants/${variantId}/units`,
            {
                method: 'POST',
                headers: authHeaders(nnekaToken),
                body: JSON.stringify({
                    unitNumber: 'A-201',
                    floorNumber: 2,
                    blockName: 'Block A',
                }),
            },
        );
        if (unitRes.status !== 201) throw new Error(`Unit creation failed: ${unitRes.status}`);
        const unitId = unitRes.data.data.id;
        log('Create unit', 'A-201');

        // Publish property
        const publishRes = await fetchJson(
            `${env.propertyServiceUrl}/property/properties/${propertyId}/publish`,
            {
                method: 'PATCH',
                headers: authHeaders(nnekaToken),
            },
        );
        if (publishRes.status !== 200) throw new Error(`Publish failed: ${publishRes.status}`);
        log('Publish property');

        // =====================================================================
        // Step 10: Create MREIF plans (Yinka — mortgage_ops)
        // =====================================================================
        // Refresh Yinka's token
        const yinkaLoginRes = await fetchJson(`${env.userServiceUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'yinka@mailsac.com', password: 'password' }),
        });
        if (yinkaLoginRes.status !== 200) throw new Error(`Yinka login failed: ${yinkaLoginRes.status}`);
        yinkaToken = yinkaLoginRes.data.data.accessToken;

        // Questionnaire plan
        const qPlanRes = await fetchJson(`${env.mortgageServiceUrl}/questionnaire-plans`, {
            method: 'POST',
            headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-preq-plan') },
            body: JSON.stringify({
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
            }),
        });
        if (qPlanRes.status !== 201) throw new Error(`Questionnaire plan failed: ${qPlanRes.status}`);
        const questionnairePlanId = qPlanRes.data.data.id;
        log('Create questionnaire plan');

        // Sales offer doc plan
        const salesDocRes = await fetchJson(`${env.mortgageServiceUrl}/documentation-plans`, {
            method: 'POST',
            headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-sales-offer-plan') },
            body: JSON.stringify({
                name: 'Sales Offer Documentation',
                description: 'Developer uploads sales offer letter for customer acceptance',
                isActive: true,
                documentDefinitions: [{
                    documentType: 'SALES_OFFER_LETTER',
                    documentName: 'Sales Offer Letter',
                    uploadedBy: 'DEVELOPER',
                    order: 1,
                    isRequired: true,
                    description: 'Sales offer letter prepared by the property developer',
                    maxSizeBytes: 10 * 1024 * 1024,
                    allowedMimeTypes: ['application/pdf'],
                }],
                approvalStages: [{
                    name: 'Developer Document Verification',
                    order: 1,
                    organizationTypeCode: 'DEVELOPER',
                    autoTransition: true,
                    waitForAllDocuments: true,
                    onRejection: 'CASCADE_BACK',
                }],
            }),
        });
        if (salesDocRes.status !== 201) throw new Error(`Sales offer plan failed: ${salesDocRes.status}`);
        const salesOfferDocPlanId = salesDocRes.data.data.id;
        log('Create sales offer doc plan');

        // Preapproval doc plan
        const preapprovalDocRes = await fetchJson(`${env.mortgageServiceUrl}/documentation-plans`, {
            method: 'POST',
            headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-preapproval-plan') },
            body: JSON.stringify({
                name: 'MREIF Preapproval Documentation',
                description: 'Customer uploads documents for QShelter and bank review',
                isActive: true,
                documentDefinitions: [
                    { documentType: 'ID_CARD', documentName: 'Valid Government ID', uploadedBy: 'CUSTOMER', order: 1, isRequired: true, description: 'National ID, passport, or driver\'s license', maxSizeBytes: 5 * 1024 * 1024, allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'] },
                    { documentType: 'BANK_STATEMENT', documentName: 'Bank Statement (6 months)', uploadedBy: 'CUSTOMER', order: 2, isRequired: true, description: 'Last 6 months bank statement', maxSizeBytes: 10 * 1024 * 1024, allowedMimeTypes: ['application/pdf'] },
                    { documentType: 'EMPLOYMENT_LETTER', documentName: 'Employment Confirmation Letter', uploadedBy: 'CUSTOMER', order: 3, isRequired: true, description: 'Letter from employer confirming employment', maxSizeBytes: 5 * 1024 * 1024, allowedMimeTypes: ['application/pdf'] },
                    { documentType: 'PROOF_OF_ADDRESS', documentName: 'Proof of Address', uploadedBy: 'CUSTOMER', order: 4, isRequired: true, description: 'Utility bill or official letter', maxSizeBytes: 5 * 1024 * 1024, allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'] },
                    { documentType: 'PREAPPROVAL_LETTER', documentName: 'Bank Preapproval Letter', uploadedBy: 'LENDER', order: 5, isRequired: true, description: 'Preapproval letter from partner bank', maxSizeBytes: 10 * 1024 * 1024, allowedMimeTypes: ['application/pdf'] },
                ],
                approvalStages: [
                    { name: 'QShelter Staff Review', order: 1, organizationTypeCode: 'PLATFORM', autoTransition: false, waitForAllDocuments: true, onRejection: 'CASCADE_BACK' },
                    { name: 'Bank Review', order: 2, organizationTypeCode: 'BANK', autoTransition: true, waitForAllDocuments: true, onRejection: 'CASCADE_BACK' },
                ],
            }),
        });
        if (preapprovalDocRes.status !== 201) throw new Error(`Preapproval plan failed: ${preapprovalDocRes.status}`);
        const preapprovalDocPlanId = preapprovalDocRes.data.data.id;
        log('Create preapproval doc plan');

        // Mortgage offer doc plan
        const mortgageOfferRes = await fetchJson(`${env.mortgageServiceUrl}/documentation-plans`, {
            method: 'POST',
            headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-mortgage-offer-plan') },
            body: JSON.stringify({
                name: 'Mortgage Offer Documentation',
                description: 'Bank uploads mortgage offer letter',
                isActive: true,
                documentDefinitions: [{
                    documentType: 'MORTGAGE_OFFER_LETTER',
                    documentName: 'Mortgage Offer Letter',
                    uploadedBy: 'LENDER',
                    order: 1,
                    isRequired: true,
                    description: 'Final mortgage offer from the bank',
                    maxSizeBytes: 10 * 1024 * 1024,
                    allowedMimeTypes: ['application/pdf'],
                }],
                approvalStages: [{
                    name: 'Bank Document Upload',
                    order: 1,
                    organizationTypeCode: 'BANK',
                    autoTransition: true,
                    waitForAllDocuments: true,
                    onRejection: 'CASCADE_BACK',
                }],
            }),
        });
        if (mortgageOfferRes.status !== 201) throw new Error(`Mortgage offer plan failed: ${mortgageOfferRes.status}`);
        const mortgageOfferDocPlanId = mortgageOfferRes.data.data.id;
        log('Create mortgage offer doc plan');

        // Payment plan
        const paymentPlanRes = await fetchJson(`${env.mortgageServiceUrl}/payment-plans`, {
            method: 'POST',
            headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-payment-plan') },
            body: JSON.stringify({
                name: 'MREIF 10% Downpayment',
                description: 'One-time 10% downpayment at 0% interest',
                frequency: 'ONE_TIME',
                numberOfInstallments: 1,
                interestRate: 0,
                lateFeePercentage: 0,
                gracePeriodDays: 14,
            }),
        });
        if (paymentPlanRes.status !== 201) throw new Error(`Payment plan failed: ${paymentPlanRes.status}`);
        const paymentPlanId = paymentPlanRes.data.data.id;
        log('Create payment plan');

        // =====================================================================
        // Step 11: Create MREIF payment method with 5 phases
        // =====================================================================
        const mreifRes = await fetchJson(`${env.mortgageServiceUrl}/payment-methods`, {
            method: 'POST',
            headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-mreif') },
            body: JSON.stringify({
                name: 'MREIF 10/90 Mortgage',
                description: 'Prequalification → Sales Offer → Preapproval Docs → 10% Downpayment → Mortgage Offer',
                requiresManualApproval: true,
                phases: [
                    { name: 'Prequalification', phaseCategory: 'QUESTIONNAIRE', phaseType: 'PRE_APPROVAL', order: 1, questionnairePlanId },
                    { name: 'Sales Offer', phaseCategory: 'DOCUMENTATION', phaseType: 'VERIFICATION', order: 2, documentationPlanId: salesOfferDocPlanId },
                    { name: 'Preapproval Documentation', phaseCategory: 'DOCUMENTATION', phaseType: 'KYC', order: 3, documentationPlanId: preapprovalDocPlanId },
                    { name: '10% Downpayment', phaseCategory: 'PAYMENT', phaseType: 'DOWNPAYMENT', order: 4, percentOfPrice: DOWNPAYMENT_PERCENT, paymentPlanId },
                    { name: 'Mortgage Offer', phaseCategory: 'DOCUMENTATION', phaseType: 'VERIFICATION', order: 5, documentationPlanId: mortgageOfferDocPlanId },
                ],
            }),
        });
        if (mreifRes.status !== 201) throw new Error(`MREIF creation failed: ${mreifRes.status}`);
        const paymentMethodId = mreifRes.data.data.id;
        const phaseCount = mreifRes.data.data.phases.length;
        log('Create MREIF payment method', `${phaseCount} phases`);

        // =====================================================================
        // Step 12: Link MREIF to property
        // =====================================================================
        const linkRes = await fetchJson(
            `${env.mortgageServiceUrl}/payment-methods/${paymentMethodId}/properties`,
            {
                method: 'POST',
                headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('link-mreif') },
                body: JSON.stringify({ propertyId, isDefault: true }),
            },
        );
        if (linkRes.status !== 201) throw new Error(`Link MREIF failed: ${linkRes.status}`);
        log('Link MREIF to property');

        // =====================================================================
        // Done — return summary
        // =====================================================================
        const result: DemoBootstrapResult = {
            success: true,
            steps,
            summary: {
                tenantId,
                actors: [
                    { name: 'Adaeze Okonkwo', email: 'adaeze@mailsac.com', role: 'admin', id: adminId },
                    { name: 'Yinka Adewale', email: 'yinka@mailsac.com', role: 'mortgage_ops', id: yinkaId },
                    { name: 'Nneka Obi', email: 'nneka@mailsac.com', role: 'agent', id: nnekaId },
                    { name: 'Eniola Adeyemi', email: 'eniola@mailsac.com', role: 'mortgage_ops', id: eniolaId },
                    { name: 'Emeka Okoro', email: 'emeka@mailsac.com', role: 'customer', id: emekaId },
                ],
                organizations: [
                    { name: platformOrg.name, type: 'PLATFORM', status: 'ACTIVE', id: platformOrgId },
                    { name: 'Lekki Gardens Development Company', type: 'DEVELOPER', status: 'ACTIVE', id: developerOrgId },
                    { name: 'Access Bank PLC', type: 'BANK', status: 'ACTIVE', id: bankOrgId },
                ],
                property: { title: 'Sunrise Heights Estate', id: propertyId, variant: '3-Bedroom Luxury Apartment', unit: 'A-201' },
                paymentMethod: { name: 'MREIF 10/90 Mortgage', id: paymentMethodId, phases: phaseCount },
            },
        };

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Demo Bootstrap] Error:', message);
        steps.push({ step: 'FAILED', status: 'error', detail: message });
        return NextResponse.json(
            { success: false, steps, error: message },
            { status: 500 },
        );
    }
}

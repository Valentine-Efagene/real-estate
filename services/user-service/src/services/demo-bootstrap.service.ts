/**
 * Demo Bootstrap Service
 *
 * Orchestrates the creation of a complete demo environment:
 * - Tenant + admin (Adaeze)
 * - Platform staff (Yinka — mortgage_ops)
 * - Developer org (Lekki Gardens) + agent (Nneka), onboarding completed
 * - Bank org (Access Bank) + mortgage_ops (Eniola), onboarding completed
 * - Customer (Emeka)
 * - Property (Sunrise Heights) with variant + unit, published
 * - MREIF 10/90 payment method (5 phases), linked to property
 *
 * User-service operations use internal service calls (fast, no HTTP overhead).
 * External services (property, mortgage, payment) use HTTP calls.
 */

import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { bootstrapService } from './bootstrap.service';
import { authService } from './auth.service';
import { organizationService } from './organization.service';
import { invitationService } from './invitation.service';
import { onboardingService } from './onboarding.service';

// =============================================================================
// Types
// =============================================================================

export interface DemoBootstrapInput {
    propertyServiceUrl: string;
    mortgageServiceUrl: string;
    paymentServiceUrl: string;
}

export interface ActorInfo {
    name: string;
    email: string;
    role: string;
    id: string;
    token: string;
}

export interface DemoBootstrapResult {
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
    qualificationFlow?: {
        developerFlowId: string;
        bankFlowId: string;
        developerGatePlanId: string;
        bankGatePlanId: string;
        developerAssignmentId: string;
        bankAssignmentId: string;
    };
    steps: StepLog[];
}

export interface StepLog {
    step: string;
    status: 'success' | 'error';
    detail?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TENANT_NAME = 'QShelter Demo';
const TENANT_SUBDOMAIN = 'qshelter-demo';
const PROPERTY_PRICE = 75_000_000; // ₦75M
const DOWNPAYMENT_PERCENT = 10;
const DEFAULT_PASSWORD = 'password';

// =============================================================================
// HTTP helpers — for external service calls
// =============================================================================

function mockS3Url(folder: string, fileName: string): string {
    return `https://qshelter-uploads-staging.s3.amazonaws.com/${folder}/${randomUUID()}/${fileName}`;
}

function idempotencyKey(op: string): string {
    return `${randomUUID()}:${op}`;
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

// =============================================================================
// Questionnaire value generator
// =============================================================================

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
// Internal onboarding completion (uses internal service, no HTTP)
// =============================================================================

async function completeOnboardingInternal(
    tenantId: string,
    orgId: string,
    adminId: string,
    onboarderId: string,
): Promise<void> {
    const onboarding = await onboardingService.getOnboarding(tenantId, orgId);
    const sortedPhases = [...onboarding.phases].sort((a: any, b: any) => a.order - b.order);

    for (const phase of sortedPhases) {
        if (phase.status === 'COMPLETED') continue;

        if (phase.phaseCategory === 'QUESTIONNAIRE' && phase.questionnairePhase) {
            const fields = phase.questionnairePhase.fields;
            const fieldsToSubmit = fields.map((f: any) => ({
                fieldId: f.id,
                value: generateFieldValue(f),
            }));

            await onboardingService.submitQuestionnaireFields(
                tenantId, orgId, phase.id, { fields: fieldsToSubmit },
            );
        } else if (phase.phaseCategory === 'DOCUMENTATION' && phase.documentationPhase) {
            const snapshot = phase.documentationPhase.documentDefinitionsSnapshot || [];
            const requiredDocs = Array.isArray(snapshot) ? snapshot.filter((d: any) => d.isRequired) : [];

            for (const rawDoc of requiredDocs) {
                const doc = rawDoc as any;
                await onboardingService.uploadOnboardingDocument(
                    tenantId, orgId, phase.id,
                    {
                        documentType: doc.documentType,
                        url: mockS3Url('onboarding_docs', `${doc.documentType.toLowerCase()}.pdf`),
                        fileName: `${doc.documentName || doc.documentType}.pdf`,
                    },
                    onboarderId,
                );
            }
        } else if (phase.phaseCategory === 'GATE' && phase.gatePhase) {
            await onboardingService.reviewGatePhase(
                tenantId, orgId, phase.id, adminId,
                { decision: 'APPROVED', notes: 'Auto-approved by demo bootstrap.' },
            );
        }
    }
}

// =============================================================================
// Main orchestrator
// =============================================================================

export async function runDemoBootstrap(
    input: DemoBootstrapInput,
): Promise<DemoBootstrapResult> {
    const { propertyServiceUrl, mortgageServiceUrl } = input;
    const steps: StepLog[] = [];
    const log = (step: string, detail?: string) => {
        steps.push({ step, status: 'success', detail });
        console.log(`[DemoBootstrap] ✅ ${step}${detail ? ` — ${detail}` : ''}`);
    };

    // =========================================================================
    // Step 1: Reset database
    // =========================================================================
    const deleteOrder = [
        'documentReview', 'documentApproval', 'approvalStageProgress',
        'questionnairePhaseReview', 'questionnaireField', 'applicationEvent',
        'paymentInstallment', 'applicationPayment', 'applicationDocument',
        'phaseEventAttachment', 'offerLetter',
        'applicationTermination', 'applicationRefund', 'approvalRequest',
        'workflowBlocker', 'domainEvent',
        'questionnairePhase', 'documentationPhase', 'paymentPhase',
        'applicationPhase', 'applicationOrganization',
        'application', 'paymentMethodChangeRequest', 'propertyTransferRequest',
        'propertyPaymentMethodPhase', 'propertyPaymentMethodLink',
        'documentRequirementRule', 'propertyUnit', 'propertyVariantAmenity',
        'propertyVariantMedia', 'propertyVariant', 'propertyAmenity',
        'propertyMedia', 'propertyDocument',
        'property', 'propertyPaymentMethod', 'paymentPlan',
        'documentDefinition', 'approvalStage', 'documentationPlan',
        'questionnairePlanQuestion', 'questionnairePlan', 'documentTemplate', 'amenity',
        'organizationDocumentWaiver', 'bankDocumentRequirement',
        'gatePhaseReview', 'gatePhase', 'qualificationPhase',
        'paymentMethodQualification', 'organizationPaymentMethod',
        'qualificationFlowPhase', 'paymentMethodQualificationConfig',
        'qualificationFlow', 'gatePlan',
        'organizationMemberRole', 'organizationMember', 'organization',
        'eventHandler', 'eventType', 'eventChannel', 'apiKey',
        'refreshToken', 'passwordReset', 'userSuspension', 'emailPreference',
        'deviceEndpoint', 'social', 'rolePermission', 'tenantMembershipRole', 'tenantMembership',
        'transaction', 'wallet',
        'user', 'permission', 'role', 'settings', 'oAuthState', 'tenant',
    ];
    let totalDeleted = 0;
    for (const table of deleteOrder) {
        try {
            const result = await (prisma as any)[table].deleteMany({});
            totalDeleted += result.count;
        } catch {
            // Table may not exist
        }
    }
    log('Reset database', `Deleted ${totalDeleted} records`);

    // =========================================================================
    // Step 2: Bootstrap tenant with Adaeze as admin
    // =========================================================================
    const bootstrapResult = await bootstrapService.bootstrapTenant({
        tenant: { name: TENANT_NAME, subdomain: TENANT_SUBDOMAIN },
        admin: { email: 'adaeze@mailsac.com', password: DEFAULT_PASSWORD, firstName: 'Adaeze', lastName: 'Okonkwo' },
    });

    const tenantId = bootstrapResult.tenant.id;
    const adminId = bootstrapResult.admin.id;
    const roles = bootstrapResult.roles as Array<{ id: string; name: string; isNew?: boolean }>;
    const mortgageOpsRoleId = roles.find((r) => r.name === 'mortgage_ops')!.id;
    const agentRoleId = roles.find((r) => r.name === 'agent')!.id;
    const lenderOpsRoleId = roles.find((r) => r.name === 'lender_ops')!.id;
    log('Bootstrap tenant', `Tenant: ${tenantId}, Admin: ${adminId}`);

    // =========================================================================
    // Step 3: Login admin (get token for external service calls)
    // =========================================================================
    const adminAuth = await authService.login({ email: 'adaeze@mailsac.com', password: DEFAULT_PASSWORD });
    let adminToken = adminAuth.accessToken;
    log('Admin login');

    // =========================================================================
    // Step 4: Find platform org
    // =========================================================================
    const platformOrg = await prisma.organization.findFirst({
        where: { tenantId, isPlatformOrg: true },
    });
    if (!platformOrg) throw new Error('Platform org not found after bootstrap');
    const platformOrgId = platformOrg.id;
    log('Find platform org', platformOrg.name);

    // =========================================================================
    // Step 5: Invite Yinka (mortgage_ops) to platform org
    // =========================================================================
    const yinkaInvitation = await invitationService.createInvitation(tenantId, adminId, {
        organizationId: platformOrgId,
        email: 'yinka@mailsac.com',
        firstName: 'Yinka',
        lastName: 'Adewale',
        roleId: mortgageOpsRoleId,
        title: 'Mortgage Operations Manager',
        department: 'Mortgage Operations',
    });
    const yinkaAccept = await invitationService.acceptInvitation(yinkaInvitation.token, DEFAULT_PASSWORD);
    const yinkaId = yinkaAccept.user.id;
    log('Create Yinka (mortgage_ops)', yinkaId);

    // =========================================================================
    // Step 6: Create Lekki Gardens (DEVELOPER) + onboarding
    // =========================================================================
    const devOrg = await organizationService.create(tenantId, {
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
    if (!devOrg) throw new Error('Developer org creation returned null');
    const developerOrgId = devOrg.id;
    log('Create Lekki Gardens org', developerOrgId);

    // Invite Nneka as agent + onboarder
    const nnekaInvitation = await invitationService.createInvitation(tenantId, adminId, {
        organizationId: developerOrgId,
        email: 'nneka@mailsac.com',
        firstName: 'Nneka',
        lastName: 'Obi',
        roleId: agentRoleId,
        title: 'Development Manager',
        department: 'Development',
        isOnboarder: true,
    });
    const nnekaAccept = await invitationService.acceptInvitation(nnekaInvitation.token, DEFAULT_PASSWORD);
    const nnekaId = nnekaAccept.user.id;
    log('Create Nneka (agent/onboarder)', nnekaId);

    // Complete developer onboarding
    await completeOnboardingInternal(tenantId, developerOrgId, adminId, nnekaId);
    log('Complete developer onboarding');

    // =========================================================================
    // Step 7: Create Access Bank (BANK) + onboarding
    // =========================================================================
    const bankOrg = await organizationService.create(tenantId, {
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
    if (!bankOrg) throw new Error('Bank org creation returned null');
    const bankOrgId = bankOrg.id;
    log('Create Access Bank org', bankOrgId);

    // Invite Eniola as lender_ops + onboarder
    const eniolaInvitation = await invitationService.createInvitation(tenantId, adminId, {
        organizationId: bankOrgId,
        email: 'eniola@mailsac.com',
        firstName: 'Eniola',
        lastName: 'Adeyemi',
        roleId: lenderOpsRoleId,
        title: 'Mortgage Operations Officer',
        department: 'Mortgage Lending',
        isOnboarder: true,
    });
    const eniolaAccept = await invitationService.acceptInvitation(eniolaInvitation.token, DEFAULT_PASSWORD);
    const eniolaId = eniolaAccept.user.id;
    log('Create Eniola (lender_ops/onboarder)', eniolaId);

    // Complete bank onboarding
    await completeOnboardingInternal(tenantId, bankOrgId, adminId, eniolaId);
    log('Complete bank onboarding');

    // =========================================================================
    // Step 8: Register Emeka (customer)
    // =========================================================================
    const emekaAuth = await authService.signup({
        email: 'emeka@mailsac.com',
        password: DEFAULT_PASSWORD,
        firstName: 'Emeka',
        lastName: 'Okoro',
        tenantId,
    });
    const emekaPayload = JSON.parse(Buffer.from(emekaAuth.accessToken.split('.')[1], 'base64').toString());
    const emekaId = emekaPayload.sub;
    log('Register Emeka (customer)', emekaId);

    // Verify Emeka's email directly via Prisma
    await prisma.user.update({
        where: { id: emekaId },
        data: { emailVerifiedAt: new Date(), isEmailVerified: true, emailVerificationToken: null },
    });
    log('Verify Emeka email');

    // =========================================================================
    // Step 9: Get fresh tokens for external API calls
    // =========================================================================
    const adaezeAuth = await authService.login({ email: 'adaeze@mailsac.com', password: DEFAULT_PASSWORD });
    adminToken = adaezeAuth.accessToken;

    const nnekaAuth = await authService.login({ email: 'nneka@mailsac.com', password: DEFAULT_PASSWORD });
    const nnekaToken = nnekaAuth.accessToken;

    const yinkaAuth = await authService.login({ email: 'yinka@mailsac.com', password: DEFAULT_PASSWORD });
    const yinkaToken = yinkaAuth.accessToken;

    const eniolaAuth = await authService.login({ email: 'eniola@mailsac.com', password: DEFAULT_PASSWORD });
    const eniolaToken = eniolaAuth.accessToken;

    const emekaAuth2 = await authService.login({ email: 'emeka@mailsac.com', password: DEFAULT_PASSWORD });
    const emekaToken = emekaAuth2.accessToken;

    log('Refresh all tokens');

    // =========================================================================
    // Step 10: Nneka creates property (HTTP → property-service)
    // =========================================================================
    const createPropRes = await fetchJson(`${propertyServiceUrl}/property/properties`, {
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
    if (createPropRes.status !== 201) throw new Error(`Property creation failed: ${createPropRes.status} — ${JSON.stringify(createPropRes.data)}`);
    const propertyId = createPropRes.data.data.id;
    log('Create property', 'Sunrise Heights Estate');

    // Add media
    const mediaRes = await fetchJson(
        `${propertyServiceUrl}/property/properties/${propertyId}/media`,
        {
            method: 'POST',
            headers: authHeaders(nnekaToken),
            body: JSON.stringify({
                media: [
                    { url: mockS3Url('property_pictures', 'exterior.jpg'), type: 'IMAGE', caption: 'Exterior View', order: 0 },
                    { url: mockS3Url('property_pictures', 'interior.jpg'), type: 'IMAGE', caption: 'Interior', order: 1 },
                ],
            }),
        },
    );
    if (mediaRes.status !== 201) throw new Error(`Media upload failed: ${mediaRes.status}`);

    // Set display image
    await fetchJson(`${propertyServiceUrl}/property/properties/${propertyId}`, {
        method: 'PUT',
        headers: authHeaders(nnekaToken),
        body: JSON.stringify({ displayImageId: mediaRes.data.data[0].id }),
    });
    log('Add property media');

    // Create variant
    const variantRes = await fetchJson(
        `${propertyServiceUrl}/property/properties/${propertyId}/variants`,
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
        `${propertyServiceUrl}/property/properties/${propertyId}/variants/${variantId}/units`,
        {
            method: 'POST',
            headers: authHeaders(nnekaToken),
            body: JSON.stringify({ unitNumber: 'A-201', floorNumber: 2, blockName: 'Block A' }),
        },
    );
    if (unitRes.status !== 201) throw new Error(`Unit creation failed: ${unitRes.status}`);
    const unitId = unitRes.data.data.id;
    log('Create unit', 'A-201');

    // Publish property
    const publishRes = await fetchJson(
        `${propertyServiceUrl}/property/properties/${propertyId}/publish`,
        { method: 'PATCH', headers: authHeaders(nnekaToken) },
    );
    if (publishRes.status !== 200) throw new Error(`Publish failed: ${publishRes.status}`);
    log('Publish property');

    // =========================================================================
    // Step 11: Create MREIF plans (HTTP → mortgage-service)
    // =========================================================================
    // Questionnaire plan
    const qPlanRes = await fetchJson(`${mortgageServiceUrl}/questionnaire-plans`, {
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
                    questionKey: 'employment_status', questionText: 'What is your employment status?',
                    questionType: 'SELECT', order: 1, isRequired: true, scoreWeight: 1, category: 'EMPLOYMENT',
                    options: [
                        { value: 'EMPLOYED', label: 'Employed', score: 100 },
                        { value: 'SELF_EMPLOYED', label: 'Self-Employed', score: 100 },
                        { value: 'RETIRED', label: 'Retired', score: 50 },
                        { value: 'UNEMPLOYED', label: 'Unemployed', score: 0 },
                    ],
                },
                {
                    questionKey: 'monthly_income', questionText: 'What is your monthly net income (₦)?',
                    questionType: 'CURRENCY', order: 2, isRequired: true, scoreWeight: 1, category: 'INCOME',
                    validationRules: { min: 0 },
                    scoringRules: [
                        { operator: 'GREATER_THAN', value: 500000, score: 100 },
                        { operator: 'LESS_THAN_OR_EQUAL', value: 500000, score: 50 },
                    ],
                },
                {
                    questionKey: 'years_employed', questionText: 'How many years at your current employer?',
                    questionType: 'NUMBER', order: 3, isRequired: true, scoreWeight: 1, category: 'EMPLOYMENT',
                    validationRules: { min: 0, max: 50 },
                    scoringRules: [
                        { operator: 'GREATER_THAN_OR_EQUAL', value: 2, score: 100 },
                        { operator: 'LESS_THAN', value: 2, score: 50 },
                    ],
                },
                {
                    questionKey: 'existing_mortgage', questionText: 'Do you have an existing mortgage?',
                    questionType: 'SELECT', order: 4, isRequired: true, scoreWeight: 1, category: 'CREDIT',
                    options: [
                        { value: 'NO', label: 'No', score: 100 },
                        { value: 'YES', label: 'Yes', score: 50 },
                    ],
                },
                {
                    questionKey: 'property_purpose', questionText: 'What is the purpose of this property?',
                    questionType: 'SELECT', order: 5, isRequired: true, scoreWeight: 1, category: 'PREFERENCES',
                    options: [
                        { value: 'PRIMARY_RESIDENCE', label: 'Primary Residence', score: 100 },
                        { value: 'INVESTMENT', label: 'Investment Property', score: 80 },
                        { value: 'VACATION', label: 'Vacation Home', score: 60 },
                    ],
                },
            ],
        }),
    });
    if (qPlanRes.status !== 201) throw new Error(`Questionnaire plan failed: ${qPlanRes.status}`);
    const questionnairePlanId = qPlanRes.data.data.id;
    log('Create questionnaire plan');

    // Sales offer doc plan
    const salesDocRes = await fetchJson(`${mortgageServiceUrl}/documentation-plans`, {
        method: 'POST',
        headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-sales-offer-plan') },
        body: JSON.stringify({
            name: 'Sales Offer Documentation',
            description: 'Developer uploads sales offer letter for customer acceptance',
            isActive: true,
            documentDefinitions: [{
                documentType: 'SALES_OFFER_LETTER', documentName: 'Sales Offer Letter',
                uploadedBy: 'DEVELOPER', autoApprove: true, order: 1, isRequired: true,
                description: 'Sales offer letter prepared by the property developer',
                maxSizeBytes: 10 * 1024 * 1024, allowedMimeTypes: ['application/pdf'],
            }],
            approvalStages: [{
                name: 'Developer Document Verification', order: 1,
                organizationTypeCode: 'DEVELOPER', autoTransition: true,
                waitForAllDocuments: true, onRejection: 'CASCADE_BACK',
            }],
        }),
    });
    if (salesDocRes.status !== 201) throw new Error(`Sales offer plan failed: ${salesDocRes.status}`);
    const salesOfferDocPlanId = salesDocRes.data.data.id;
    log('Create sales offer doc plan');

    // Preapproval doc plan (two-stage: PLATFORM then BANK)
    const preapprovalDocRes = await fetchJson(`${mortgageServiceUrl}/documentation-plans`, {
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
                { documentType: 'PREAPPROVAL_LETTER', documentName: 'Bank Preapproval Letter', uploadedBy: 'LENDER', autoApprove: true, order: 5, isRequired: true, description: 'Preapproval letter from partner bank', maxSizeBytes: 10 * 1024 * 1024, allowedMimeTypes: ['application/pdf'] },
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
    const mortgageOfferRes = await fetchJson(`${mortgageServiceUrl}/documentation-plans`, {
        method: 'POST',
        headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-mortgage-offer-plan') },
        body: JSON.stringify({
            name: 'Mortgage Offer Documentation',
            description: 'Bank uploads mortgage offer letter',
            isActive: true,
            documentDefinitions: [{
                documentType: 'MORTGAGE_OFFER_LETTER', documentName: 'Mortgage Offer Letter',
                uploadedBy: 'LENDER', autoApprove: true, order: 1, isRequired: true,
                description: 'Final mortgage offer from the bank',
                maxSizeBytes: 10 * 1024 * 1024, allowedMimeTypes: ['application/pdf'],
            }],
            approvalStages: [{
                name: 'Bank Document Upload', order: 1,
                organizationTypeCode: 'BANK', autoTransition: true,
                waitForAllDocuments: true, onRejection: 'CASCADE_BACK',
            }],
        }),
    });
    if (mortgageOfferRes.status !== 201) throw new Error(`Mortgage offer plan failed: ${mortgageOfferRes.status}`);
    const mortgageOfferDocPlanId = mortgageOfferRes.data.data.id;
    log('Create mortgage offer doc plan');

    // Payment plan
    const paymentPlanRes = await fetchJson(`${mortgageServiceUrl}/payment-plans`, {
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

    // =========================================================================
    // Step 12: Create MREIF payment method with 5 phases
    // =========================================================================
    const mreifRes = await fetchJson(`${mortgageServiceUrl}/payment-methods`, {
        method: 'POST',
        headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-mreif') },
        body: JSON.stringify({
            name: 'MREIF 10/90 Mortgage',
            description: 'Prequalification → Sales Offer → Preapproval Docs → 10% Downpayment → Mortgage Offer',
            requiresManualApproval: true,
            phases: [
                { name: 'Prequalification', phaseCategory: 'QUESTIONNAIRE', order: 1, questionnairePlanId },
                { name: 'Sales Offer', phaseCategory: 'DOCUMENTATION', order: 2, documentationPlanId: salesOfferDocPlanId },
                { name: 'Preapproval Documentation', phaseCategory: 'DOCUMENTATION', order: 3, documentationPlanId: preapprovalDocPlanId },
                { name: '10% Downpayment', phaseCategory: 'PAYMENT', order: 4, percentOfPrice: DOWNPAYMENT_PERCENT, paymentPlanId },
                { name: 'Mortgage Offer', phaseCategory: 'DOCUMENTATION', order: 5, documentationPlanId: mortgageOfferDocPlanId },
            ],
        }),
    });
    if (mreifRes.status !== 201) throw new Error(`MREIF creation failed: ${mreifRes.status}`);
    const paymentMethodId = mreifRes.data.data.id;
    const phaseCount = mreifRes.data.data.phases.length;
    log('Create MREIF payment method', `${phaseCount} phases`);

    // =========================================================================
    // Step 13: Create gate plans + qualification flows for MREIF
    // =========================================================================
    // Developer gate plan
    const devGatePlanRes = await fetchJson(`${mortgageServiceUrl}/gate-plans`, {
        method: 'POST',
        headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-dev-gate-plan') },
        body: JSON.stringify({
            name: 'Developer Access Approval',
            description: 'Platform team reviews and approves developer organizations for payment method access',
            requiredApprovals: 1,
            reviewerOrganizationTypeCode: 'PLATFORM',
            reviewerInstructions: 'Verify that the developer organization is a legitimate partner with valid credentials',
        }),
    });
    if (devGatePlanRes.status !== 201) throw new Error(`Dev gate plan creation failed: ${devGatePlanRes.status}`);
    const devGatePlanId = devGatePlanRes.data.data.id;
    log('Create developer gate plan', 'Developer Access Approval');

    // Bank gate plan
    const bankGatePlanRes = await fetchJson(`${mortgageServiceUrl}/gate-plans`, {
        method: 'POST',
        headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-bank-gate-plan') },
        body: JSON.stringify({
            name: 'Bank Access Approval',
            description: 'Platform team reviews and approves bank organizations for payment method access',
            requiredApprovals: 1,
            reviewerOrganizationTypeCode: 'PLATFORM',
            reviewerInstructions: 'Verify that the bank is an approved lending partner with valid banking license',
        }),
    });
    if (bankGatePlanRes.status !== 201) throw new Error(`Bank gate plan creation failed: ${bankGatePlanRes.status}`);
    const bankGatePlanId = bankGatePlanRes.data.data.id;
    log('Create bank gate plan', 'Bank Access Approval');

    // Developer qualification flow
    const devQualFlowRes = await fetchJson(`${mortgageServiceUrl}/qualification-flows`, {
        method: 'POST',
        headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-dev-qual-flow') },
        body: JSON.stringify({
            name: 'MREIF Developer Qualification',
            description: 'Simple platform approval gate for developer organizations to access the MREIF payment method',
            expiresInDays: 90,
            phases: [
                {
                    name: 'Platform Approval',
                    phaseCategory: 'GATE',
                    order: 1,
                    gatePlanId: devGatePlanId,
                },
            ],
        }),
    });
    if (devQualFlowRes.status !== 201) throw new Error(`Dev qualification flow creation failed: ${devQualFlowRes.status}`);
    const devQualFlowId = devQualFlowRes.data.data.id;
    log('Create developer qualification flow');

    // Bank qualification flow
    const bankQualFlowRes = await fetchJson(`${mortgageServiceUrl}/qualification-flows`, {
        method: 'POST',
        headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('create-bank-qual-flow') },
        body: JSON.stringify({
            name: 'MREIF Bank Qualification',
            description: 'Platform approval gate for banks to participate as lenders in the MREIF payment method',
            expiresInDays: 180,
            phases: [
                {
                    name: 'Platform Approval',
                    phaseCategory: 'GATE',
                    order: 1,
                    gatePlanId: bankGatePlanId,
                },
            ],
        }),
    });
    if (bankQualFlowRes.status !== 201) throw new Error(`Bank qualification flow creation failed: ${bankQualFlowRes.status}`);
    const bankQualFlowId = bankQualFlowRes.data.data.id;
    log('Create bank qualification flow');

    // =========================================================================
    // Step 14: Assign both qualification flows to MREIF (per org type)
    // =========================================================================
    const assignDevFlowRes = await fetchJson(
        `${mortgageServiceUrl}/payment-methods/${paymentMethodId}/qualification-flow`,
        {
            method: 'POST',
            headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('assign-dev-qual-flow') },
            body: JSON.stringify({ qualificationFlowId: devQualFlowId, organizationTypeCode: 'DEVELOPER' }),
        },
    );
    if (assignDevFlowRes.status !== 200) throw new Error(`Assign dev qualification flow failed: ${assignDevFlowRes.status}`);
    log('Assign developer qualification flow to MREIF', 'orgType=DEVELOPER');

    const assignBankFlowRes = await fetchJson(
        `${mortgageServiceUrl}/payment-methods/${paymentMethodId}/qualification-flow`,
        {
            method: 'POST',
            headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('assign-bank-qual-flow') },
            body: JSON.stringify({ qualificationFlowId: bankQualFlowId, organizationTypeCode: 'BANK' }),
        },
    );
    if (assignBankFlowRes.status !== 200) throw new Error(`Assign bank qualification flow failed: ${assignBankFlowRes.status}`);
    log('Assign bank qualification flow to MREIF', 'orgType=BANK');

    // =========================================================================
    // Step 15: Lekki Gardens applies for MREIF access
    // =========================================================================
    // Nneka (agent at Lekki Gardens) applies her organization for the payment method.
    const devApplyRes = await fetchJson(
        `${mortgageServiceUrl}/payment-methods/${paymentMethodId}/apply`,
        {
            method: 'POST',
            headers: { ...authHeaders(nnekaToken), 'x-idempotency-key': idempotencyKey('apply-mreif-dev') },
            body: JSON.stringify({
                organizationId: developerOrgId,
                notes: 'Lekki Gardens applying for MREIF 10/90 Mortgage access',
            }),
        },
    );
    if (devApplyRes.status !== 201) throw new Error(`Developer apply for MREIF failed: ${devApplyRes.status}`);
    const devAssignmentId = devApplyRes.data.data.id;
    const devGatePhaseId = devApplyRes.data.data.qualification?.phases?.[0]?.id;
    log('Lekki Gardens applies for MREIF', `assignmentId=${devAssignmentId}`);

    // =========================================================================
    // Step 16: Platform admin approves Lekki Gardens qualification
    // =========================================================================
    if (devGatePhaseId) {
        const reviewRes = await fetchJson(
            `${mortgageServiceUrl}/payment-methods/${paymentMethodId}/assignments/${devAssignmentId}/phases/${devGatePhaseId}/review`,
            {
                method: 'POST',
                headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('approve-dev-qual-gate') },
                body: JSON.stringify({
                    decision: 'APPROVED',
                    notes: 'Lekki Gardens is an approved developer partner',
                }),
            },
        );
        if (reviewRes.status !== 200) throw new Error(`Developer qualification gate review failed: ${reviewRes.status}`);
        log('Platform approves Lekki Gardens qualification', 'Status: QUALIFIED');
    } else {
        log('Developer qualification auto-approved (no gate phase)', 'Status: QUALIFIED');
    }

    // =========================================================================
    // Step 17: Access Bank applies for MREIF access
    // =========================================================================
    // Eniola (mortgage_ops at Access Bank) applies the bank for the payment method.
    const bankApplyRes = await fetchJson(
        `${mortgageServiceUrl}/payment-methods/${paymentMethodId}/apply`,
        {
            method: 'POST',
            headers: { ...authHeaders(eniolaToken), 'x-idempotency-key': idempotencyKey('apply-mreif-bank') },
            body: JSON.stringify({
                organizationId: bankOrgId,
                notes: 'Access Bank applying for MREIF 10/90 Mortgage lending participation',
            }),
        },
    );
    if (bankApplyRes.status !== 201) throw new Error(`Bank apply for MREIF failed: ${bankApplyRes.status}`);
    const bankAssignmentId = bankApplyRes.data.data.id;
    const bankGatePhaseId = bankApplyRes.data.data.qualification?.phases?.[0]?.id;
    log('Access Bank applies for MREIF', `assignmentId=${bankAssignmentId}`);

    // =========================================================================
    // Step 18: Platform admin approves Access Bank qualification
    // =========================================================================
    if (bankGatePhaseId) {
        const reviewRes = await fetchJson(
            `${mortgageServiceUrl}/payment-methods/${paymentMethodId}/assignments/${bankAssignmentId}/phases/${bankGatePhaseId}/review`,
            {
                method: 'POST',
                headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('approve-bank-qual-gate') },
                body: JSON.stringify({
                    decision: 'APPROVED',
                    notes: 'Access Bank is an approved lending partner',
                }),
            },
        );
        if (reviewRes.status !== 200) throw new Error(`Bank qualification gate review failed: ${reviewRes.status}`);
        log('Platform approves Access Bank qualification', 'Status: QUALIFIED');
    } else {
        log('Bank qualification auto-approved (no gate phase)', 'Status: QUALIFIED');
    }

    // =========================================================================
    // Step 19: Access Bank configures document waivers
    // =========================================================================
    // Now that Access Bank is QUALIFIED, Eniola can waive specific documents
    // that Access Bank considers optional for their lending process.
    // First, get the list of waivable documents for the bank's assignment.
    const waivableDocsRes = await fetchJson(
        `${mortgageServiceUrl}/payment-methods/${paymentMethodId}/assignments/${bankAssignmentId}/waivable-documents`,
        { method: 'GET', headers: authHeaders(eniolaToken) },
    );
    if (waivableDocsRes.status !== 200) throw new Error(`Get waivable documents failed: ${waivableDocsRes.status}`);
    const waivableDocs: Array<{ id: string; documentType: string; documentName: string }> = waivableDocsRes.data.data ?? [];

    // Waive PROOF_OF_ADDRESS — Access Bank has its own address verification
    const proofOfAddress = waivableDocs.find((d: any) => d.documentType === 'PROOF_OF_ADDRESS');
    if (proofOfAddress) {
        const waiverRes = await fetchJson(
            `${mortgageServiceUrl}/payment-methods/${paymentMethodId}/assignments/${bankAssignmentId}/waivers`,
            {
                method: 'POST',
                headers: { ...authHeaders(eniolaToken), 'x-idempotency-key': idempotencyKey('waive-proof-of-address') },
                body: JSON.stringify({
                    documentDefinitionId: proofOfAddress.id,
                    reason: 'Access Bank performs its own address verification during KYC',
                }),
            },
        );
        if (waiverRes.status !== 201) throw new Error(`Create document waiver failed: ${waiverRes.status}`);
        log('Access Bank waives PROOF_OF_ADDRESS', 'Bank has own address verification');
    } else {
        log('PROOF_OF_ADDRESS not found in waivable documents', 'Skipping waiver');
    }

    // =========================================================================
    // Step 20: Link MREIF to property
    // =========================================================================
    // Platform mortgage_ops links the payment method to the property
    const linkRes = await fetchJson(
        `${mortgageServiceUrl}/payment-methods/${paymentMethodId}/properties`,
        {
            method: 'POST',
            headers: { ...authHeaders(yinkaToken), 'x-idempotency-key': idempotencyKey('link-mreif') },
            body: JSON.stringify({ propertyId, isDefault: true }),
        },
    );
    if (linkRes.status !== 201) throw new Error(`Link MREIF failed: ${linkRes.status}`);
    log('Link MREIF to Sunrise Heights', 'Yinka links payment method to property');

    log('Environment ready', '✅ All actors, orgs, property, payment method, qualifications, and waivers created');

    // =========================================================================
    // Build result
    // =========================================================================
    return {
        success: true,
        tenantId,
        actors: {
            adaeze: { name: 'Adaeze Okonkwo', email: 'adaeze@mailsac.com', role: 'admin', id: adminId, token: adminToken },
            yinka: { name: 'Yinka Adewale', email: 'yinka@mailsac.com', role: 'mortgage_ops', id: yinkaId, token: yinkaToken },
            nneka: { name: 'Nneka Obi', email: 'nneka@mailsac.com', role: 'agent', id: nnekaId, token: nnekaToken },
            eniola: { name: 'Eniola Adeyemi', email: 'eniola@mailsac.com', role: 'mortgage_ops', id: eniolaId, token: eniolaToken },
            emeka: { name: 'Emeka Okoro', email: 'emeka@mailsac.com', role: 'customer', id: emekaId, token: emekaToken },
        },
        organizations: {
            platform: { name: platformOrg.name, type: 'PLATFORM', id: platformOrgId },
            developer: { name: 'Lekki Gardens Development Company', type: 'DEVELOPER', id: developerOrgId },
            bank: { name: 'Access Bank PLC', type: 'BANK', id: bankOrgId },
        },
        property: {
            id: propertyId,
            title: 'Sunrise Heights Estate',
            variantId,
            variantName: '3-Bedroom Luxury Apartment',
            unitId,
            unitNumber: 'A-201',
            price: PROPERTY_PRICE,
        },
        paymentMethod: { id: paymentMethodId, name: 'MREIF 10/90 Mortgage', phases: phaseCount },
        qualificationFlow: {
            developerFlowId: devQualFlowId,
            bankFlowId: bankQualFlowId,
            developerGatePlanId: devGatePlanId,
            bankGatePlanId: bankGatePlanId,
            developerAssignmentId: devAssignmentId,
            bankAssignmentId: bankAssignmentId,
        },
        steps,
    };
}

import { prisma } from '../lib/prisma';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
    PolicyEventPublisher,
    ConflictError,
} from '@valentine-efagene/qshelter-common';
import {
    BootstrapTenantInput,
    BootstrapTenantResponse,
    BootstrapRole,
    BootstrapPermission,
} from '../validators/bootstrap.validator';

// =============================================================================
// BOOTSTRAP SERVICE
// =============================================================================
// Provides idempotent tenant bootstrapping with roles, permissions, and admin user.
// Uses transactional outbox pattern for reliable DynamoDB policy sync.
// =============================================================================

// Initialize policy event publisher for DynamoDB sync
const policyPublisher = new PolicyEventPublisher('user-service', {
    region: process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.LOCALSTACK_ENDPOINT,
    topicArn: process.env.POLICY_SYNC_TOPIC_ARN,
});

// =============================================================================
// SYSTEM ORGANIZATION TYPES
// =============================================================================
// These are seeded during tenant bootstrap and cannot be deleted.
// Organizations can have multiple types via OrganizationTypeAssignment.
// =============================================================================
interface SystemOrganizationType {
    code: string;
    name: string;
    description: string;
}

const SYSTEM_ORGANIZATION_TYPES: SystemOrganizationType[] = [
    { code: 'PLATFORM', name: 'Platform Operator', description: 'The platform operator (e.g., QShelter) - the tenant\'s own organization' },
    { code: 'BANK', name: 'Bank/Lender', description: 'Financial institution providing mortgages' },
    { code: 'DEVELOPER', name: 'Property Developer', description: 'Property developer building and selling properties' },
    { code: 'LEGAL', name: 'Legal Firm', description: 'Legal firms handling conveyancing and documentation' },
    { code: 'INSURER', name: 'Insurance Company', description: 'Insurance companies providing property or mortgage insurance' },
    { code: 'GOVERNMENT', name: 'Government Agency', description: 'Government agencies (e.g., land registry, tax authorities)' },
    { code: 'CUSTOMER', name: 'Customer/Applicant', description: 'Pseudo-type for customer actions (document acceptance, acknowledgments). No actual organization - identified by user ID.' },
];

// Default roles with their permissions
const DEFAULT_ROLES: BootstrapRole[] = [
    {
        name: 'admin',
        description: 'Full administrative access to all resources',
        isSystem: true,
        permissions: [
            { name: 'Admin Full Access', path: '/*', methods: ['*'], effect: 'ALLOW' },
        ],
    },
    {
        name: 'user',
        description: 'Basic user access for property browsing and application management',
        isSystem: true,
        permissions: [
            { name: 'View Properties', path: '/properties', methods: ['GET'], effect: 'ALLOW' },
            { name: 'View Property Details', path: '/properties/:id', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Manage Own Applications', path: '/applications', methods: ['GET', 'POST'], effect: 'ALLOW' },
            { name: 'View Own Application', path: '/applications/:id', methods: ['GET'], effect: 'ALLOW' },
            { name: 'View Own Profile', path: '/users/me', methods: ['GET', 'PATCH'], effect: 'ALLOW' },
            { name: 'Manage Own Wallet', path: '/wallets/me', methods: ['GET'], effect: 'ALLOW' },
        ],
    },
    {
        name: 'mortgage_ops',
        description: 'Mortgage operations - manage applications, phases, and payments',
        isSystem: true,
        permissions: [
            { name: 'View Applications', path: '/applications', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Manage Applications', path: '/applications/:id', methods: ['GET', 'PATCH'], effect: 'ALLOW' },
            { name: 'Manage Phases', path: '/applications/:id/phases', methods: ['GET', 'POST', 'PATCH'], effect: 'ALLOW' },
            { name: 'Manage Steps', path: '/applications/:id/phases/:phaseId/steps', methods: ['GET', 'PATCH'], effect: 'ALLOW' },
            { name: 'View Payments', path: '/applications/:id/payments', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Manage Payment Methods', path: '/payment-methods', methods: ['GET', 'POST', 'PATCH', 'DELETE'], effect: 'ALLOW' },
            { name: 'Manage Payment Plans', path: '/payment-plans', methods: ['GET', 'POST', 'PATCH', 'DELETE'], effect: 'ALLOW' },
        ],
    },
    {
        name: 'finance',
        description: 'Finance team - manage payments, refunds, and financial reports',
        isSystem: true,
        permissions: [
            { name: 'View All Payments', path: '/payments', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Process Payments', path: '/payments/:id', methods: ['GET', 'PATCH'], effect: 'ALLOW' },
            { name: 'Manage Refunds', path: '/refunds', methods: ['GET', 'POST', 'PATCH'], effect: 'ALLOW' },
            { name: 'View Wallets', path: '/wallets', methods: ['GET'], effect: 'ALLOW' },
            { name: 'View Applications (Read)', path: '/applications', methods: ['GET'], effect: 'ALLOW' },
            { name: 'View Transactions', path: '/transactions', methods: ['GET'], effect: 'ALLOW' },
        ],
    },
    {
        name: 'legal',
        description: 'Legal team - manage documents, terminations, and compliance',
        isSystem: true,
        permissions: [
            { name: 'View Documents', path: '/documents', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Manage Documents', path: '/documents/:id', methods: ['GET', 'PATCH'], effect: 'ALLOW' },
            { name: 'Manage Terminations', path: '/terminations', methods: ['GET', 'POST', 'PATCH'], effect: 'ALLOW' },
            { name: 'View Applications (Read)', path: '/applications', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Manage Offer Letters', path: '/offer-letters', methods: ['GET', 'POST', 'PATCH'], effect: 'ALLOW' },
        ],
    },
    {
        name: 'agent',
        description: 'Real estate agent - manage properties, listings, and sales documentation',
        isSystem: true,
        permissions: [
            { name: 'View Properties', path: '/properties', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Manage Properties', path: '/properties', methods: ['POST'], effect: 'ALLOW' },
            { name: 'Manage Property Details', path: '/properties/:id', methods: ['GET', 'PATCH', 'DELETE'], effect: 'ALLOW' },
            { name: 'Manage Variants', path: '/properties/:id/variants', methods: ['GET', 'POST', 'PATCH', 'DELETE'], effect: 'ALLOW' },
            { name: 'Manage Units', path: '/properties/:id/variants/:variantId/units', methods: ['GET', 'POST', 'PATCH', 'DELETE'], effect: 'ALLOW' },
            { name: 'Publish Properties', path: '/properties/:id/publish', methods: ['POST'], effect: 'ALLOW' },
            { name: 'Unpublish Properties', path: '/properties/:id/unpublish', methods: ['POST'], effect: 'ALLOW' },
            { name: 'View Applications', path: '/applications', methods: ['GET'], effect: 'ALLOW' },
            { name: 'View Application Details', path: '/applications/:id', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Upload Phase Documents', path: '/applications/:id/phases/:phaseId/documents', methods: ['GET', 'POST'], effect: 'ALLOW' },
            { name: 'View Phase Details', path: '/applications/:id/phases/:phaseId', methods: ['GET'], effect: 'ALLOW' },
        ],
    },
    {
        name: 'lender_ops',
        description: 'Lender operations - manage mortgage preapprovals, offers, and document reviews',
        isSystem: true,
        permissions: [
            { name: 'View Applications', path: '/applications', methods: ['GET'], effect: 'ALLOW' },
            { name: 'View Application Details', path: '/applications/:id', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Upload Phase Documents', path: '/applications/:id/phases/:phaseId/documents', methods: ['GET', 'POST'], effect: 'ALLOW' },
            { name: 'View Phase Details', path: '/applications/:id/phases/:phaseId', methods: ['GET'], effect: 'ALLOW' },
            { name: 'Review Documents', path: '/applications/:id/documents/:docId/review', methods: ['POST'], effect: 'ALLOW' },
            { name: 'View Payment Plans', path: '/payment-plans', methods: ['GET'], effect: 'ALLOW' },
        ],
    },
];

interface RoleResult {
    id: string;
    name: string;
    isNew: boolean;
    permissionsCount: number;
}

class BootstrapService {
    /**
     * Bootstrap a tenant with roles, permissions, and admin user.
     * Idempotent: safe to call multiple times with same subdomain.
     * Uses transactional writes and publishes domain events for DynamoDB sync.
     */
    async bootstrapTenant(input: BootstrapTenantInput): Promise<BootstrapTenantResponse> {
        const { tenant: tenantInput, admin: adminInput, roles: rolesInput } = input;
        const rolesToCreate = rolesInput || DEFAULT_ROLES;

        // Check if tenant already exists (idempotency by subdomain)
        let tenant = await prisma.tenant.findUnique({
            where: { subdomain: tenantInput.subdomain },
        });

        const isNewTenant = !tenant;
        const roleResults: RoleResult[] = [];
        let adminResult: { id: string; email: string; isNew: boolean; temporaryPassword?: string };
        let temporaryPassword: string | undefined;

        // Generate temporary password if not provided
        if (!adminInput.password) {
            temporaryPassword = this.generateTemporaryPassword();
        }

        // Execute in transaction for atomicity
        // Increase timeout from default 5s to 30s - bootstrap creates 30+ records
        // and Aurora cold-start latency can exceed 5s easily
        await prisma.$transaction(async (tx) => {
            // 1. Create or get tenant
            if (!tenant) {
                tenant = await tx.tenant.create({
                    data: {
                        name: tenantInput.name,
                        subdomain: tenantInput.subdomain,
                        isActive: true,
                    },
                });
                console.log(`[Bootstrap] Created tenant: ${tenant.name} (${tenant.subdomain})`);
            }

            // 2. Seed system organization types (idempotent - uses upsert)
            for (const orgType of SYSTEM_ORGANIZATION_TYPES) {
                await tx.organizationType.upsert({
                    where: {
                        tenantId_code: {
                            tenantId: tenant!.id,
                            code: orgType.code,
                        },
                    },
                    update: {
                        // Update name/description if changed
                        name: orgType.name,
                        description: orgType.description,
                    },
                    create: {
                        tenantId: tenant!.id,
                        code: orgType.code,
                        name: orgType.name,
                        description: orgType.description,
                        isSystemType: true,
                    },
                });
            }
            console.log(`[Bootstrap] Seeded ${SYSTEM_ORGANIZATION_TYPES.length} system organization types`);

            // 4. Create roles and permissions
            for (const roleInput of rolesToCreate) {
                const roleResult = await this.createOrGetRole(tx, tenant!.id, roleInput);
                roleResults.push(roleResult);
            }

            // 5. Create admin user and membership
            const adminRole = roleResults.find((r) => r.name === 'admin');
            if (!adminRole) {
                throw new Error('Admin role must be created for bootstrap');
            }

            // Check if user already exists
            let adminUser = await tx.user.findUnique({
                where: { email: adminInput.email },
            });

            const isNewAdmin = !adminUser;

            if (!adminUser) {
                // Hash password
                const passwordToHash = adminInput.password || temporaryPassword!;
                const hashedPassword = await bcrypt.hash(passwordToHash, 10);

                // Create wallet for admin
                const wallet = await tx.wallet.create({
                    data: {
                        balance: 0,
                        currency: 'NGN',
                        tenantId: tenant!.id,
                    },
                });

                // Create admin user
                adminUser = await tx.user.create({
                    data: {
                        email: adminInput.email,
                        password: hashedPassword,
                        firstName: adminInput.firstName,
                        lastName: adminInput.lastName,
                        isActive: true,
                        isEmailVerified: true, // Auto-verified for bootstrap
                        emailVerifiedAt: new Date(), // Set verification timestamp
                        tenantId: tenant!.id,
                        walletId: wallet.id,
                    },
                });

                console.log(`[Bootstrap] Created admin user: ${adminUser.email}`);
            }

            // Check if membership already exists
            const existingMembership = await tx.tenantMembership.findUnique({
                where: {
                    userId_tenantId: {
                        userId: adminUser.id,
                        tenantId: tenant!.id,
                    },
                },
            });

            if (!existingMembership) {
                // Create tenant membership for admin
                await tx.tenantMembership.create({
                    data: {
                        userId: adminUser.id,
                        tenantId: tenant!.id,
                        roleId: adminRole.id,
                        isActive: true,
                        isDefault: true,
                    },
                });
                console.log(`[Bootstrap] Created membership for ${adminUser.email} with role ${adminRole.name}`);
            }

            // 6. Create platform organization (e.g., QShelter) and add admin as member
            const platformOrgType = await tx.organizationType.findFirst({
                where: { tenantId: tenant!.id, code: 'PLATFORM' },
            });

            if (platformOrgType) {
                // Check if platform org already exists
                let platformOrg = await tx.organization.findFirst({
                    where: { tenantId: tenant!.id, isPlatformOrg: true },
                });

                if (!platformOrg) {
                    // Create platform organization using tenant name
                    platformOrg = await tx.organization.create({
                        data: {
                            tenantId: tenant!.id,
                            name: tenant!.name,
                            isPlatformOrg: true,
                            status: 'ACTIVE',
                            email: adminInput.email, // Use admin email as org contact
                        },
                    });

                    // Assign PLATFORM type to this organization
                    await tx.organizationTypeAssignment.create({
                        data: {
                            organizationId: platformOrg.id,
                            typeId: platformOrgType.id,
                            isPrimary: true,
                        },
                    });

                    console.log(`[Bootstrap] Created platform organization: ${platformOrg.name}`);
                }

                // Check if admin is already a member of the platform org
                const existingOrgMembership = await tx.organizationMember.findUnique({
                    where: {
                        organizationId_userId: {
                            organizationId: platformOrg.id,
                            userId: adminUser.id,
                        },
                    },
                });

                if (!existingOrgMembership) {
                    // Add admin as member of platform organization
                    await tx.organizationMember.create({
                        data: {
                            organizationId: platformOrg.id,
                            userId: adminUser.id,
                            title: 'Operations Manager',
                            department: 'Operations',
                            isActive: true,
                        },
                    });
                    console.log(`[Bootstrap] Added ${adminUser.email} as member of ${platformOrg.name}`);
                }
            }

            adminResult = {
                id: adminUser.id,
                email: adminUser.email,
                isNew: isNewAdmin,
                temporaryPassword: isNewAdmin ? temporaryPassword : undefined,
            };

            // 6. Write domain events to outbox for policy sync
            for (const role of roleResults) {
                if (role.isNew) {
                    await tx.domainEvent.create({
                        data: {
                            id: randomUUID(),
                            eventType: 'ROLE.CREATED',
                            aggregateType: 'Role',
                            aggregateId: role.id,
                            queueName: 'policy-sync',
                            tenantId: tenant!.id,
                            payload: JSON.stringify({
                                roleId: role.id,
                                roleName: role.name,
                                tenantId: tenant!.id,
                            }),
                            actorId: adminUser.id,
                        },
                    });
                }
            }

            // Write tenant created event if new
            if (isNewTenant) {
                await tx.domainEvent.create({
                    data: {
                        id: randomUUID(),
                        eventType: 'TENANT.CREATED',
                        aggregateType: 'Tenant',
                        aggregateId: tenant!.id,
                        queueName: 'policy-sync',
                        tenantId: tenant!.id,
                        payload: JSON.stringify({
                            tenantId: tenant!.id,
                            tenantName: tenant!.name,
                            subdomain: tenant!.subdomain,
                        }),
                        actorId: adminUser.id,
                    },
                });
            }
        }, { timeout: 30000 });

        // 7. Trigger immediate sync for new roles (outside transaction)
        let syncTriggered = false;
        for (const role of roleResults) {
            if (role.isNew) {
                try {
                    const fullRole = await prisma.role.findUnique({
                        where: { id: role.id },
                        include: {
                            permissions: {
                                include: {
                                    permission: true,
                                },
                            },
                        },
                    });

                    if (fullRole) {
                        // First publish role created event
                        await policyPublisher.publishRoleCreated({
                            id: fullRole.id,
                            name: fullRole.name,
                            description: fullRole.description,
                            tenantId: fullRole.tenantId,
                            isSystem: fullRole.isSystem,
                            isActive: fullRole.isActive,
                        });

                        // Then publish role permissions for policy sync
                        if (fullRole.permissions.length > 0) {
                            await policyPublisher.publishRolePermissionAssigned({
                                roleId: fullRole.id,
                                roleName: fullRole.name,
                                tenantId: fullRole.tenantId,
                                permissions: fullRole.permissions.map((rp) => ({
                                    id: rp.permission.id,
                                    path: rp.permission.path,
                                    methods: rp.permission.methods as string[],
                                    effect: rp.permission.effect as 'ALLOW' | 'DENY',
                                })),
                            });
                        }

                        syncTriggered = true;
                    }
                } catch (error) {
                    console.error(`[Bootstrap] Failed to publish role sync event:`, error);
                }
            }
        }

        // 8. Seed onboarding templates for BANK and DEVELOPER org types (outside transaction, idempotent)
        if (isNewTenant) {
            try {
                await this.seedOnboardingTemplates(tenant!.id);
                console.log(`[Bootstrap] Seeded onboarding templates`);
            } catch (error) {
                console.error(`[Bootstrap] Failed to seed onboarding templates:`, error);
                // Non-critical — templates can be created manually
            }
        }

        return {
            tenant: {
                id: tenant!.id,
                name: tenant!.name,
                subdomain: tenant!.subdomain,
                isNew: isNewTenant,
            },
            admin: adminResult!,
            roles: roleResults,
            syncTriggered,
        };
    }

    /**
     * Create or get a role with its permissions (idempotent by name+tenantId)
     */
    private async createOrGetRole(
        tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
        tenantId: string,
        roleInput: BootstrapRole
    ): Promise<RoleResult> {
        // Check if role already exists
        let role = await tx.role.findFirst({
            where: {
                name: roleInput.name,
                tenantId,
            },
            include: {
                permissions: true,
            },
        });

        if (role) {
            return {
                id: role.id,
                name: role.name,
                isNew: false,
                permissionsCount: role.permissions.length,
            };
        }

        // Create role
        role = await tx.role.create({
            data: {
                name: roleInput.name,
                description: roleInput.description,
                tenantId,
                isSystem: roleInput.isSystem ?? false,
                isActive: true,
            },
            include: {
                permissions: true,
            },
        });

        console.log(`[Bootstrap] Created role: ${role.name} (tenant: ${tenantId})`);

        // Create permissions and link to role
        let permissionsCount = 0;
        if (roleInput.permissions && roleInput.permissions.length > 0) {
            for (const permInput of roleInput.permissions) {
                const permission = await this.createOrGetPermission(tx, tenantId, permInput);

                // Check if role-permission link already exists
                const existingLink = await tx.rolePermission.findUnique({
                    where: {
                        roleId_permissionId: {
                            roleId: role.id,
                            permissionId: permission.id,
                        },
                    },
                });

                if (!existingLink) {
                    // Link permission to role
                    await tx.rolePermission.create({
                        data: {
                            roleId: role.id,
                            permissionId: permission.id,
                        },
                    });
                }
                permissionsCount++;
            }
        }

        return {
            id: role.id,
            name: role.name,
            isNew: true,
            permissionsCount,
        };
    }

    /**
     * Create or get a permission (idempotent by path+tenantId)
     */
    private async createOrGetPermission(
        tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
        tenantId: string,
        permInput: BootstrapPermission
    ): Promise<{ id: string; name: string }> {
        // Check if permission already exists
        let permission = await tx.permission.findFirst({
            where: {
                path: permInput.path,
                tenantId,
            },
        });

        if (permission) {
            return { id: permission.id, name: permission.name };
        }

        // Create permission
        permission = await tx.permission.create({
            data: {
                name: permInput.name,
                path: permInput.path,
                methods: permInput.methods,
                effect: permInput.effect ?? 'ALLOW',
                tenantId,
            },
        });

        console.log(`[Bootstrap] Created permission: ${permission.name} (${permission.path})`);

        return { id: permission.id, name: permission.name };
    }

    /**
     * Generate a secure temporary password
     */
    private generateTemporaryPassword(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
        let password = '';
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    // =========================================================================
    // ONBOARDING TEMPLATE SEEDING
    // =========================================================================

    /**
     * Seed onboarding templates for BANK and DEVELOPER organization types.
     * Creates QuestionnairePlans, DocumentationPlans, GatePlans, and OnboardingFlows.
     * Idempotent — checks for existing records by name before creating.
     */
    private async seedOnboardingTemplates(tenantId: string): Promise<void> {
        // Get PLATFORM org type (needed for gate plan reviewer and approval stages)
        const platformType = await prisma.organizationType.findFirst({
            where: { tenantId, code: 'PLATFORM' },
        });

        if (!platformType) {
            console.warn('[Bootstrap] PLATFORM org type not found, skipping onboarding seed');
            return;
        }

        // Seed Bank Onboarding
        const bankType = await prisma.organizationType.findFirst({
            where: { tenantId, code: 'BANK' },
        });
        if (bankType) {
            await this.seedBankOnboarding(tenantId, bankType.id, platformType.id);
        }

        // Seed Developer Onboarding
        const developerType = await prisma.organizationType.findFirst({
            where: { tenantId, code: 'DEVELOPER' },
        });
        if (developerType) {
            await this.seedDeveloperOnboarding(tenantId, developerType.id, platformType.id);
        }
    }

    /**
     * Seed BANK onboarding: KYB questionnaire → KYB docs → Platform approval gate
     */
    private async seedBankOnboarding(tenantId: string, bankTypeId: string, platformTypeId: string): Promise<void> {
        // Check if already seeded
        const existing = await prisma.onboardingFlow.findFirst({
            where: { tenantId, name: 'Bank Onboarding' },
        });
        if (existing) return;

        // 1. Bank KYB Questionnaire Plan
        const questionnairePlan = await prisma.questionnairePlan.create({
            data: {
                tenantId,
                name: 'Bank KYB Questionnaire',
                description: 'Know-Your-Business questionnaire for financial institutions',
                category: 'COMPLIANCE',
                isActive: true,
                questions: {
                    createMany: {
                        data: [
                            { questionKey: 'bank_name', questionText: 'Registered bank name', questionType: 'TEXT', order: 1, isRequired: true, category: 'ORGANIZATION' },
                            { questionKey: 'cbn_license_no', questionText: 'CBN license number', questionType: 'TEXT', order: 2, isRequired: true, category: 'KYB' },
                            { questionKey: 'year_established', questionText: 'Year of establishment', questionType: 'NUMBER', order: 3, isRequired: true, category: 'KYB' },
                            { questionKey: 'swift_code', questionText: 'SWIFT/BIC code', questionType: 'TEXT', order: 4, isRequired: false, category: 'ORGANIZATION' },
                            { questionKey: 'sort_code', questionText: 'Sort code', questionType: 'TEXT', order: 5, isRequired: false, category: 'ORGANIZATION' },
                            { questionKey: 'branch_count', questionText: 'Number of branches in Nigeria', questionType: 'NUMBER', order: 6, isRequired: true, category: 'KYB' },
                            { questionKey: 'mortgage_portfolio_size', questionText: 'Current mortgage portfolio size (NGN)', questionType: 'CURRENCY', order: 7, isRequired: true, category: 'KYB' },
                            { questionKey: 'primary_contact_name', questionText: 'Primary contact person name', questionType: 'TEXT', order: 8, isRequired: true, category: 'CONTACTS' },
                            { questionKey: 'primary_contact_email', questionText: 'Primary contact email', questionType: 'EMAIL', order: 9, isRequired: true, category: 'CONTACTS' },
                            { questionKey: 'primary_contact_phone', questionText: 'Primary contact phone', questionType: 'PHONE', order: 10, isRequired: true, category: 'CONTACTS' },
                        ],
                    },
                },
            },
        });

        // 2. Bank KYB Documentation Plan
        const documentationPlan = await prisma.documentationPlan.create({
            data: {
                tenantId,
                name: 'Bank KYB Documentation',
                description: 'Required documents for bank onboarding verification',
                isActive: true,
                documentDefinitions: {
                    createMany: {
                        data: [
                            { documentType: 'CBN_LICENSE', documentName: 'CBN Banking License', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 1, isRequired: true, description: 'Current CBN banking license certificate' },
                            { documentType: 'CAC_CERTIFICATE', documentName: 'CAC Registration Certificate', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 2, isRequired: true, description: 'Corporate Affairs Commission registration certificate' },
                            { documentType: 'AUDITED_FINANCIALS', documentName: 'Audited Financial Statements', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 3, isRequired: true, description: 'Audited financial statements for the last 2 years', maxFiles: 2 },
                            { documentType: 'BOARD_RESOLUTION', documentName: 'Board Resolution', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 4, isRequired: true, description: 'Board resolution authorizing mortgage operations on the platform' },
                            { documentType: 'AML_POLICY', documentName: 'Anti-Money Laundering Policy', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 5, isRequired: false, description: 'AML/CFT compliance policy document' },
                        ],
                    },
                },
                approvalStages: {
                    create: {
                        name: 'Platform Review',
                        order: 1,
                        organizationTypeId: platformTypeId,
                        autoTransition: false,
                        waitForAllDocuments: true,
                        slaHours: 48,
                        description: 'QShelter staff reviews bank KYB documents',
                    },
                },
            },
        });

        // 3. Platform Approval Gate Plan
        const gatePlan = await prisma.gatePlan.create({
            data: {
                tenantId,
                name: 'Bank Approval Gate',
                description: 'Final approval gate for bank onboarding',
                requiredApprovals: 1,
                reviewerOrganizationTypeId: platformTypeId,
                reviewerInstructions: 'Review all bank KYB information and documents. Approve if the bank meets all compliance requirements for mortgage operations.',
                isActive: true,
            },
        });

        // 4. Create OnboardingFlow linking everything together
        const flow = await prisma.onboardingFlow.create({
            data: {
                tenantId,
                name: 'Bank Onboarding',
                description: 'Standard onboarding workflow for banks and financial institutions joining the platform',
                expiresInDays: 30,
                isActive: true,
                phases: {
                    createMany: {
                        data: [
                            { tenantId, name: 'Bank KYB Questionnaire', phaseCategory: 'QUESTIONNAIRE', phaseType: 'ORG_KYB', order: 1, questionnairePlanId: questionnairePlan.id },
                            { tenantId, name: 'Bank Document Verification', phaseCategory: 'DOCUMENTATION', phaseType: 'ORG_VERIFICATION', order: 2, documentationPlanId: documentationPlan.id },
                            { tenantId, name: 'Platform Approval', phaseCategory: 'GATE', phaseType: 'APPROVAL_GATE', order: 3, gatePlanId: gatePlan.id },
                        ],
                    },
                },
            },
        });

        // 5. Link the onboarding flow to the BANK org type
        await prisma.organizationType.update({
            where: { id: bankTypeId },
            data: { onboardingFlowId: flow.id },
        });

        console.log(`[Bootstrap] Seeded Bank Onboarding: ${flow.id}`);
    }

    /**
     * Seed DEVELOPER onboarding: KYB questionnaire → KYB docs → Platform approval gate
     */
    private async seedDeveloperOnboarding(tenantId: string, developerTypeId: string, platformTypeId: string): Promise<void> {
        // Check if already seeded
        const existing = await prisma.onboardingFlow.findFirst({
            where: { tenantId, name: 'Developer Onboarding' },
        });
        if (existing) return;

        // 1. Developer KYB Questionnaire Plan
        const questionnairePlan = await prisma.questionnairePlan.create({
            data: {
                tenantId,
                name: 'Developer KYB Questionnaire',
                description: 'Know-Your-Business questionnaire for property developers',
                category: 'COMPLIANCE',
                isActive: true,
                questions: {
                    createMany: {
                        data: [
                            { questionKey: 'company_name', questionText: 'Registered company name', questionType: 'TEXT', order: 1, isRequired: true, category: 'ORGANIZATION' },
                            { questionKey: 'cac_number', questionText: 'CAC registration number', questionType: 'TEXT', order: 2, isRequired: true, category: 'KYB' },
                            { questionKey: 'tax_id', questionText: 'Tax identification number (TIN)', questionType: 'TEXT', order: 3, isRequired: true, category: 'KYB' },
                            { questionKey: 'year_established', questionText: 'Year of establishment', questionType: 'NUMBER', order: 4, isRequired: true, category: 'KYB' },
                            { questionKey: 'completed_projects', questionText: 'Number of completed projects', questionType: 'NUMBER', order: 5, isRequired: true, category: 'KYB' },
                            { questionKey: 'ongoing_projects', questionText: 'Number of ongoing projects', questionType: 'NUMBER', order: 6, isRequired: false, category: 'KYB' },
                            { questionKey: 'office_address', questionText: 'Registered office address', questionType: 'ADDRESS', order: 7, isRequired: true, category: 'ORGANIZATION' },
                            { questionKey: 'primary_contact_name', questionText: 'Primary contact person name', questionType: 'TEXT', order: 8, isRequired: true, category: 'CONTACTS' },
                            { questionKey: 'primary_contact_email', questionText: 'Primary contact email', questionType: 'EMAIL', order: 9, isRequired: true, category: 'CONTACTS' },
                            { questionKey: 'primary_contact_phone', questionText: 'Primary contact phone', questionType: 'PHONE', order: 10, isRequired: true, category: 'CONTACTS' },
                        ],
                    },
                },
            },
        });

        // 2. Developer KYB Documentation Plan
        const documentationPlan = await prisma.documentationPlan.create({
            data: {
                tenantId,
                name: 'Developer KYB Documentation',
                description: 'Required documents for property developer onboarding',
                isActive: true,
                documentDefinitions: {
                    createMany: {
                        data: [
                            { documentType: 'CAC_CERTIFICATE', documentName: 'CAC Registration Certificate', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 1, isRequired: true, description: 'Corporate Affairs Commission registration certificate' },
                            { documentType: 'TAX_CLEARANCE', documentName: 'Tax Clearance Certificate', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 2, isRequired: true, description: 'Tax clearance certificate (current year)' },
                            { documentType: 'COMPANY_PROFILE', documentName: 'Company Profile', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 3, isRequired: true, description: 'Company profile or brochure with past projects' },
                            { documentType: 'PROJECT_PORTFOLIO', documentName: 'Portfolio of Completed Projects', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 4, isRequired: false, description: 'Photos and details of completed developments', maxFiles: 10 },
                            { documentType: 'INSURANCE_CERTIFICATE', documentName: 'Insurance Certificate', uploadedBy: 'ORGANIZATION_ONBOARDER', order: 5, isRequired: false, description: 'Professional indemnity or liability insurance' },
                        ],
                    },
                },
                approvalStages: {
                    create: {
                        name: 'Platform Review',
                        order: 1,
                        organizationTypeId: platformTypeId,
                        autoTransition: false,
                        waitForAllDocuments: true,
                        slaHours: 48,
                        description: 'QShelter staff reviews developer KYB documents',
                    },
                },
            },
        });

        // 3. Platform Approval Gate Plan
        const gatePlan = await prisma.gatePlan.create({
            data: {
                tenantId,
                name: 'Developer Approval Gate',
                description: 'Final approval gate for developer onboarding',
                requiredApprovals: 1,
                reviewerOrganizationTypeId: platformTypeId,
                reviewerInstructions: 'Review all developer KYB information and documents. Approve if the developer meets all requirements for listing properties on the platform.',
                isActive: true,
            },
        });

        // 4. Create OnboardingFlow linking everything together
        const flow = await prisma.onboardingFlow.create({
            data: {
                tenantId,
                name: 'Developer Onboarding',
                description: 'Standard onboarding workflow for property developers joining the platform',
                expiresInDays: 30,
                isActive: true,
                phases: {
                    createMany: {
                        data: [
                            { tenantId, name: 'Developer KYB Questionnaire', phaseCategory: 'QUESTIONNAIRE', phaseType: 'ORG_KYB', order: 1, questionnairePlanId: questionnairePlan.id },
                            { tenantId, name: 'Developer Document Verification', phaseCategory: 'DOCUMENTATION', phaseType: 'ORG_VERIFICATION', order: 2, documentationPlanId: documentationPlan.id },
                            { tenantId, name: 'Platform Approval', phaseCategory: 'GATE', phaseType: 'APPROVAL_GATE', order: 3, gatePlanId: gatePlan.id },
                        ],
                    },
                },
            },
        });

        // 5. Link the onboarding flow to the DEVELOPER org type
        await prisma.organizationType.update({
            where: { id: developerTypeId },
            data: { onboardingFlowId: flow.id },
        });

        console.log(`[Bootstrap] Seeded Developer Onboarding: ${flow.id}`);
    }
}

export const bootstrapService = new BootstrapService();

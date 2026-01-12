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

            // 2. Create roles and permissions
            for (const roleInput of rolesToCreate) {
                const roleResult = await this.createOrGetRole(tx, tenant!.id, roleInput);
                roleResults.push(roleResult);
            }

            // 3. Create admin user and membership
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

            adminResult = {
                id: adminUser.id,
                email: adminUser.email,
                isNew: isNewAdmin,
                temporaryPassword: isNewAdmin ? temporaryPassword : undefined,
            };

            // 4. Write domain events to outbox for policy sync
            for (const role of roleResults) {
                if (role.isNew) {
                    await tx.domainEvent.create({
                        data: {
                            id: randomUUID(),
                            eventType: 'ROLE.CREATED',
                            aggregateType: 'Role',
                            aggregateId: role.id,
                            queueName: 'policy-sync',
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
                        payload: JSON.stringify({
                            tenantId: tenant!.id,
                            tenantName: tenant!.name,
                            subdomain: tenant!.subdomain,
                        }),
                        actorId: adminUser.id,
                    },
                });
            }
        });

        // 5. Trigger immediate sync for new roles (outside transaction)
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

                // Link permission to role
                await tx.rolePermission.create({
                    data: {
                        roleId: role.id,
                        permissionId: permission.id,
                    },
                });
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
}

export const bootstrapService = new BootstrapService();

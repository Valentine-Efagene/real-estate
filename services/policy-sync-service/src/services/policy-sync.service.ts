/**
 * Policy Sync Service
 * 
 * Handles synchronization of role/permission data from RDS to DynamoDB.
 * This is the core business logic for maintaining the DynamoDB cache.
 * 
 * Supports:
 * - Path-based permissions with HTTP methods
 * - Tenant-scoped roles (tenant-specific or global templates)
 * - Federated users across tenants via TenantMembership
 */

import { prisma } from '../lib/prisma';
import {
    getDynamoPolicyRepository,
    DynamoPolicyRepository,
    RolePolicy,
} from '../repositories/dynamo-policy.repository';
import {
    PolicyEventType,
    RoleCreatedEvent,
    RoleUpdatedEvent,
    RoleDeletedEvent,
    RolePermissionAssignedEvent,
    RolePermissionRevokedEvent,
    AnyPolicyEvent,
} from '../types/policy-events';

export class PolicySyncService {
    private readonly dynamoRepo: DynamoPolicyRepository;

    constructor() {
        this.dynamoRepo = getDynamoPolicyRepository();
    }

    /**
     * Process a policy event and sync to DynamoDB
     */
    async processEvent(event: AnyPolicyEvent): Promise<void> {
        console.log(`[PolicySyncService] Processing event: ${event.eventType}`);

        switch (event.eventType) {
            case PolicyEventType.ROLE_CREATED:
                await this.handleRoleCreated(event as RoleCreatedEvent);
                break;

            case PolicyEventType.ROLE_UPDATED:
                await this.handleRoleUpdated(event as RoleUpdatedEvent);
                break;

            case PolicyEventType.ROLE_DELETED:
                await this.handleRoleDeleted(event as RoleDeletedEvent);
                break;

            case PolicyEventType.ROLE_PERMISSION_ASSIGNED:
            case PolicyEventType.ROLE_PERMISSION_REVOKED:
                await this.handleRolePermissionChanged(event as RolePermissionAssignedEvent | RolePermissionRevokedEvent);
                break;

            case PolicyEventType.FULL_SYNC_REQUESTED:
                await this.performFullSync();
                break;

            case PolicyEventType.PERMISSION_CREATED:
            case PolicyEventType.PERMISSION_UPDATED:
            case PolicyEventType.PERMISSION_DELETED:
                // Permission changes affect all roles that use this permission
                // Trigger a sync for affected roles
                console.log(`[PolicySyncService] Permission event ${event.eventType} - triggering affected role sync`);
                await this.syncAffectedRoles(event.data as { id: string });
                break;

            default:
                console.warn(`[PolicySyncService] Unknown event type: ${(event as any).eventType}`);
        }
    }

    /**
     * Handle role creation - create an empty policy in DynamoDB ONLY if it doesn't exist.
     * This prevents race conditions where ROLE_CREATED events processed after 
     * ROLE_PERMISSION_ASSIGNED would overwrite the permissions with empty statements.
     */
    private async handleRoleCreated(event: RoleCreatedEvent): Promise<void> {
        const { data } = event;

        // Check if policy already exists (could have been created by ROLE_PERMISSION_ASSIGNED)
        const existingPolicy = await this.dynamoRepo.getRolePolicy(data.name, data.tenantId);

        if (existingPolicy) {
            console.log(`[PolicySyncService] Policy already exists for role: ${data.name} (tenant: ${data.tenantId || 'global'}), skipping creation`);
            return;
        }

        // For a new role, start with empty policy
        const emptyPolicy: RolePolicy = {
            version: '2',
            statements: [],
        };

        await this.dynamoRepo.upsertRolePolicy(data.name, emptyPolicy, {
            tenantId: data.tenantId,
            isActive: data.isActive ?? true,
            isSystem: data.isSystem,
        });

        console.log(`[PolicySyncService] Created policy for new role: ${data.name} (tenant: ${data.tenantId || 'global'})`);
    }

    /**
     * Handle role update - update the role in DynamoDB
     */
    private async handleRoleUpdated(event: RoleUpdatedEvent): Promise<void> {
        const { data } = event;

        // Fetch current permissions for this role from RDS
        const policy = await this.fetchRolePolicy(data.id);

        await this.dynamoRepo.upsertRolePolicy(data.name, policy, {
            tenantId: data.tenantId,
            isActive: data.isActive ?? true,
            isSystem: data.isSystem,
        });

        console.log(`[PolicySyncService] Updated policy for role: ${data.name}`);
    }

    /**
     * Handle role deletion - remove from DynamoDB
     */
    private async handleRoleDeleted(event: RoleDeletedEvent): Promise<void> {
        const { roleName, tenantId } = event.data as { roleId: string; roleName: string; tenantId?: string };

        await this.dynamoRepo.deleteRolePolicy(roleName, tenantId);

        console.log(`[PolicySyncService] Deleted policy for role: ${roleName}`);
    }

    /**
     * Handle role-permission changes - refresh the role's policy
     */
    private async handleRolePermissionChanged(
        event: RolePermissionAssignedEvent | RolePermissionRevokedEvent
    ): Promise<void> {
        const { data } = event;

        // Convert permissions to policy
        const policy = DynamoPolicyRepository.permissionsToPolicy(
            data.permissions.map(p => ({
                path: p.path,
                methods: p.methods,
                effect: p.effect,
            }))
        );

        await this.dynamoRepo.upsertRolePolicy(data.roleName, policy, {
            tenantId: data.tenantId,
            isActive: true,
        });

        console.log(`[PolicySyncService] Updated policy for role: ${data.roleName} (${data.permissions.length} permissions)`);
    }

    /**
     * Sync roles affected by a permission change
     */
    private async syncAffectedRoles(permissionData: { id: string }): Promise<void> {
        // Find all roles that have this permission
        const rolePermissions = await prisma.rolePermission.findMany({
            where: { permissionId: permissionData.id },
            include: {
                role: true,
            },
        });

        for (const rp of rolePermissions) {
            await this.syncRole(rp.role.id);
        }

        console.log(`[PolicySyncService] Synced ${rolePermissions.length} roles affected by permission change`);
    }

    /**
     * Perform a full sync from RDS to DynamoDB
     * Used for initial population or recovery
     */
    async performFullSync(): Promise<void> {
        console.log('[PolicySyncService] Starting full sync from RDS to DynamoDB...');

        // Fetch all roles with their permissions from RDS
        const roles = await prisma.role.findMany({
            where: {
                isActive: true,
            },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        console.log(`[PolicySyncService] Found ${roles.length} active roles to sync`);

        const policies = roles.map(role => {
            // Convert permissions to policy structure
            const permissions = role.permissions.map(rp => ({
                path: rp.permission.path,
                methods: rp.permission.methods as string[],
                effect: rp.permission.effect as 'ALLOW' | 'DENY',
            }));

            const policy = DynamoPolicyRepository.permissionsToPolicy(permissions);

            return {
                roleName: role.name,
                policy,
                tenantId: role.tenantId,
                isActive: role.isActive,
                isSystem: role.isSystem,
            };
        });

        await this.dynamoRepo.batchUpsertPolicies(policies);

        console.log(`[PolicySyncService] Full sync complete. Synced ${roles.length} roles.`);
    }

    /**
     * Fetch policy for a role from RDS
     */
    private async fetchRolePolicy(roleId: string): Promise<RolePolicy> {
        const rolePermissions = await prisma.rolePermission.findMany({
            where: { roleId },
            include: {
                permission: true,
            },
        });

        const permissions = rolePermissions.map(rp => ({
            path: rp.permission.path,
            methods: rp.permission.methods as string[],
            effect: rp.permission.effect as 'ALLOW' | 'DENY',
        }));

        return DynamoPolicyRepository.permissionsToPolicy(permissions);
    }

    /**
     * Sync a single role by ID (fetch from RDS and update DynamoDB)
     */
    async syncRole(roleId: string): Promise<void> {
        const role = await prisma.role.findUnique({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!role) {
            console.warn(`[PolicySyncService] Role not found: ${roleId}`);
            return;
        }

        const permissions = role.permissions.map(rp => ({
            path: rp.permission.path,
            methods: rp.permission.methods as string[],
            effect: rp.permission.effect as 'ALLOW' | 'DENY',
        }));

        const policy = DynamoPolicyRepository.permissionsToPolicy(permissions);

        await this.dynamoRepo.upsertRolePolicy(role.name, policy, {
            tenantId: role.tenantId,
            isActive: role.isActive,
            isSystem: role.isSystem,
        });

        console.log(`[PolicySyncService] Synced role: ${role.name} with ${permissions.length} permissions`);
    }

    /**
     * Sync a role by name and optional tenant (fetch from RDS and update DynamoDB)
     */
    async syncRoleByName(roleName: string, tenantId?: string | null): Promise<void> {
        const role = await prisma.role.findFirst({
            where: {
                name: roleName,
                tenantId: tenantId ?? null,
            },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!role) {
            console.warn(`[PolicySyncService] Role not found by name: ${roleName} (tenant: ${tenantId || 'global'})`);
            return;
        }

        const permissions = role.permissions.map(rp => ({
            path: rp.permission.path,
            methods: rp.permission.methods as string[],
            effect: rp.permission.effect as 'ALLOW' | 'DENY',
        }));

        const policy = DynamoPolicyRepository.permissionsToPolicy(permissions);

        await this.dynamoRepo.upsertRolePolicy(role.name, policy, {
            tenantId: role.tenantId,
            isActive: role.isActive,
            isSystem: role.isSystem,
        });

        console.log(`[PolicySyncService] Synced role: ${role.name} with ${permissions.length} permissions`);
    }

    /**
     * Sync all roles for a specific tenant
     */
    async syncTenantRoles(tenantId: string): Promise<void> {
        console.log(`[PolicySyncService] Syncing roles for tenant: ${tenantId}`);

        const roles = await prisma.role.findMany({
            where: {
                tenantId,
                isActive: true,
            },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        for (const role of roles) {
            const permissions = role.permissions.map(rp => ({
                path: rp.permission.path,
                methods: rp.permission.methods as string[],
                effect: rp.permission.effect as 'ALLOW' | 'DENY',
            }));

            const policy = DynamoPolicyRepository.permissionsToPolicy(permissions);

            await this.dynamoRepo.upsertRolePolicy(role.name, policy, {
                tenantId: role.tenantId,
                isActive: role.isActive,
                isSystem: role.isSystem,
            });
        }

        console.log(`[PolicySyncService] Synced ${roles.length} roles for tenant: ${tenantId}`);
    }
}

// Singleton instance
let service: PolicySyncService | null = null;

export function getPolicySyncService(): PolicySyncService {
    if (!service) {
        service = new PolicySyncService();
    }
    return service;
}

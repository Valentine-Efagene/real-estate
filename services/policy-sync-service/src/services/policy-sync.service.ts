/**
 * Policy Sync Service
 * 
 * Handles synchronization of role/permission data from RDS to DynamoDB.
 * This is the core business logic for maintaining the DynamoDB cache.
 */

import { prisma } from '../lib/prisma';
import {
    getDynamoPolicyRepository,
    DynamoPolicyRepository
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
                // Permission changes are reflected through RolePermission events
                // We could trigger a full sync for affected roles here if needed
                console.log(`[PolicySyncService] Permission event ${event.eventType} - no direct action needed`);
                break;

            default:
                console.warn(`[PolicySyncService] Unknown event type: ${(event as any).eventType}`);
        }
    }

    /**
     * Handle role creation - create an empty policy in DynamoDB
     */
    private async handleRoleCreated(event: RoleCreatedEvent): Promise<void> {
        const { data, tenantId } = event;

        // For a new role, start with empty scopes
        // Scopes will be populated when permissions are assigned
        await this.dynamoRepo.upsertRolePolicy(data.name, [], {
            tenantId,
            isActive: true,
        });

        console.log(`[PolicySyncService] Created policy for new role: ${data.name}`);
    }

    /**
     * Handle role update - update the role name in DynamoDB if changed
     */
    private async handleRoleUpdated(event: RoleUpdatedEvent): Promise<void> {
        const { data, tenantId } = event;

        // Fetch current permissions for this role from RDS
        const scopes = await this.fetchRoleScopes(data.id);

        await this.dynamoRepo.upsertRolePolicy(data.name, scopes, {
            tenantId,
            isActive: true,
        });

        console.log(`[PolicySyncService] Updated policy for role: ${data.name}`);
    }

    /**
     * Handle role deletion - remove from DynamoDB
     */
    private async handleRoleDeleted(event: RoleDeletedEvent): Promise<void> {
        const { roleName } = event.data;

        await this.dynamoRepo.deleteRolePolicy(roleName);

        console.log(`[PolicySyncService] Deleted policy for role: ${roleName}`);
    }

    /**
     * Handle role-permission changes - refresh the role's scopes
     */
    private async handleRolePermissionChanged(
        event: RolePermissionAssignedEvent | RolePermissionRevokedEvent
    ): Promise<void> {
        const { data, tenantId } = event;

        // The event contains the current permissions, convert to scopes
        const scopes = DynamoPolicyRepository.permissionsToScopes(data.permissions);

        await this.dynamoRepo.upsertRolePolicy(data.roleName, scopes, {
            tenantId,
            isActive: true,
        });

        console.log(`[PolicySyncService] Updated scopes for role: ${data.roleName} (${scopes.length} scopes)`);
    }

    /**
     * Perform a full sync from RDS to DynamoDB
     * Used for initial population or recovery
     */
    async performFullSync(): Promise<void> {
        console.log('[PolicySyncService] Starting full sync from RDS to DynamoDB...');

        // Fetch all roles with their permissions from RDS
        const roles = await prisma.role.findMany({
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        console.log(`[PolicySyncService] Found ${roles.length} roles to sync`);

        const policies = roles.map(role => {
            const scopes = role.permissions.map(rp =>
                `${rp.permission.resource}:${rp.permission.action}`
            );

            return {
                roleName: role.name,
                scopes,
                isActive: true,
            };
        });

        await this.dynamoRepo.batchUpsertPolicies(policies);

        console.log(`[PolicySyncService] Full sync complete. Synced ${roles.length} roles.`);
    }

    /**
     * Fetch scopes for a role from RDS
     */
    private async fetchRoleScopes(roleId: string): Promise<string[]> {
        const rolePermissions = await prisma.rolePermission.findMany({
            where: { roleId },
            include: {
                permission: true,
            },
        });

        return rolePermissions.map(rp =>
            `${rp.permission.resource}:${rp.permission.action}`
        );
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

        const scopes = role.permissions.map(rp =>
            `${rp.permission.resource}:${rp.permission.action}`
        );

        await this.dynamoRepo.upsertRolePolicy(role.name, scopes, {
            isActive: true,
        });

        console.log(`[PolicySyncService] Synced role: ${role.name} with ${scopes.length} scopes`);
    }

    /**
     * Sync a role by name (fetch from RDS and update DynamoDB)
     */
    async syncRoleByName(roleName: string): Promise<void> {
        const role = await prisma.role.findUnique({
            where: { name: roleName },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!role) {
            console.warn(`[PolicySyncService] Role not found by name: ${roleName}`);
            return;
        }

        const scopes = role.permissions.map(rp =>
            `${rp.permission.resource}:${rp.permission.action}`
        );

        await this.dynamoRepo.upsertRolePolicy(role.name, scopes, {
            isActive: true,
        });

        console.log(`[PolicySyncService] Synced role: ${role.name} with ${scopes.length} scopes`);
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

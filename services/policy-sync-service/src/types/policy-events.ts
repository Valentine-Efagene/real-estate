/**
 * Policy Sync Event Types
 * 
 * These events are published when role/permission data changes in RDS,
 * triggering synchronization to DynamoDB for the authorizer.
 */

export enum PolicyEventType {
    // Role events
    ROLE_CREATED = 'POLICY.ROLE_CREATED',
    ROLE_UPDATED = 'POLICY.ROLE_UPDATED',
    ROLE_DELETED = 'POLICY.ROLE_DELETED',

    // Permission events
    PERMISSION_CREATED = 'POLICY.PERMISSION_CREATED',
    PERMISSION_UPDATED = 'POLICY.PERMISSION_UPDATED',
    PERMISSION_DELETED = 'POLICY.PERMISSION_DELETED',

    // Role-Permission association events
    ROLE_PERMISSION_ASSIGNED = 'POLICY.ROLE_PERMISSION_ASSIGNED',
    ROLE_PERMISSION_REVOKED = 'POLICY.ROLE_PERMISSION_REVOKED',

    // Bulk sync events
    FULL_SYNC_REQUESTED = 'POLICY.FULL_SYNC_REQUESTED',
}

export interface RoleData {
    id: string;
    name: string;
    description?: string | null;
}

export interface PermissionData {
    id: string;
    name: string;
    description?: string | null;
    resource: string;
    action: string;
}

export interface RolePermissionData {
    roleId: string;
    roleName: string;
    permissions: Array<{
        id: string;
        resource: string;
        action: string;
    }>;
}

export interface PolicyEvent<T = unknown> {
    eventType: PolicyEventType;
    eventId: string;
    timestamp: string;
    tenantId?: string;
    source: string;
    data: T;
    metadata?: Record<string, unknown>;
}

export interface RoleCreatedEvent extends PolicyEvent<RoleData> {
    eventType: PolicyEventType.ROLE_CREATED;
}

export interface RoleUpdatedEvent extends PolicyEvent<RoleData> {
    eventType: PolicyEventType.ROLE_UPDATED;
}

export interface RoleDeletedEvent extends PolicyEvent<{ roleId: string; roleName: string }> {
    eventType: PolicyEventType.ROLE_DELETED;
}

export interface PermissionCreatedEvent extends PolicyEvent<PermissionData> {
    eventType: PolicyEventType.PERMISSION_CREATED;
}

export interface PermissionUpdatedEvent extends PolicyEvent<PermissionData> {
    eventType: PolicyEventType.PERMISSION_UPDATED;
}

export interface PermissionDeletedEvent extends PolicyEvent<{ permissionId: string }> {
    eventType: PolicyEventType.PERMISSION_DELETED;
}

export interface RolePermissionAssignedEvent extends PolicyEvent<RolePermissionData> {
    eventType: PolicyEventType.ROLE_PERMISSION_ASSIGNED;
}

export interface RolePermissionRevokedEvent extends PolicyEvent<RolePermissionData> {
    eventType: PolicyEventType.ROLE_PERMISSION_REVOKED;
}

export interface FullSyncRequestedEvent extends PolicyEvent<{ requestedBy: string }> {
    eventType: PolicyEventType.FULL_SYNC_REQUESTED;
}

export type AnyPolicyEvent =
    | RoleCreatedEvent
    | RoleUpdatedEvent
    | RoleDeletedEvent
    | PermissionCreatedEvent
    | PermissionUpdatedEvent
    | PermissionDeletedEvent
    | RolePermissionAssignedEvent
    | RolePermissionRevokedEvent
    | FullSyncRequestedEvent;

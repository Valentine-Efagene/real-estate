import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

export interface Permission {
    id: string;
    name: string;
    description?: string;
    path: string;
    methods: string[];
    effect: 'ALLOW' | 'DENY';
    tenantId?: string;
    isSystem?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Role {
    id: string;
    name: string;
    description?: string;
    tenantId?: string;
    isSystem?: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    permissions?: Permission[];
    _count?: {
        permissions: number;
        memberships: number;
    };
}

export interface CreateRoleInput {
    name: string;
    description?: string;
    tenantId?: string;
    isSystem?: boolean;
}

export interface UpdateRoleInput {
    name?: string;
    description?: string;
    isActive?: boolean;
}

export interface CreatePermissionInput {
    name: string;
    description?: string;
    path: string;
    methods: string[];
    effect?: 'ALLOW' | 'DENY';
    tenantId?: string;
}

export interface TenantMembership {
    id: string;
    userId: string;
    tenantId: string;
    roleId: string;
    isActive: boolean;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
    };
    role?: Role;
}

// ============================================================================
// Query Keys
// ============================================================================

export const authorizationKeys = {
    all: ['authorization'] as const,
    roles: () => [...authorizationKeys.all, 'roles'] as const,
    rolesList: (tenantId?: string) => [...authorizationKeys.roles(), 'list', tenantId] as const,
    role: (id: string) => [...authorizationKeys.roles(), id] as const,
    rolePermissions: (id: string) => [...authorizationKeys.roles(), id, 'permissions'] as const,
    permissions: () => [...authorizationKeys.all, 'permissions'] as const,
    permissionsList: (tenantId?: string) => [...authorizationKeys.permissions(), 'list', tenantId] as const,
    permission: (id: string) => [...authorizationKeys.permissions(), id] as const,
    memberships: () => [...authorizationKeys.all, 'memberships'] as const,
    membershipsList: (tenantId?: string) => [...authorizationKeys.memberships(), 'list', tenantId] as const,
};

// ============================================================================
// Roles Hooks
// ============================================================================

export function useRoles(tenantId?: string) {
    return useQuery({
        queryKey: authorizationKeys.rolesList(tenantId),
        queryFn: async () => {
            const params = tenantId ? `?tenantId=${tenantId}` : '';
            const response = await userApi.get<Role[]>(`/roles${params}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch roles');
            }
            return response.data;
        },
    });
}

export function useRole(id: string) {
    return useQuery({
        queryKey: authorizationKeys.role(id),
        queryFn: async () => {
            const response = await userApi.get<Role>(`/roles/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch role');
            }
            return response.data;
        },
        enabled: !!id,
    });
}

export function useRolePermissions(roleId: string) {
    return useQuery({
        queryKey: authorizationKeys.rolePermissions(roleId),
        queryFn: async () => {
            const response = await userApi.get<Permission[]>(`/roles/${roleId}/permissions`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch role permissions');
            }
            return response.data;
        },
        enabled: !!roleId,
    });
}

export function useCreateRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateRoleInput) => {
            const response = await userApi.post<Role>('/roles', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create role');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.roles() });
        },
    });
}

export function useUpdateRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateRoleInput }) => {
            const response = await userApi.put<Role>(`/roles/${id}`, data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update role');
            }
            return response.data;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.roles() });
            queryClient.invalidateQueries({ queryKey: authorizationKeys.role(id) });
        },
    });
}

export function useDeleteRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await userApi.delete(`/roles/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete role');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.roles() });
        },
    });
}

export function useAssignRolePermissions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => {
            const response = await userApi.put<Role>(`/roles/${roleId}/permissions`, { permissionIds });
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to assign permissions');
            }
            return response.data;
        },
        onSuccess: (_, { roleId }) => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.rolePermissions(roleId) });
            queryClient.invalidateQueries({ queryKey: authorizationKeys.role(roleId) });
        },
    });
}

// ============================================================================
// Permissions Hooks
// ============================================================================

export function usePermissions(tenantId?: string) {
    return useQuery({
        queryKey: authorizationKeys.permissionsList(tenantId),
        queryFn: async () => {
            const params = tenantId ? `?tenantId=${tenantId}` : '';
            const response = await userApi.get<Permission[]>(`/permissions${params}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch permissions');
            }
            return response.data;
        },
    });
}

export function usePermission(id: string) {
    return useQuery({
        queryKey: authorizationKeys.permission(id),
        queryFn: async () => {
            const response = await userApi.get<Permission>(`/permissions/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch permission');
            }
            return response.data;
        },
        enabled: !!id,
    });
}

export function useCreatePermission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreatePermissionInput) => {
            const response = await userApi.post<Permission>('/permissions', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create permission');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.permissions() });
        },
    });
}

export function useCreateCrudPermissions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { resourcePath: string; resourceName: string; tenantId?: string }) => {
            const response = await userApi.post<Permission[]>('/permissions/crud', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create CRUD permissions');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.permissions() });
        },
    });
}

export function useUpdatePermission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<CreatePermissionInput> }) => {
            const response = await userApi.put<Permission>(`/permissions/${id}`, data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update permission');
            }
            return response.data;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.permissions() });
            queryClient.invalidateQueries({ queryKey: authorizationKeys.permission(id) });
        },
    });
}

export function useDeletePermission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await userApi.delete(`/permissions/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete permission');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.permissions() });
        },
    });
}

// ============================================================================
// Tenant Membership Hooks
// ============================================================================

export function useTenantMemberships(tenantId?: string) {
    return useQuery({
        queryKey: authorizationKeys.membershipsList(tenantId),
        queryFn: async () => {
            const params = tenantId ? `?tenantId=${tenantId}` : '';
            const response = await userApi.get<TenantMembership[]>(`/tenant-memberships${params}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch memberships');
            }
            return response.data;
        },
    });
}

export function useAssignUserRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { userId: string; tenantId: string; roleId: string }) => {
            const response = await userApi.post<TenantMembership>('/tenant-memberships', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to assign role');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.memberships() });
        },
    });
}

export function useUpdateUserRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ membershipId, roleId }: { membershipId: string; roleId: string }) => {
            const response = await userApi.put<TenantMembership>(`/tenant-memberships/${membershipId}`, { roleId });
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update role');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: authorizationKeys.memberships() });
        },
    });
}

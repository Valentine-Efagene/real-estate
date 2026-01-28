'use client';

import { useAuth } from '@/lib/auth/auth-context';

const TENANT_ID_KEY = 'qshelter_tenant_id';

/**
 * Store tenantId in localStorage (called after bootstrap)
 */
export function setStoredTenantId(tenantId: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(TENANT_ID_KEY, tenantId);
    }
}

/**
 * Get tenantId from localStorage
 */
export function getStoredTenantId(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    return localStorage.getItem(TENANT_ID_KEY);
}

/**
 * Clear tenantId from localStorage
 */
export function clearStoredTenantId(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(TENANT_ID_KEY);
    }
}

/**
 * Hook to get the current tenant ID.
 * Prioritizes the auth context (JWT) if available, falls back to localStorage.
 * 
 * Usage:
 * const { tenantId, isLoading, error } = useTenant();
 */
export function useTenant() {
    const { user, isLoading: authLoading } = useAuth();

    // If authenticated, use tenantId from JWT
    if (user?.tenantId) {
        return {
            tenantId: user.tenantId,
            isLoading: false,
            error: null,
        };
    }

    // If still loading auth, wait
    if (authLoading) {
        return {
            tenantId: null,
            isLoading: true,
            error: null,
        };
    }

    // Fall back to localStorage (for unauthenticated flows like registration)
    const storedTenantId = getStoredTenantId();

    if (storedTenantId) {
        return {
            tenantId: storedTenantId,
            isLoading: false,
            error: null,
        };
    }

    // No tenantId available
    return {
        tenantId: null,
        isLoading: false,
        error: 'No tenant configured. Please run Bootstrap first from the home page.',
    };
}

/**
 * Get tenantId for API calls (non-hook version for use in callbacks)
 * Throws if tenantId is not available.
 */
export function requireTenantId(): string {
    const storedTenantId = getStoredTenantId();
    if (storedTenantId) {
        return storedTenantId;
    }
    throw new Error('No tenant configured. Please run Bootstrap first from the home page.');
}

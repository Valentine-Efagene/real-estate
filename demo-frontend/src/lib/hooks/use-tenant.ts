'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { useQuery } from '@tanstack/react-query';

const TENANT_ID_KEY = 'qshelter_tenant_id';

interface BootstrapStatus {
    bootstrapped: boolean;
    tenantId?: string;
    tenantName?: string;
    subdomain?: string;
    message?: string;
}

/**
 * Fetch bootstrap status via the Next.js proxy (avoids CORS issues)
 */
async function fetchBootstrapStatus(): Promise<BootstrapStatus> {
    const response = await fetch('/api/proxy/user/admin/public/bootstrap-status');
    if (!response.ok) {
        throw new Error(`Failed to fetch bootstrap status: ${response.status}`);
    }
    const data = await response.json();
    // Proxy returns the backend response directly
    return data.data ?? data;
}

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
 * Prioritizes the auth context (JWT) if available, then localStorage,
 * then fetches from the API as a fallback (cross-browser support).
 * 
 * Usage:
 * const { tenantId, isLoading, error } = useTenant();
 */
export function useTenant() {
    const { user, isLoading: authLoading } = useAuth();
    const storedTenantId = getStoredTenantId();

    // Only fetch from API if we don't have tenantId in localStorage or auth context
    const shouldFetch = !user?.tenantId && !authLoading && !storedTenantId;

    const { data: bootstrapStatus, isLoading: statusLoading, error: statusError } = useQuery({
        queryKey: ['bootstrap-status'],
        queryFn: fetchBootstrapStatus,
        enabled: shouldFetch,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: 1,
    });

    // Store tenantId in localStorage when we get it from API
    if (bootstrapStatus?.bootstrapped && bootstrapStatus.tenantId && !storedTenantId) {
        setStoredTenantId(bootstrapStatus.tenantId);
    }

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

    // Check localStorage first
    if (storedTenantId) {
        return {
            tenantId: storedTenantId,
            isLoading: false,
            error: null,
        };
    }

    // Check if we're loading from API
    if (statusLoading) {
        return {
            tenantId: null,
            isLoading: true,
            error: null,
        };
    }

    // Check if API returned bootstrap status
    if (bootstrapStatus?.bootstrapped && bootstrapStatus.tenantId) {
        return {
            tenantId: bootstrapStatus.tenantId,
            isLoading: false,
            error: null,
        };
    }

    // No tenantId available
    return {
        tenantId: null,
        isLoading: false,
        error: statusError?.message || 'No tenant configured. Please run Bootstrap first from the home page.',
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

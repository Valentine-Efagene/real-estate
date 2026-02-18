'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mortgageApi } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

export interface GatePlan {
    id: string;
    tenantId: string;
    name: string;
    description: string | null;
    isActive: boolean;
    requiredApprovals: number;
    reviewerOrganizationTypeId: string | null;
    reviewerOrganizationType?: {
        id: string;
        code: string;
        name: string;
    } | null;
    reviewerInstructions: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateGatePlanInput {
    name: string;
    description?: string;
    isActive?: boolean;
    requiredApprovals?: number;
    reviewerOrganizationTypeCode: string;
    reviewerInstructions?: string;
}

export interface UpdateGatePlanInput {
    name?: string;
    description?: string;
    isActive?: boolean;
    requiredApprovals?: number;
    reviewerOrganizationTypeCode?: string;
    reviewerInstructions?: string;
}

// ============================================================================
// Query Keys
// ============================================================================

const gatePlanKeys = {
    all: ['gate-plans'] as const,
    list: () => ['gate-plans', 'list'] as const,
    detail: (id: string) => ['gate-plans', 'detail', id] as const,
};

// ============================================================================
// Hooks
// ============================================================================

export function useGatePlans() {
    return useQuery({
        queryKey: gatePlanKeys.list(),
        queryFn: async () => {
            const response = await mortgageApi.get<GatePlan[]>('/gate-plans');
            return response.data;
        },
    });
}

export function useGatePlan(id: string) {
    return useQuery({
        queryKey: gatePlanKeys.detail(id),
        queryFn: async () => {
            const response = await mortgageApi.get<GatePlan>(`/gate-plans/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
}

export function useCreateGatePlan() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateGatePlanInput) => {
            const response = await mortgageApi.post<GatePlan>('/gate-plans', data);
            return response.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: gatePlanKeys.all });
            // Also invalidate onboarding flow reference plans (they include gate plans)
            qc.invalidateQueries({ queryKey: ['onboarding-flows', 'reference'] });
        },
    });
}

export function useUpdateGatePlan() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...data }: UpdateGatePlanInput & { id: string }) => {
            const response = await mortgageApi.put<GatePlan>(`/gate-plans/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: gatePlanKeys.all });
            qc.invalidateQueries({ queryKey: ['onboarding-flows', 'reference'] });
        },
    });
}

export function useDeleteGatePlan() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await mortgageApi.delete<{ deleted: boolean }>(`/gate-plans/${id}`);
            return response.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: gatePlanKeys.all });
            qc.invalidateQueries({ queryKey: ['onboarding-flows', 'reference'] });
        },
    });
}

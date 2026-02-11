'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

export type PhaseCategory = 'QUESTIONNAIRE' | 'DOCUMENTATION' | 'GATE';

export interface PlanRef {
    id: string;
    name: string;
    description?: string | null;
    isActive?: boolean;
    requiredApprovals?: number;
    category?: string;
}

export interface OnboardingMethodPhase {
    id: string;
    name: string;
    description: string | null;
    phaseCategory: PhaseCategory;
    phaseType: string;
    order: number;
    requiresPreviousPhaseCompletion: boolean;
    questionnairePlan: PlanRef | null;
    documentationPlan: PlanRef | null;
    gatePlan: PlanRef | null;
}

export interface OrgTypeRef {
    id: string;
    code: string;
    name: string;
    onboardingMethodId?: string | null;
}

export interface OnboardingMethod {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    autoActivatePhases: boolean;
    expiresInDays: number | null;
    createdAt: string;
    updatedAt: string;
    phases: OnboardingMethodPhase[];
    organizationTypes: OrgTypeRef[];
    _count: { onboardings: number };
}

export interface ReferencePlans {
    questionnairePlans: PlanRef[];
    documentationPlans: PlanRef[];
    gatePlans: PlanRef[];
    orgTypes: OrgTypeRef[];
}

export interface CreateOnboardingMethodInput {
    name: string;
    description?: string;
    isActive?: boolean;
    autoActivatePhases?: boolean;
    expiresInDays?: number | null;
}

export interface UpdateOnboardingMethodInput {
    name?: string;
    description?: string;
    isActive?: boolean;
    autoActivatePhases?: boolean;
    expiresInDays?: number | null;
}

export interface AddPhaseInput {
    name: string;
    description?: string;
    phaseCategory: PhaseCategory;
    phaseType: string;
    order: number;
    requiresPreviousPhaseCompletion?: boolean;
    questionnairePlanId?: string;
    documentationPlanId?: string;
    gatePlanId?: string;
}

export interface UpdatePhaseInput {
    name?: string;
    description?: string;
    phaseType?: string;
    order?: number;
    requiresPreviousPhaseCompletion?: boolean;
    questionnairePlanId?: string | null;
    documentationPlanId?: string | null;
    gatePlanId?: string | null;
}

// ============================================================================
// Query Keys
// ============================================================================

export const onboardingMethodKeys = {
    all: ['onboarding-methods'] as const,
    list: () => ['onboarding-methods', 'list'] as const,
    detail: (id: string) => ['onboarding-methods', 'detail', id] as const,
    reference: () => ['onboarding-methods', 'reference'] as const,
};

// ============================================================================
// Hooks — Queries
// ============================================================================

export function useOnboardingMethods() {
    return useQuery({
        queryKey: onboardingMethodKeys.list(),
        queryFn: async () => {
            const response = await userApi.get<OnboardingMethod[]>('/onboarding-methods');
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch onboarding methods');
            }
            return response.data!;
        },
    });
}

export function useOnboardingMethod(id: string) {
    return useQuery({
        queryKey: onboardingMethodKeys.detail(id),
        queryFn: async () => {
            const response = await userApi.get<OnboardingMethod>(`/onboarding-methods/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch onboarding method');
            }
            return response.data!;
        },
        enabled: !!id,
    });
}

export function useReferencePlans() {
    return useQuery({
        queryKey: onboardingMethodKeys.reference(),
        queryFn: async () => {
            const response = await userApi.get<ReferencePlans>('/onboarding-methods/reference/plans');
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch reference plans');
            }
            return response.data!;
        },
    });
}

// ============================================================================
// Hooks — Mutations
// ============================================================================

export function useCreateOnboardingMethod() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateOnboardingMethodInput) => {
            const response = await userApi.post<OnboardingMethod>('/onboarding-methods', data);
            if (!response.success) throw new Error(response.error?.message || 'Failed to create');
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.all });
        },
    });
}

export function useUpdateOnboardingMethod() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...data }: UpdateOnboardingMethodInput & { id: string }) => {
            const response = await userApi.patch<OnboardingMethod>(`/onboarding-methods/${id}`, data);
            if (!response.success) throw new Error(response.error?.message || 'Failed to update');
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.all });
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.detail(variables.id) });
        },
    });
}

export function useDeleteOnboardingMethod() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await userApi.delete<{ deleted: boolean }>(`/onboarding-methods/${id}`);
            if (!response.success) throw new Error(response.error?.message || 'Failed to delete');
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.all });
        },
    });
}

export function useAddMethodPhase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ methodId, ...data }: AddPhaseInput & { methodId: string }) => {
            const response = await userApi.post<OnboardingMethodPhase>(`/onboarding-methods/${methodId}/phases`, data);
            if (!response.success) throw new Error(response.error?.message || 'Failed to add phase');
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.detail(variables.methodId) });
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.list() });
        },
    });
}

export function useUpdateMethodPhase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ methodId, phaseId, ...data }: UpdatePhaseInput & { methodId: string; phaseId: string }) => {
            const response = await userApi.patch<OnboardingMethodPhase>(`/onboarding-methods/${methodId}/phases/${phaseId}`, data);
            if (!response.success) throw new Error(response.error?.message || 'Failed to update phase');
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.detail(variables.methodId) });
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.list() });
        },
    });
}

export function useRemoveMethodPhase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ methodId, phaseId }: { methodId: string; phaseId: string }) => {
            const response = await userApi.delete<{ deleted: boolean }>(`/onboarding-methods/${methodId}/phases/${phaseId}`);
            if (!response.success) throw new Error(response.error?.message || 'Failed to remove phase');
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.detail(variables.methodId) });
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.list() });
        },
    });
}

export function useLinkOrgType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ methodId, organizationTypeId }: { methodId: string; organizationTypeId: string }) => {
            const response = await userApi.post<OnboardingMethod>(`/onboarding-methods/${methodId}/org-types`, { organizationTypeId });
            if (!response.success) throw new Error(response.error?.message || 'Failed to link');
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.all });
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.reference() });
        },
    });
}

export function useUnlinkOrgType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ methodId, orgTypeId }: { methodId: string; orgTypeId: string }) => {
            const response = await userApi.delete<OnboardingMethod>(`/onboarding-methods/${methodId}/org-types/${orgTypeId}`);
            if (!response.success) throw new Error(response.error?.message || 'Failed to unlink');
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.all });
            queryClient.invalidateQueries({ queryKey: onboardingMethodKeys.reference() });
        },
    });
}

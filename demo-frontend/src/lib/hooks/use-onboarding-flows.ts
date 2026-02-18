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

export interface OnboardingFlowPhase {
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
    onboardingFlowId?: string | null;
}

export interface OnboardingFlow {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    autoActivatePhases: boolean;
    expiresInDays: number | null;
    createdAt: string;
    updatedAt: string;
    phases: OnboardingFlowPhase[];
    organizationTypes: OrgTypeRef[];
    _count: { onboardings: number };
}

export interface ReferencePlans {
    questionnairePlans: PlanRef[];
    documentationPlans: PlanRef[];
    gatePlans: PlanRef[];
    orgTypes: OrgTypeRef[];
}

export interface CreateOnboardingFlowInput {
    name: string;
    description?: string;
    isActive?: boolean;
    autoActivatePhases?: boolean;
    expiresInDays?: number | null;
}

export interface UpdateOnboardingFlowInput {
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

export const onboardingFlowKeys = {
    all: ['onboarding-flows'] as const,
    list: () => ['onboarding-flows', 'list'] as const,
    detail: (id: string) => ['onboarding-flows', 'detail', id] as const,
    reference: () => ['onboarding-flows', 'reference'] as const,
};

// ============================================================================
// Hooks — Queries
// ============================================================================

export function useOnboardingFlows() {
    return useQuery({
        queryKey: onboardingFlowKeys.list(),
        queryFn: async () => {
            const response = await userApi.get<OnboardingFlow[]>('/onboarding-flows');
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch onboarding flows');
            }
            return response.data!;
        },
    });
}

export function useOnboardingFlow(id: string) {
    return useQuery({
        queryKey: onboardingFlowKeys.detail(id),
        queryFn: async () => {
            const response = await userApi.get<OnboardingFlow>(`/onboarding-flows/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch onboarding flow');
            }
            return response.data!;
        },
        enabled: !!id,
    });
}

export function useReferencePlans() {
    return useQuery({
        queryKey: onboardingFlowKeys.reference(),
        queryFn: async () => {
            const response = await userApi.get<ReferencePlans>('/onboarding-flows/reference/plans');
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

export function useCreateOnboardingFlow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateOnboardingFlowInput) => {
            const response = await userApi.post<OnboardingFlow>('/onboarding-flows', data);
            if (!response.success) throw new Error(response.error?.message || 'Failed to create');
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.all });
        },
    });
}

export function useUpdateOnboardingFlow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...data }: UpdateOnboardingFlowInput & { id: string }) => {
            const response = await userApi.patch<OnboardingFlow>(`/onboarding-flows/${id}`, data);
            if (!response.success) throw new Error(response.error?.message || 'Failed to update');
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.all });
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.detail(variables.id) });
        },
    });
}

export function useDeleteOnboardingFlow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await userApi.delete<{ deleted: boolean }>(`/onboarding-flows/${id}`);
            if (!response.success) throw new Error(response.error?.message || 'Failed to delete');
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.all });
        },
    });
}

export function useAddFlowPhase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ flowId, ...data }: AddPhaseInput & { flowId: string }) => {
            const response = await userApi.post<OnboardingFlowPhase>(`/onboarding-flows/${flowId}/phases`, data);
            if (!response.success) throw new Error(response.error?.message || 'Failed to add phase');
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.detail(variables.flowId) });
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.list() });
        },
    });
}

export function useUpdateFlowPhase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ flowId, phaseId, ...data }: UpdatePhaseInput & { flowId: string; phaseId: string }) => {
            const response = await userApi.patch<OnboardingFlowPhase>(`/onboarding-flows/${flowId}/phases/${phaseId}`, data);
            if (!response.success) throw new Error(response.error?.message || 'Failed to update phase');
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.detail(variables.flowId) });
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.list() });
        },
    });
}

export function useRemoveFlowPhase() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ flowId, phaseId }: { flowId: string; phaseId: string }) => {
            const response = await userApi.delete<{ deleted: boolean }>(`/onboarding-flows/${flowId}/phases/${phaseId}`);
            if (!response.success) throw new Error(response.error?.message || 'Failed to remove phase');
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.detail(variables.flowId) });
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.list() });
        },
    });
}

export function useLinkOrgType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ flowId, organizationTypeId }: { flowId: string; organizationTypeId: string }) => {
            const response = await userApi.post<OnboardingFlow>(`/onboarding-flows/${flowId}/org-types`, { organizationTypeId });
            if (!response.success) throw new Error(response.error?.message || 'Failed to link');
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.all });
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.reference() });
        },
    });
}

export function useUnlinkOrgType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ flowId, orgTypeId }: { flowId: string; orgTypeId: string }) => {
            const response = await userApi.delete<OnboardingFlow>(`/onboarding-flows/${flowId}/org-types/${orgTypeId}`);
            if (!response.success) throw new Error(response.error?.message || 'Failed to unlink');
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.all });
            queryClient.invalidateQueries({ queryKey: onboardingFlowKeys.reference() });
        },
    });
}

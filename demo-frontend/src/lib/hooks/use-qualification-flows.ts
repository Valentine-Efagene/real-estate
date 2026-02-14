'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { mortgageApi } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

export type QualFlowPhaseCategory = 'QUESTIONNAIRE' | 'DOCUMENTATION' | 'GATE';
export type QualFlowPhaseType =
    | 'PRE_APPROVAL'
    | 'UNDERWRITING'
    | 'KYC'
    | 'VERIFICATION'
    | 'APPROVAL_GATE'
    | 'ORG_KYB';

export interface QualificationFlowPhase {
    id: string;
    name: string;
    description: string | null;
    phaseCategory: QualFlowPhaseCategory;
    phaseType: QualFlowPhaseType;
    order: number;
    questionnairePlanId: string | null;
    documentationPlanId: string | null;
    questionnairePlan?: { id: string; name: string } | null;
    documentationPlan?: { id: string; name: string } | null;
}

export interface QualificationFlow {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    phases: QualificationFlowPhase[];
}

export interface CreateQualificationFlowInput {
    name: string;
    description?: string;
    isActive?: boolean;
    phases?: CreateQualificationFlowPhaseInput[];
}

export interface UpdateQualificationFlowInput {
    name?: string;
    description?: string;
    isActive?: boolean;
    phases?: CreateQualificationFlowPhaseInput[];
}

export interface CreateQualificationFlowPhaseInput {
    name: string;
    description?: string;
    phaseCategory: QualFlowPhaseCategory;
    phaseType: QualFlowPhaseType;
    order: number;
    questionnairePlanId?: string;
    documentationPlanId?: string;
}

// ============================================================================
// Hooks — Queries
// ============================================================================

export function useQualificationFlows() {
    return useQuery({
        queryKey: queryKeys.qualificationFlows.all,
        queryFn: async () => {
            const response = await mortgageApi.get<QualificationFlow[]>(
                '/qualification-flows?includePhases=true'
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch qualification flows');
            }
            return response.data!;
        },
    });
}

export function useQualificationFlow(id: string) {
    return useQuery({
        queryKey: queryKeys.qualificationFlows.detail(id),
        queryFn: async () => {
            const response = await mortgageApi.get<QualificationFlow>(
                `/qualification-flows/${id}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch qualification flow');
            }
            return response.data!;
        },
        enabled: !!id,
    });
}

// ============================================================================
// Hooks — Mutations
// ============================================================================

export function useCreateQualificationFlow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: CreateQualificationFlowInput) => {
            const response = await mortgageApi.post<QualificationFlow>(
                '/qualification-flows',
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create qualification flow');
            }
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.qualificationFlows.all });
        },
    });
}

export function useUpdateQualificationFlow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateQualificationFlowInput }) => {
            const response = await mortgageApi.put<QualificationFlow>(
                `/qualification-flows/${id}`,
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update qualification flow');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.qualificationFlows.all });
            queryClient.invalidateQueries({
                queryKey: queryKeys.qualificationFlows.detail(variables.id),
            });
        },
    });
}

export function useDeleteQualificationFlow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await mortgageApi.delete(`/qualification-flows/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete qualification flow');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.qualificationFlows.all });
        },
    });
}

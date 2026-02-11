'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

export type OnboardingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'EXPIRED';
export type PhaseStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'AWAITING_APPROVAL' | 'SKIPPED' | 'FAILED' | 'SUPERSEDED';
export type PhaseCategory = 'QUESTIONNAIRE' | 'DOCUMENTATION' | 'GATE';
export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';

export interface OnboardingAssignee {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
}

export interface OnboardingPhase {
    id: string;
    name: string;
    description: string | null;
    phaseCategory: PhaseCategory;
    phaseType: string | null;
    order: number;
    status: PhaseStatus;
    activatedAt: string | null;
    completedAt: string | null;
    requiresPreviousPhaseCompletion: boolean;
    questionnairePhase: QuestionnairePhaseExtension | null;
    documentationPhase: DocumentationPhaseExtension | null;
    gatePhase: GatePhaseExtension | null;
}

export interface QuestionnaireField {
    id: string;
    name: string;
    fieldType: string;
    label: string;
    description: string | null;
    order: number;
    isRequired: boolean;
    validation: Record<string, unknown> | null;
    defaultValue: Record<string, unknown> | null;
    answer: string | null;
    isValid: boolean | null;
    submittedAt: string | null;
}

export interface QuestionnairePhaseExtension {
    id: string;
    totalFieldsCount: number;
    completedFieldsCount: number;
    passingScore: number | null;
    fields: QuestionnaireField[];
    fieldsSnapshot: {
        questions: Array<{
            questionKey: string;
            questionText: string;
            helpText: string | null;
            questionType: string;
            order: number;
            isRequired: boolean;
            options: string[] | null;
        }>;
    } | null;
}

export interface ApprovalStageProgress {
    id: string;
    name: string;
    order: number;
    status: string;
    activatedAt: string | null;
    completedAt: string | null;
}

export interface DocumentationPhaseExtension {
    id: string;
    currentStageOrder: number;
    requiredDocumentsCount: number;
    approvedDocumentsCount: number;
    stageProgress: ApprovalStageProgress[];
    documentDefinitionsSnapshot: Array<{
        documentType: string;
        documentName: string;
        uploadedBy: string;
        order: number;
        isRequired: boolean;
        description: string | null;
    }> | null;
}

export interface GatePhaseReview {
    id: string;
    reviewerId: string;
    reviewer: {
        id: string;
        firstName: string | null;
        lastName: string | null;
    };
    decision: ReviewDecision;
    notes: string | null;
    createdAt: string;
}

export interface GatePhaseExtension {
    id: string;
    requiredApprovals: number;
    approvalCount: number;
    rejectionCount: number;
    rejectionReason: string | null;
    reviewerInstructions: string | null;
    reviews: GatePhaseReview[];
}

export interface OrganizationOnboarding {
    id: string;
    organizationId: string;
    status: OnboardingStatus;
    startedAt: string | null;
    completedAt: string | null;
    expiresAt: string | null;
    rejectionReason: string | null;
    approvedAt: string | null;
    organization: {
        id: string;
        name: string;
        status: string;
    };
    assignee: OnboardingAssignee | null;
    approvedBy: OnboardingAssignee | null;
    onboardingFlow: {
        id: string;
        name: string;
    };
    currentPhase: {
        id: string;
        name: string;
        phaseCategory: PhaseCategory;
        order: number;
    } | null;
    phases: OnboardingPhase[];
}

// ============================================================================
// Query Keys
// ============================================================================

export const onboardingKeys = {
    all: ['onboarding'] as const,
    byOrg: (orgId: string) => ['onboarding', 'org', orgId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch the onboarding status for an organization.
 * Returns null/undefined if the org has no onboarding (e.g., PLATFORM type).
 */
export function useOnboarding(organizationId: string | null) {
    return useQuery({
        queryKey: onboardingKeys.byOrg(organizationId || ''),
        queryFn: async () => {
            const response = await userApi.get<OrganizationOnboarding>(
                `/organizations/${organizationId}/onboarding`
            );
            if (!response.success) {
                // 404 means no onboarding exists — that's fine
                if (response.error?.code === 'NOT_FOUND' || response.error?.message?.includes('not found')) {
                    return null;
                }
                throw new Error(response.error?.message || 'Failed to fetch onboarding');
            }
            return response.data!;
        },
        enabled: !!organizationId,
        retry: (failureCount, error) => {
            // Don't retry 404s
            if (error instanceof Error && error.message.includes('not found')) return false;
            return failureCount < 2;
        },
    });
}

/**
 * Start the onboarding workflow manually.
 */
export function useStartOnboarding() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ organizationId }: { organizationId: string }) => {
            const response = await userApi.post<OrganizationOnboarding>(
                `/organizations/${organizationId}/onboarding/start`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to start onboarding');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingKeys.byOrg(variables.organizationId) });
        },
    });
}

/**
 * Submit questionnaire field answers for an onboarding phase.
 */
export function useSubmitOnboardingQuestionnaire() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            organizationId,
            phaseId,
            fields,
        }: {
            organizationId: string;
            phaseId: string;
            fields: Array<{ fieldId: string; value: unknown }>;
        }) => {
            const response = await userApi.post<OrganizationOnboarding>(
                `/organizations/${organizationId}/onboarding/phases/${phaseId}/questionnaire`,
                { fields }
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to submit questionnaire');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingKeys.byOrg(variables.organizationId) });
        },
    });
}

/**
 * Review a gate phase (approve/reject).
 */
export function useReviewGatePhase() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            organizationId,
            phaseId,
            decision,
            notes,
        }: {
            organizationId: string;
            phaseId: string;
            decision: ReviewDecision;
            notes?: string;
        }) => {
            const response = await userApi.post<OrganizationOnboarding>(
                `/organizations/${organizationId}/onboarding/phases/${phaseId}/gate/review`,
                { decision, notes }
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to submit review');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingKeys.byOrg(variables.organizationId) });
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
        },
    });
}

/**
 * Reassign the onboarder to a different org member.
 */
export function useReassignOnboarder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            organizationId,
            newAssigneeId,
        }: {
            organizationId: string;
            newAssigneeId: string;
        }) => {
            const response = await userApi.patch<OrganizationOnboarding>(
                `/organizations/${organizationId}/onboarding/reassign`,
                { newAssigneeId }
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to reassign onboarder');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingKeys.byOrg(variables.organizationId) });
        },
    });
}

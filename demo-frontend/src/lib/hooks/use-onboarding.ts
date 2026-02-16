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
                // Backend may return error as a plain string or as { code, message }
                const errMsg = typeof response.error === 'string'
                    ? response.error
                    : (response.error?.message || '');
                if (response.error?.code === 'NOT_FOUND' || errMsg.toLowerCase().includes('not found')) {
                    return null;
                }
                throw new Error(errMsg || 'Failed to fetch onboarding');
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
 * Create onboarding for an existing organization that doesn't have one yet.
 * The backend resolves the onboarding flow from the org's type.
 */
export function useCreateOnboarding() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ organizationId }: { organizationId: string }) => {
            const response = await userApi.post<OrganizationOnboarding>(
                `/organizations/${organizationId}/onboarding`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create onboarding');
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
 * Upload a document for an onboarding documentation phase.
 * Documents are auto-approved on upload. Phase auto-completes when all required docs are uploaded.
 */
export function useUploadOnboardingDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            organizationId,
            phaseId,
            documentType,
            url,
            fileName,
        }: {
            organizationId: string;
            phaseId: string;
            documentType: string;
            url: string;
            fileName: string;
        }) => {
            const response = await userApi.post<OrganizationOnboarding>(
                `/organizations/${organizationId}/onboarding/phases/${phaseId}/documents`,
                { documentType, url, fileName }
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to upload document');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: onboardingKeys.byOrg(variables.organizationId) });
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

// ============================================================================
// Current Action
// ============================================================================

export interface OnboardingCurrentAction {
    onboardingId: string;
    organizationId: string;
    organizationName: string;
    organizationStatus: string;
    onboardingStatus: OnboardingStatus;
    flowName: string;
    assignee: { id: string; email: string; name: string } | null;
    progress: {
        completedPhases: number;
        totalPhases: number;
        percentComplete: number;
    };
    currentPhase: {
        id: string;
        name: string;
        phaseCategory: PhaseCategory;
        order: number;
        status: string;
    } | null;
    actionRequired: string;
    actionMessage: string;
    actionBy: 'ASSIGNEE' | 'ADMIN' | 'SYSTEM' | 'NONE';
    blockerDetails: Record<string, unknown> | null;
    phases: Array<{
        id: string;
        name: string;
        order: number;
        phaseCategory: PhaseCategory;
        status: PhaseStatus;
        isCurrent: boolean;
        questionnaire?: {
            totalFields: number;
            answeredFields: number;
            requiredFields: number;
            unansweredRequiredFields: number;
            isComplete: boolean;
        };
        documentation?: {
            requiredDocumentsCount: number;
            approvedDocumentsCount: number;
            currentStageOrder: number;
            stages: Array<{ name: string; order: number; status: string }>;
        };
        gate?: {
            requiredApprovals: number;
            approvalCount: number;
            rejectionCount: number;
            reviews: Array<{
                reviewer: { id: string; name: string };
                decision: ReviewDecision;
                notes: string | null;
                createdAt: string;
            }>;
        };
    }>;
    timeline: {
        startedAt: string | null;
        completedAt: string | null;
        approvedAt: string | null;
        expiresAt: string | null;
    };
}

/**
 * Fetch the current action / diagnostic snapshot for an organization's onboarding.
 */
export function useOnboardingCurrentAction(organizationId: string | null) {
    return useQuery({
        queryKey: [...onboardingKeys.byOrg(organizationId || ''), 'current-action'],
        queryFn: async () => {
            const response = await userApi.get<OnboardingCurrentAction>(
                `/organizations/${organizationId}/onboarding/current-action`
            );
            if (!response.success) {
                const errMsg = typeof response.error === 'string'
                    ? response.error
                    : (response.error?.message || '');
                if (errMsg.toLowerCase().includes('not found')) {
                    return null;
                }
                throw new Error(errMsg || 'Failed to fetch onboarding current action');
            }
            return response.data!;
        },
        enabled: !!organizationId,
    });
}
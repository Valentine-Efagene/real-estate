'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { mortgageApi } from '@/lib/api/client';

export type PaymentFrequency = 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' | 'ONE_TIME' | 'CUSTOM';

export interface PaymentPlan {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    paymentFrequency: PaymentFrequency;
    customFrequencyDays: number | null;
    numberOfInstallments: number;
    calculateInterestDaily: boolean;
    gracePeriodDays: number;
    interestRate: number | null;
    collectFunds: boolean;
    allowFlexibleTerm: boolean;
    minTermMonths: number | null;
    maxTermMonths: number | null;
    termStepMonths: number | null;
    maxAgeAtMaturity: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePaymentPlanInput {
    name: string;
    description?: string;
    paymentFrequency: PaymentFrequency;
    numberOfInstallments?: number;
    interestRate?: number;
    gracePeriodDays?: number;
    collectFunds?: boolean;
    allowFlexibleTerm?: boolean;
    minTermMonths?: number;
    maxTermMonths?: number;
    termStepMonths?: number;
    maxAgeAtMaturity?: number;
}

export type PhaseCategory = 'QUESTIONNAIRE' | 'DOCUMENTATION' | 'PAYMENT';
export type PhaseType =
    | 'PRE_APPROVAL'
    | 'UNDERWRITING'
    | 'KYC'
    | 'VERIFICATION'
    | 'DOWNPAYMENT'
    | 'MORTGAGE'
    | 'BALLOON'
    | 'CUSTOM';

export interface PaymentMethodPhase {
    id: string;
    name: string;
    description: string | null;
    phaseCategory: PhaseCategory;
    phaseType: PhaseType;
    order: number;
    percentOfPrice: number | null;
    interestRate: number | null;
    paymentPlanId: string | null;
    documentationPlanId: string | null;
    questionnairePlanId: string | null;
    paymentPlan?: PaymentPlan | null;
}

export interface PaymentMethod {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    requiresManualApproval: boolean;
    createdAt: string;
    updatedAt: string;
    phases: PaymentMethodPhase[];
}

export interface CreatePaymentMethodPhase {
    name: string;
    description?: string;
    phaseCategory: PhaseCategory;
    phaseType: PhaseType;
    order: number;
    percentOfPrice?: number;
    interestRate?: number;
    paymentPlanId?: string;
    documentationPlanId?: string;
    questionnairePlanId?: string;
}

export interface CreatePaymentMethodInput {
    name: string;
    description?: string;
    requiresManualApproval?: boolean;
    phases?: CreatePaymentMethodPhase[];
}

export interface PropertyPaymentMethodLink {
    id: string;
    propertyId: string;
    paymentMethodId: string;
    isActive: boolean;
    paymentMethod: PaymentMethod;
}

// ============================================================================
// Payment Plans Hooks
// ============================================================================

export function usePaymentPlans() {
    return useQuery({
        queryKey: queryKeys.paymentPlans.all,
        queryFn: async () => {
            const response = await mortgageApi.get<PaymentPlan[]>('/payment-plans');
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch payment plans');
            }
            return response.data!;
        },
    });
}

export function usePaymentPlan(id: string) {
    return useQuery({
        queryKey: queryKeys.paymentPlans.detail(id),
        queryFn: async () => {
            const response = await mortgageApi.get<PaymentPlan>(`/payment-plans/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch payment plan');
            }
            return response.data!;
        },
        enabled: !!id,
    });
}

export function useCreatePaymentPlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreatePaymentPlanInput) => {
            const response = await mortgageApi.post<PaymentPlan>('/payment-plans', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create payment plan');
            }
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentPlans.all });
        },
    });
}

export function useUpdatePaymentPlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<CreatePaymentPlanInput> }) => {
            const response = await mortgageApi.patch<PaymentPlan>(`/payment-plans/${id}`, data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update payment plan');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentPlans.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentPlans.detail(variables.id) });
        },
    });
}

export function useDeletePaymentPlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await mortgageApi.delete(`/payment-plans/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete payment plan');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentPlans.all });
        },
    });
}

// ============================================================================
// Payment Methods Hooks
// ============================================================================

export function usePaymentMethodsList() {
    return useQuery({
        queryKey: queryKeys.paymentMethods.all,
        queryFn: async () => {
            const response = await mortgageApi.get<PaymentMethod[]>('/payment-methods');
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch payment methods');
            }
            return response.data!;
        },
    });
}

export function usePaymentMethod(id: string) {
    return useQuery({
        queryKey: queryKeys.paymentMethods.detail(id),
        queryFn: async () => {
            const response = await mortgageApi.get<PaymentMethod>(`/payment-methods/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch payment method');
            }
            return response.data!;
        },
        enabled: !!id,
    });
}

export function useCreatePaymentMethod() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreatePaymentMethodInput) => {
            const response = await mortgageApi.post<PaymentMethod>('/payment-methods', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create payment method');
            }
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all });
        },
    });
}

export function useUpdatePaymentMethod() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<CreatePaymentMethodInput> }) => {
            const response = await mortgageApi.patch<PaymentMethod>(`/payment-methods/${id}`, data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update payment method');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.detail(variables.id) });
        },
    });
}

export function useDeletePaymentMethod() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await mortgageApi.delete(`/payment-methods/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete payment method');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all });
        },
    });
}

// ============================================================================
// Property Payment Method Link Hooks
// ============================================================================

export function usePropertyPaymentMethods(propertyId: string) {
    return useQuery({
        queryKey: queryKeys.properties.paymentMethods(propertyId),
        queryFn: async () => {
            const response = await mortgageApi.get<PropertyPaymentMethodLink[]>(
                `/payment-methods/property/${propertyId}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch property payment methods');
            }
            return response.data!;
        },
        enabled: !!propertyId,
    });
}

export function useLinkPaymentMethodToProperty() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ paymentMethodId, propertyId }: { paymentMethodId: string; propertyId: string }) => {
            const response = await mortgageApi.post<PropertyPaymentMethodLink>(
                `/payment-methods/${paymentMethodId}/properties`,
                { propertyId }
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to link payment method to property');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.properties.paymentMethods(variables.propertyId) });
        },
    });
}

export function useUnlinkPaymentMethodFromProperty() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ paymentMethodId, propertyId }: { paymentMethodId: string; propertyId: string }) => {
            const response = await mortgageApi.delete(`/payment-methods/${paymentMethodId}/property/${propertyId}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to unlink payment method from property');
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.properties.paymentMethods(variables.propertyId) });
        },
    });
}

// ============================================================================
// Add Phase to Payment Method
// ============================================================================

export function useAddPhaseToPaymentMethod() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ paymentMethodId, phase }: { paymentMethodId: string; phase: CreatePaymentMethodPhase }) => {
            const response = await mortgageApi.post<PaymentMethodPhase>(
                `/payment-methods/${paymentMethodId}/phases`,
                phase
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to add phase to payment method');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.detail(variables.paymentMethodId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all });
        },
    });
}

export function useUpdatePhase() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            phaseId,
            data
        }: {
            paymentMethodId: string;
            phaseId: string;
            data: Partial<CreatePaymentMethodPhase>
        }) => {
            const response = await mortgageApi.patch<PaymentMethodPhase>(
                `/payment-methods/${paymentMethodId}/phases/${phaseId}`,
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update phase');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.detail(variables.paymentMethodId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all });
        },
    });
}

export function useDeletePhase() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            phaseId
        }: {
            paymentMethodId: string;
            phaseId: string;
        }) => {
            const response = await mortgageApi.delete(
                `/payment-methods/${paymentMethodId}/phases/${phaseId}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete phase');
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.detail(variables.paymentMethodId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all });
        },
    });
}

export function useReorderPhases() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            phaseOrders
        }: {
            paymentMethodId: string;
            phaseOrders: { phaseId: string; order: number }[];
        }) => {
            const response = await mortgageApi.post<PaymentMethod>(
                `/payment-methods/${paymentMethodId}/phases/reorder`,
                { phaseOrders }
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to reorder phases');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.detail(variables.paymentMethodId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all });
        },
    });
}

// ============================================================================
// Questionnaire Plans Hooks
// ============================================================================

export type QuestionType = 'TEXT' | 'NUMBER' | 'CURRENCY' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'RADIO' | 'CHECKBOX' | 'FILE_UPLOAD' | 'PHONE' | 'EMAIL' | 'ADDRESS' | 'PERCENTAGE' | 'YEARS_MONTHS';
export type ScoringStrategy = 'SUM' | 'AVERAGE' | 'WEIGHTED_SUM' | 'MIN_ALL' | 'CUSTOM';

export interface QuestionOption {
    value: string;
    label: string;
    score?: number;
}

export interface ScoringRule {
    operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'GREATER_THAN_OR_EQUAL' | 'LESS_THAN_OR_EQUAL' | 'CONTAINS' | 'IN';
    value: string | number | string[];
    score: number;
}

export interface QuestionDefinition {
    id?: string;
    questionKey: string;
    questionText: string;
    questionType: QuestionType;
    order: number;
    isRequired: boolean;
    options?: QuestionOption[];
    validationRules?: Record<string, unknown>;
    scoringRules?: ScoringRule[];
    scoreWeight?: number;
    category?: string;
    helpText?: string;
}

export interface UpdateQuestionnairePlanInput {
    name?: string;
    description?: string;
    isActive?: boolean;
    passingScore?: number | null;
    scoringStrategy?: ScoringStrategy;
    autoDecisionEnabled?: boolean;
    estimatedMinutes?: number | null;
    category?: string;
}

export interface QuestionnairePlan {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    passingScore: number | null;
    scoringStrategy: ScoringStrategy;
    autoDecisionEnabled: boolean;
    estimatedMinutes: number | null;
    category: string | null;
    questions: QuestionDefinition[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateQuestionnairePlanInput {
    name: string;
    description?: string;
    isActive?: boolean;
    passingScore?: number;
    scoringStrategy?: ScoringStrategy;
    autoDecisionEnabled?: boolean;
    estimatedMinutes?: number;
    category?: string;
    questions: QuestionDefinition[];
}

export function useQuestionnairePlans() {
    return useQuery({
        queryKey: queryKeys.questionnairePlans.all,
        queryFn: async () => {
            const response = await mortgageApi.get<QuestionnairePlan[]>('/questionnaire-plans');
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch questionnaire plans');
            }
            return response.data!;
        },
    });
}

export function useQuestionnairePlan(id: string) {
    return useQuery({
        queryKey: queryKeys.questionnairePlans.detail(id),
        queryFn: async () => {
            const response = await mortgageApi.get<QuestionnairePlan>(`/questionnaire-plans/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch questionnaire plan');
            }
            return response.data!;
        },
        enabled: !!id,
    });
}

export function useCreateQuestionnairePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateQuestionnairePlanInput) => {
            const response = await mortgageApi.post<QuestionnairePlan>('/questionnaire-plans', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create questionnaire plan');
            }
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.all });
        },
    });
}

export function useDeleteQuestionnairePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await mortgageApi.delete(`/questionnaire-plans/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete questionnaire plan');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.all });
        },
    });
}

export function useUpdateQuestionnairePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateQuestionnairePlanInput }) => {
            const response = await mortgageApi.patch<QuestionnairePlan>(`/questionnaire-plans/${id}`, data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update questionnaire plan');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.detail(variables.id) });
        },
    });
}

export function useAddQuestionToPlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ planId, data }: { planId: string; data: Omit<QuestionDefinition, 'id'> }) => {
            const response = await mortgageApi.post<QuestionDefinition>(`/questionnaire-plans/${planId}/questions`, data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to add question');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.detail(variables.planId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.all });
        },
    });
}

export function useUpdateQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ planId, questionId, data }: { planId: string; questionId: string; data: Partial<QuestionDefinition> }) => {
            const response = await mortgageApi.patch<QuestionDefinition>(`/questionnaire-plans/${planId}/questions/${questionId}`, data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update question');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.detail(variables.planId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.all });
        },
    });
}

export function useRemoveQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ planId, questionId }: { planId: string; questionId: string }) => {
            const response = await mortgageApi.delete(`/questionnaire-plans/${planId}/questions/${questionId}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to remove question');
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.detail(variables.planId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.questionnairePlans.all });
        },
    });
}

// ============================================================================
// Documentation Plans Hooks
// ============================================================================

export type UploaderType = 'CUSTOMER' | 'PLATFORM' | 'DEVELOPER' | 'LENDER' | 'LEGAL' | 'INSURER' | 'GOVERNMENT';

export interface StepCondition {
    questionKey?: string;
    operator?: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'GREATER_THAN' | 'LESS_THAN' | 'EXISTS';
    value?: string | number | boolean;
    values?: (string | number)[];
    all?: StepCondition[];
    any?: StepCondition[];
}

export interface DocumentDefinition {
    documentType: string;
    documentName: string;
    uploadedBy: UploaderType;
    order: number;
    isRequired: boolean;
    description?: string;
    maxSizeBytes?: number;
    allowedMimeTypes?: string[];
    condition?: StepCondition;
}

export interface ApprovalStage {
    name: string;
    order: number;
    organizationTypeCode: string;
    autoTransition?: boolean;
    waitForAllDocuments?: boolean;
    onRejection?: 'CASCADE_BACK' | 'REJECT_APPLICATION' | 'HOLD';
    slaHours?: number;
}

export interface DocumentationPlan {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    documentDefinitions: DocumentDefinition[];
    approvalStages: ApprovalStage[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateDocumentationPlanInput {
    name: string;
    description?: string;
    isActive?: boolean;
    documentDefinitions: DocumentDefinition[];
    approvalStages: ApprovalStage[];
}

export function useDocumentationPlans() {
    return useQuery({
        queryKey: queryKeys.documentationPlans.all,
        queryFn: async () => {
            const response = await mortgageApi.get<DocumentationPlan[]>('/documentation-plans');
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch documentation plans');
            }
            return response.data!;
        },
    });
}

export function useDocumentationPlan(id: string) {
    return useQuery({
        queryKey: queryKeys.documentationPlans.detail(id),
        queryFn: async () => {
            const response = await mortgageApi.get<DocumentationPlan>(`/documentation-plans/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch documentation plan');
            }
            return response.data!;
        },
        enabled: !!id,
    });
}

export function useCreateDocumentationPlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateDocumentationPlanInput) => {
            const response = await mortgageApi.post<DocumentationPlan>('/documentation-plans', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create documentation plan');
            }
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.documentationPlans.all });
        },
    });
}

export function useDeleteDocumentationPlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await mortgageApi.delete(`/documentation-plans/${id}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete documentation plan');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.documentationPlans.all });
        },
    });
}

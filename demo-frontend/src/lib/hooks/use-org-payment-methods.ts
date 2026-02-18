'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { mortgageApi } from '@/lib/api/client';

// ============================================================================
// Types — Qualification Configs
// ============================================================================

export interface PaymentMethodQualificationConfig {
    id: string;
    paymentMethodId: string;
    organizationTypeCode: string;
    qualificationFlowId: string;
    qualificationFlow?: {
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

export interface CreateQualificationConfigInput {
    organizationTypeCode: string;
    qualificationFlowId: string;
}

// ============================================================================
// Types — Organization Payment Methods (Assignments)
// ============================================================================

export type OrgPaymentMethodStatus =
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'QUALIFIED'
    | 'REJECTED'
    | 'SUSPENDED'
    | 'EXPIRED';

export interface OrganizationPaymentMethod {
    id: string;
    organizationId: string;
    paymentMethodId: string;
    status: OrgPaymentMethodStatus;
    qualifiedAt: string | null;
    expiresAt: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    organization?: {
        id: string;
        name: string;
        organizationTypes?: { organizationType: { code: string; name: string } }[];
    };
    paymentMethod?: {
        id: string;
        name: string;
    };
}

export interface CreateOrgPaymentMethodInput {
    organizationId: string;
}

export interface UpdateOrgPaymentMethodInput {
    status?: OrgPaymentMethodStatus;
    notes?: string;
}

// ============================================================================
// Types — Qualification Workflow
// ============================================================================

export interface PaymentMethodQualification {
    id: string;
    organizationPaymentMethodId: string;
    qualificationFlowId: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    qualificationFlow?: {
        id: string;
        name: string;
        phases: {
            id: string;
            name: string;
            phaseCategory: string;
            phaseType: string;
            order: number;
        }[];
    };
}

// ============================================================================
// Types — Document Waivers
// ============================================================================

export interface OrganizationDocumentWaiver {
    id: string;
    organizationPaymentMethodId: string;
    documentType: string;
    documentName: string;
    reason: string | null;
    waivedBy: string | null;
    createdAt: string;
}

export interface AvailableDocument {
    documentType: string;
    documentName: string;
    uploadedBy: string;
    isRequired: boolean;
    phaseName: string;
    alreadyWaived: boolean;
}

export interface CreateDocumentWaiverInput {
    documentType: string;
    reason?: string;
}

export interface BatchCreateDocumentWaiverInput {
    waivers: CreateDocumentWaiverInput[];
}

// ============================================================================
// Hooks — Qualification Configs (per Payment Method)
// ============================================================================

export function useQualificationConfigs(paymentMethodId: string) {
    return useQuery({
        queryKey: queryKeys.qualificationConfigs.byPaymentMethod(paymentMethodId),
        queryFn: async () => {
            const response = await mortgageApi.get<PaymentMethodQualificationConfig[]>(
                `/payment-methods/${paymentMethodId}/qualification-configs`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch qualification configs');
            }
            return response.data!;
        },
        enabled: !!paymentMethodId,
    });
}

export function useCreateQualificationConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            data,
        }: {
            paymentMethodId: string;
            data: CreateQualificationConfigInput;
        }) => {
            const response = await mortgageApi.post<PaymentMethodQualificationConfig>(
                `/payment-methods/${paymentMethodId}/qualification-configs`,
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create qualification config');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.qualificationConfigs.byPaymentMethod(variables.paymentMethodId),
            });
        },
    });
}

export function useDeleteQualificationConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            configId,
        }: {
            paymentMethodId: string;
            configId: string;
        }) => {
            const response = await mortgageApi.delete(
                `/payment-methods/${paymentMethodId}/qualification-configs/${configId}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete qualification config');
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.qualificationConfigs.byPaymentMethod(variables.paymentMethodId),
            });
        },
    });
}

// ============================================================================
// Hooks — Organization Payment Method Assignments
// ============================================================================

export function useOrgPaymentMethods(paymentMethodId: string) {
    return useQuery({
        queryKey: queryKeys.orgPaymentMethods.byPaymentMethod(paymentMethodId),
        queryFn: async () => {
            const response = await mortgageApi.get<OrganizationPaymentMethod[]>(
                `/payment-methods/${paymentMethodId}/assignments`
            );
            if (!response.success) {
                throw new Error(
                    response.error?.message || 'Failed to fetch organization assignments'
                );
            }
            return response.data!;
        },
        enabled: !!paymentMethodId,
    });
}

export function useOrgPaymentMethod(paymentMethodId: string, assignmentId: string) {
    return useQuery({
        queryKey: queryKeys.orgPaymentMethods.detail(paymentMethodId, assignmentId),
        queryFn: async () => {
            const response = await mortgageApi.get<OrganizationPaymentMethod>(
                `/payment-methods/${paymentMethodId}/assignments/${assignmentId}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch assignment');
            }
            return response.data!;
        },
        enabled: !!paymentMethodId && !!assignmentId,
    });
}

export function useEnrollOrgToPaymentMethod() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            data,
        }: {
            paymentMethodId: string;
            data: CreateOrgPaymentMethodInput;
        }) => {
            const response = await mortgageApi.post<OrganizationPaymentMethod>(
                `/payment-methods/${paymentMethodId}/assignments`,
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to enroll organization');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.byPaymentMethod(variables.paymentMethodId),
            });
        },
    });
}

export function useUpdateOrgPaymentMethod() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            assignmentId,
            data,
        }: {
            paymentMethodId: string;
            assignmentId: string;
            data: UpdateOrgPaymentMethodInput;
        }) => {
            const response = await mortgageApi.patch<OrganizationPaymentMethod>(
                `/payment-methods/${paymentMethodId}/assignments/${assignmentId}`,
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update assignment');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.byPaymentMethod(variables.paymentMethodId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.detail(
                    variables.paymentMethodId,
                    variables.assignmentId
                ),
            });
        },
    });
}

export function useApplyForQualification() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            assignmentId,
        }: {
            paymentMethodId: string;
            assignmentId: string;
        }) => {
            const response = await mortgageApi.post<OrganizationPaymentMethod>(
                `/payment-methods/${paymentMethodId}/assignments/${assignmentId}/apply`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to start qualification');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.byPaymentMethod(variables.paymentMethodId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.detail(
                    variables.paymentMethodId,
                    variables.assignmentId
                ),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.qualification(
                    variables.paymentMethodId,
                    variables.assignmentId
                ),
            });
        },
    });
}

export function useOrgQualification(paymentMethodId: string, assignmentId: string) {
    return useQuery({
        queryKey: queryKeys.orgPaymentMethods.qualification(paymentMethodId, assignmentId),
        queryFn: async () => {
            const response = await mortgageApi.get<PaymentMethodQualification>(
                `/payment-methods/${paymentMethodId}/assignments/${assignmentId}/qualification`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch qualification');
            }
            return response.data!;
        },
        enabled: !!paymentMethodId && !!assignmentId,
    });
}

// ============================================================================
// Hooks — Document Waivers
// ============================================================================

export function useDocumentWaivers(paymentMethodId: string, assignmentId: string) {
    return useQuery({
        queryKey: queryKeys.orgPaymentMethods.waivers(paymentMethodId, assignmentId),
        queryFn: async () => {
            const response = await mortgageApi.get<OrganizationDocumentWaiver[]>(
                `/payment-methods/${paymentMethodId}/assignments/${assignmentId}/waivers`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch document waivers');
            }
            return response.data!;
        },
        enabled: !!paymentMethodId && !!assignmentId,
    });
}

export function useAvailableDocuments(paymentMethodId: string, assignmentId: string) {
    return useQuery({
        queryKey: queryKeys.orgPaymentMethods.availableDocuments(paymentMethodId, assignmentId),
        queryFn: async () => {
            const response = await mortgageApi.get<AvailableDocument[]>(
                `/payment-methods/${paymentMethodId}/assignments/${assignmentId}/available-documents`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch available documents');
            }
            return response.data!;
        },
        enabled: !!paymentMethodId && !!assignmentId,
    });
}

export function useCreateDocumentWaiver() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            assignmentId,
            data,
        }: {
            paymentMethodId: string;
            assignmentId: string;
            data: CreateDocumentWaiverInput;
        }) => {
            const response = await mortgageApi.post<OrganizationDocumentWaiver>(
                `/payment-methods/${paymentMethodId}/assignments/${assignmentId}/waivers`,
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create document waiver');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.waivers(
                    variables.paymentMethodId,
                    variables.assignmentId
                ),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.availableDocuments(
                    variables.paymentMethodId,
                    variables.assignmentId
                ),
            });
        },
    });
}

export function useBatchCreateDocumentWaivers() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            assignmentId,
            data,
        }: {
            paymentMethodId: string;
            assignmentId: string;
            data: BatchCreateDocumentWaiverInput;
        }) => {
            const response = await mortgageApi.post<OrganizationDocumentWaiver[]>(
                `/payment-methods/${paymentMethodId}/assignments/${assignmentId}/waivers/batch`,
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create document waivers');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.waivers(
                    variables.paymentMethodId,
                    variables.assignmentId
                ),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.availableDocuments(
                    variables.paymentMethodId,
                    variables.assignmentId
                ),
            });
        },
    });
}

export function useDeleteDocumentWaiver() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            paymentMethodId,
            assignmentId,
            waiverId,
        }: {
            paymentMethodId: string;
            assignmentId: string;
            waiverId: string;
        }) => {
            const response = await mortgageApi.delete(
                `/payment-methods/${paymentMethodId}/assignments/${assignmentId}/waivers/${waiverId}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete document waiver');
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.waivers(
                    variables.paymentMethodId,
                    variables.assignmentId
                ),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.orgPaymentMethods.availableDocuments(
                    variables.paymentMethodId,
                    variables.assignmentId
                ),
            });
        },
    });
}

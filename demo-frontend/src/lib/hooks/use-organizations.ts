'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { mortgageApi, userApi } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

export type BankDocumentModifier = 'REQUIRED' | 'OPTIONAL' | 'NOT_REQUIRED' | 'STRICTER';

export interface BankDocumentRequirementPhase {
    id: string;
    name: string;
    phaseType: string;
    paymentMethod: {
        id: string;
        name: string;
    };
}

export interface BankDocumentRequirement {
    id: string;
    organizationId: string;
    phaseId: string;
    phase?: BankDocumentRequirementPhase;
    documentType: string;
    documentName: string;
    modifier: BankDocumentModifier;
    description: string | null;
    expiryDays: number | null;
    minFiles: number | null;
    maxFiles: number | null;
    allowedMimeTypes: string | null;
    validationRules: Record<string, unknown> | null;
    priority: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateBankDocumentRequirementInput {
    phaseId: string;
    documentType: string;
    documentName: string;
    modifier?: BankDocumentModifier;
    description?: string;
    expiryDays?: number;
    minFiles?: number;
    maxFiles?: number;
    allowedMimeTypes?: string;
    validationRules?: Record<string, unknown>;
    priority?: number;
}

export interface Organization {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    bankCode: string | null;
    status: string;
    types?: { code: string; name: string; isPrimary: boolean }[];
    createdAt: string;
}

export interface EffectiveDocumentRequirement {
    documentType: string;
    documentName: string;
    uploadedBy: string;
    isRequired: boolean;
    description?: string;
    minFiles: number;
    maxFiles: number;
    expiryDays?: number;
    allowedMimeTypes?: string;
    validationRules?: Record<string, unknown>;
    source: 'BASE' | 'BANK_OVERLAY';
    modifier?: string;
    bankOrganizationId?: string;
    priority?: number;
}

export interface EffectiveRequirementsResponse {
    phaseId: string;
    bankOrganizationId: string;
    requirements: EffectiveDocumentRequirement[];
    totalRequired: number;
    totalOptional: number;
}

// ============================================================================
// Query Keys Extension
// ============================================================================

const bankDocReqKeys = {
    all: ['bankDocumentRequirements'] as const,
    byOrg: (orgId: string) => [...bankDocReqKeys.all, 'org', orgId] as const,
    effective: (phaseId: string, bankId: string) =>
        ['effectiveRequirements', phaseId, bankId] as const,
};

// ============================================================================
// Organizations Hooks
// ============================================================================

export function useOrganizations(filters?: { typeCode?: string }) {
    return useQuery({
        queryKey: queryKeys.organizations.list(filters),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.typeCode) params.set('typeCode', filters.typeCode);
            const endpoint = `/organizations${params.toString() ? `?${params}` : ''}`;
            const response = await userApi.get<Organization[]>(endpoint);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch organizations');
            }
            return response.data!;
        },
    });
}

export function useBankOrganizations() {
    return useOrganizations({ typeCode: 'BANK' });
}

// ============================================================================
// Bank Document Requirements Hooks
// ============================================================================

export function useBankDocumentRequirements(organizationId: string) {
    return useQuery({
        queryKey: bankDocReqKeys.byOrg(organizationId),
        queryFn: async () => {
            const response = await mortgageApi.get<{
                organization: { id: string; name: string };
                requirements: BankDocumentRequirement[];
            }>(`/organizations/${organizationId}/document-requirements`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch bank document requirements');
            }
            return response.data!;
        },
        enabled: !!organizationId,
    });
}

export function useCreateBankDocumentRequirement() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            organizationId,
            data,
        }: {
            organizationId: string;
            data: CreateBankDocumentRequirementInput;
        }) => {
            const response = await mortgageApi.post<BankDocumentRequirement>(
                `/organizations/${organizationId}/document-requirements`,
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create bank document requirement');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: bankDocReqKeys.byOrg(variables.organizationId) });
        },
    });
}

export function useUpdateBankDocumentRequirement() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            organizationId,
            requirementId,
            data,
        }: {
            organizationId: string;
            requirementId: string;
            data: Partial<CreateBankDocumentRequirementInput>;
        }) => {
            const response = await mortgageApi.put<BankDocumentRequirement>(
                `/organizations/${organizationId}/document-requirements/${requirementId}`,
                data
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update bank document requirement');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: bankDocReqKeys.byOrg(variables.organizationId) });
        },
    });
}

export function useDeleteBankDocumentRequirement() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            organizationId,
            requirementId,
        }: {
            organizationId: string;
            requirementId: string;
        }) => {
            const response = await mortgageApi.delete(
                `/organizations/${organizationId}/document-requirements/${requirementId}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete bank document requirement');
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: bankDocReqKeys.byOrg(variables.organizationId) });
        },
    });
}

// ============================================================================
// Effective Document Requirements (Merged Base + Bank Overlay)
// ============================================================================

export function useEffectiveDocumentRequirements(
    phaseId: string,
    bankOrganizationId: string
) {
    return useQuery({
        queryKey: bankDocReqKeys.effective(phaseId, bankOrganizationId),
        queryFn: async () => {
            const params = new URLSearchParams({
                bankOrganizationId,
            });

            const response = await mortgageApi.get<EffectiveRequirementsResponse>(
                `/documentation-plans/phases/${phaseId}/effective-requirements?${params}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch effective document requirements');
            }
            return response.data!;
        },
        enabled: !!phaseId && !!bankOrganizationId,
    });
}

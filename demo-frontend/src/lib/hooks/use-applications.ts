import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mortgageApi } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';

// Types (simplified - would import from shared package)
export interface Application {
  id: string;
  title: string;
  applicationType: string; // MORTGAGE, INSTALLMENT, FULL_PAYMENT
  status: string; // DRAFT, PENDING, ACTIVE, COMPLETED, CANCELLED
  totalAmount: number;
  currency: string;
  propertyUnitId: string;
  paymentMethodId: string;
  userId: string;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  applicantAge?: number;
  selectedMortgageTermMonths?: number;
  createdAt: string;
  updatedAt: string;
  phases?: Phase[];
}

export interface Phase {
  id: string;
  applicationId: string;
  name: string;
  category: string; // QUESTIONNAIRE, DOCUMENTATION, PAYMENT
  type: string; // PRE_APPROVAL, KYC, DOWNPAYMENT, MORTGAGE, etc.
  status: string; // PENDING, IN_PROGRESS, COMPLETED, SKIPPED
  order: number;
  startedAt?: string;
  completedAt?: string;
}

export interface CurrentAction {
  phase: Phase;
  action: string;
  description: string;
  requiredDocuments?: RequiredDocument[];
  pendingQuestions?: Question[];
  pendingPayments?: PendingPayment[];
}

export interface RequiredDocument {
  id: string;
  name: string;
  description: string;
  status: string; // PENDING, UPLOADED, APPROVED, REJECTED
  uploadedBy?: string;
}

export interface Question {
  id: string;
  question: string;
  type: string; // TEXT, NUMBER, SELECT, DATE
  required: boolean;
  options?: string[];
}

export interface PendingPayment {
  id: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
}

export interface CreateApplicationInput {
  propertyUnitId: string;
  paymentMethodId: string;
  title: string;
  applicationType: string;
  totalAmount: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  applicantAge?: number;
  selectedMortgageTermMonths?: number;
}

// Hooks
export function useApplications(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.applications.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.set(key, String(value));
          }
        });
      }
      const endpoint = `/applications${params.toString() ? `?${params}` : ''}`;
      const response = await mortgageApi.get<{ items: Application[]; total: number }>(endpoint);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch applications');
      }
      return response.data!;
    },
  });
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: queryKeys.applications.detail(id),
    queryFn: async () => {
      const response = await mortgageApi.get<Application>(`/applications/${id}`);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch application');
      }
      return response.data!;
    },
    enabled: !!id,
  });
}

export function useApplicationPhases(applicationId: string) {
  return useQuery({
    queryKey: queryKeys.applications.phases(applicationId),
    queryFn: async () => {
      const response = await mortgageApi.get<Phase[]>(`/applications/${applicationId}/phases`);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch phases');
      }
      return response.data!;
    },
    enabled: !!applicationId,
  });
}

export function useCurrentAction(applicationId: string) {
  return useQuery({
    queryKey: queryKeys.applications.currentAction(applicationId),
    queryFn: async () => {
      const response = await mortgageApi.get<CurrentAction>(
        `/applications/${applicationId}/current-action`
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch current action');
      }
      return response.data!;
    },
    enabled: !!applicationId,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateApplicationInput) => {
      const response = await mortgageApi.post<Application>('/applications', data);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create application');
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    },
  });
}

export function useTransitionApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ applicationId, action }: { applicationId: string; action: string }) => {
      const response = await mortgageApi.post<Application>(
        `/applications/${applicationId}/transition`,
        { action }
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to transition application');
      }
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.detail(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.currentAction(variables.applicationId),
      });
    },
  });
}

export function useSubmitQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      phaseId,
      answers,
    }: {
      applicationId: string;
      phaseId: string;
      answers: Record<string, unknown>;
    }) => {
      const response = await mortgageApi.post(
        `/applications/${applicationId}/phases/${phaseId}/submit`,
        { answers }
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to submit questionnaire');
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.detail(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.currentAction(variables.applicationId),
      });
    },
  });
}

export function useReviewDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      documentId,
      status,
      organizationTypeCode,
      comment,
    }: {
      applicationId: string;
      documentId: string;
      status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
      organizationTypeCode: string;
      comment?: string;
    }) => {
      const response = await mortgageApi.post(
        `/applications/${applicationId}/documents/${documentId}/review`,
        { status, organizationTypeCode, comment }
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to review document');
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.documents(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.currentAction(variables.applicationId),
      });
    },
  });
}

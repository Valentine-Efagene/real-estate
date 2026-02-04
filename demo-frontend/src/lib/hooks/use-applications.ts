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
  buyerId: string;
  buyer?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  monthlyIncome?: number;
  monthlyExpenses?: number;
  applicantAge?: number;
  selectedMortgageTermMonths?: number;
  createdAt: string;
  updatedAt: string;
  phases?: Phase[];
}

export interface ActionStatus {
  nextActor: 'CUSTOMER' | 'ADMIN' | 'SYSTEM' | 'NONE';
  actionCategory: 'UPLOAD' | 'SIGNATURE' | 'REVIEW' | 'PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'WAITING';
  actionRequired: string;
  progress?: string;
  dueDate?: string | null;
  isBlocking?: boolean;
}

export interface Phase {
  id: string;
  applicationId: string;
  name: string;
  phaseCategory: string; // QUESTIONNAIRE, DOCUMENTATION, PAYMENT
  phaseType: string; // PRE_APPROVAL, KYC, DOWNPAYMENT, MORTGAGE, etc.
  status: string; // PENDING, IN_PROGRESS, COMPLETED, SKIPPED
  order: number;
  startedAt?: string;
  completedAt?: string;
  // Action status indicating who needs to act next
  actionStatus?: ActionStatus;
  // Questionnaire phase fields (legacy - may be empty)
  fields?: QuestionnaireField[];
  // Questionnaire phase with fields snapshot
  questionnairePhase?: {
    id: string;
    completedFieldsCount: number;
    totalFieldsCount: number;
    totalScore?: number | null;
    passingScore?: number | null;
    passed?: boolean | null;
    fieldsSnapshot?: {
      questions: QuestionnaireQuestion[];
      passingScore?: number;
      scoringStrategy?: string;
    };
  };
  // Payment phase fields
  totalAmount?: number;
  paidAmount?: number;
  installments?: Installment[];
}

export interface QuestionnaireQuestion {
  questionKey: string;
  questionText: string;
  questionType: string; // NUMBER, TEXT, CHECKBOX, SELECT, etc.
  helpText?: string | null;
  isRequired: boolean;
  order: number;
  options?: Array<{ label: string; value: string; score?: number }> | null;
  validationRules?: Record<string, unknown> | null;
  scoringRules?: Array<{ operator: string; value: unknown; score: number }> | null;
  answer?: unknown;
}

export interface QuestionnaireField {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  placeholder?: string | null;
  fieldType: string;
  isRequired: boolean;
  order: number;
  validation?: Record<string, unknown> | null;
  displayCondition?: Record<string, unknown> | null;
  defaultValue?: unknown;
  answer?: unknown;
  options?: Array<{ label: string; value: string; score?: number }> | null;
}

export interface Installment {
  id: string;
  amount: number;
  dueDate: string;
  status: string;
  paidAt?: string;
}

export interface CurrentAction {
  applicationId: string;
  applicationStatus: string;
  currentPhase: {
    id: string;
    name: string;
    phaseCategory: string;
    phaseType: string;
    status: string;
    order: number;
  } | null;
  currentStep: {
    id: string;
    name: string;
    stepType: string;
    status: string;
    order: number;
    actionReason?: string | null;
    submissionCount?: number;
    requiredDocuments?: Array<{
      documentType: string;
      isRequired: boolean;
    }>;
    latestApproval?: {
      decision: string;
      comment: string | null;
      decidedAt: string;
    } | null;
  } | null;
  uploadedDocuments: Array<{
    id: string;
    name: string;
    type: string;
    url: string | null;
    status: string;
    stepId: string | null;
    createdAt: string;
  }>;
  actionRequired: 'NONE' | 'UPLOAD' | 'RESUBMIT' | 'SIGN' | 'WAIT_FOR_REVIEW' | 'PAYMENT' | 'COMPLETE' | 'QUESTIONNAIRE';
  actionMessage: string;
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

// Pagination types matching backend
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
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
      const response = await mortgageApi.get<PaginatedResponse<Application>>(endpoint);
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
      answers: Array<{ fieldName: string; value: string }>;
    }) => {
      const response = await mortgageApi.post(
        `/applications/${applicationId}/phases/${phaseId}/questionnaire/submit`,
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

export function useReviewQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      phaseId,
      decision,
      notes,
    }: {
      applicationId: string;
      phaseId: string;
      decision: 'APPROVE' | 'REJECT';
      notes?: string;
    }) => {
      const response = await mortgageApi.post(
        `/applications/${applicationId}/phases/${phaseId}/questionnaire/review`,
        { decision, notes }
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to review questionnaire');
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.detail(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.phases(variables.applicationId),
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

// ============================================================================
// Payment Hooks
// ============================================================================

export interface PaymentInput {
  applicationId: string;
  phaseId: string;
  installmentId: string;
  amount: number;
  paymentMethod: 'BANK_TRANSFER' | 'CARD' | 'USSD' | 'WALLET';
  externalReference?: string;
}

export interface Payment {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  installmentId: string;
  createdAt: string;
}

export function useGenerateInstallments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      phaseId,
      startDate,
    }: {
      applicationId: string;
      phaseId: string;
      startDate?: string;
    }) => {
      const response = await mortgageApi.post<{ installments: Installment[] }>(
        `/applications/${applicationId}/phases/${phaseId}/installments`,
        { startDate: startDate || new Date().toISOString() }
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to generate installments');
      }
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.phases(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.currentAction(variables.applicationId),
      });
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      phaseId,
      installmentId,
      amount,
      paymentMethod,
      externalReference,
    }: PaymentInput) => {
      const response = await mortgageApi.post<Payment>(
        `/applications/${applicationId}/payments`,
        { phaseId, installmentId, amount, paymentMethod, externalReference }
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create payment');
      }
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.phases(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.currentAction(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all,
      });
    },
  });
}

export function useProcessPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reference,
      status,
      gatewayTransactionId,
    }: {
      reference: string;
      status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
      gatewayTransactionId?: string;
    }) => {
      const response = await mortgageApi.post(
        `/applications/payments/process`,
        { reference, status, gatewayTransactionId }
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to process payment');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all,
      });
    },
  });
}

// ============================================================================
// Application Organization Binding Hooks
// ============================================================================

export interface ApplicationOrganization {
  id: string;
  organizationId: string;
  organization?: {
    id: string;
    name: string;
  };
  assignedAsType?: {
    id: string;
    code: string;
    name: string;
  };
  status: string;
  isPrimary: boolean;
  slaHours?: number;
  activatedAt?: string;
  createdAt: string;
}

export function useApplicationOrganizations(applicationId: string) {
  return useQuery({
    queryKey: ['applications', applicationId, 'organizations'] as const,
    queryFn: async () => {
      const response = await mortgageApi.get<ApplicationOrganization[]>(
        `/applications/${applicationId}/organizations`
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch application organizations');
      }
      return response.data!;
    },
    enabled: !!applicationId,
  });
}

export function useBindOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      organizationId,
      organizationTypeCode,
      isPrimary,
      slaHours,
    }: {
      applicationId: string;
      organizationId: string;
      organizationTypeCode: string;
      isPrimary?: boolean;
      slaHours?: number;
    }) => {
      const response = await mortgageApi.post<ApplicationOrganization>(
        `/applications/${applicationId}/organizations`,
        { organizationId, organizationTypeCode, isPrimary, slaHours }
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to bind organization');
      }
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['applications', variables.applicationId, 'organizations'],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.detail(variables.applicationId),
      });
    },
  });
}

// ============================================================================
// Phase Document Upload Hook
// ============================================================================

export interface PhaseDocument {
  id: string;
  documentType: string;
  fileName: string;
  url: string;
  status: string;
  uploadedBy: string;
  createdAt: string;
}

export function useUploadPhaseDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      phaseId,
      documentType,
      url,
      fileName,
    }: {
      applicationId: string;
      phaseId: string;
      documentType: string;
      url: string;
      fileName: string;
    }) => {
      const response = await mortgageApi.post<PhaseDocument>(
        `/applications/${applicationId}/phases/${phaseId}/documents`,
        { documentType, url, fileName }
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to upload document');
      }
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.phases(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.currentAction(variables.applicationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.detail(variables.applicationId),
      });
    },
  });
}

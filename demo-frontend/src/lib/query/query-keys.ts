/**
 * Query keys for TanStack Query cache management
 * Organized by service/feature for easy invalidation
 */
export const queryKeys = {
  // Auth
  auth: {
    session: ['auth', 'session'] as const,
    me: ['auth', 'me'] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    list: (filters?: Record<string, unknown>) => ['users', 'list', filters] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },

  // Properties
  properties: {
    all: ['properties'] as const,
    list: (filters?: Record<string, unknown>) => ['properties', 'list', filters] as const,
    detail: (id: string) => ['properties', 'detail', id] as const,
    variants: (propertyId: string) => ['properties', propertyId, 'variants'] as const,
    units: (propertyId: string, variantId: string) =>
      ['properties', propertyId, 'variants', variantId, 'units'] as const,
    paymentMethods: (propertyId: string) =>
      ['properties', propertyId, 'payment-methods'] as const,
  },

  // Applications
  applications: {
    all: ['applications'] as const,
    list: (filters?: Record<string, unknown>) => ['applications', 'list', filters] as const,
    detail: (id: string) => ['applications', 'detail', id] as const,
    phases: (applicationId: string) => ['applications', applicationId, 'phases'] as const,
    phaseDetail: (applicationId: string, phaseId: string) =>
      ['applications', applicationId, 'phases', phaseId] as const,
    phaseDocuments: (applicationId: string, phaseId: string) =>
      ['applications', applicationId, 'phases', phaseId, 'documents'] as const,
    currentAction: (applicationId: string) =>
      ['applications', applicationId, 'current-action'] as const,
    documents: (applicationId: string) =>
      ['applications', applicationId, 'documents'] as const,
  },

  // Documents
  documents: {
    all: ['documents'] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
  },

  // Organizations
  organizations: {
    all: ['organizations'] as const,
    list: (filters?: Record<string, unknown>) => ['organizations', 'list', filters] as const,
    detail: (id: string) => ['organizations', 'detail', id] as const,
    members: (orgId: string) => ['organizations', orgId, 'members'] as const,
  },

  // Payments
  payments: {
    all: ['payments'] as const,
    list: (filters?: Record<string, unknown>) => ['payments', 'list', filters] as const,
    detail: (id: string) => ['payments', 'detail', id] as const,
    installments: (applicationId: string) =>
      ['payments', 'installments', applicationId] as const,
  },

  // Wallets
  wallets: {
    me: ['wallets', 'me'] as const,
    detail: (id: string) => ['wallets', 'detail', id] as const,
    transactions: (filters?: Record<string, unknown>) => ['wallets', 'transactions', filters] as const,
  },

  // Payment Plans
  paymentPlans: {
    all: ['payment-plans'] as const,
    list: (filters?: Record<string, unknown>) => ['payment-plans', 'list', filters] as const,
    detail: (id: string) => ['payment-plans', 'detail', id] as const,
  },

  // Payment Methods
  paymentMethods: {
    all: ['payment-methods'] as const,
    list: (filters?: Record<string, unknown>) => ['payment-methods', 'list', filters] as const,
    detail: (id: string) => ['payment-methods', 'detail', id] as const,
  },

  // Questionnaire Plans
  questionnairePlans: {
    all: ['questionnaire-plans'] as const,
    list: (filters?: Record<string, unknown>) => ['questionnaire-plans', 'list', filters] as const,
    detail: (id: string) => ['questionnaire-plans', 'detail', id] as const,
  },

  // Documentation Plans
  documentationPlans: {
    all: ['documentation-plans'] as const,
    list: (filters?: Record<string, unknown>) => ['documentation-plans', 'list', filters] as const,
    detail: (id: string) => ['documentation-plans', 'detail', id] as const,
  },

  // Qualification Flows
  qualificationFlows: {
    all: ['qualification-flows'] as const,
    list: (filters?: Record<string, unknown>) => ['qualification-flows', 'list', filters] as const,
    detail: (id: string) => ['qualification-flows', 'detail', id] as const,
  },

  // Qualification Configs (per payment method)
  qualificationConfigs: {
    byPaymentMethod: (paymentMethodId: string) =>
      ['qualification-configs', 'payment-method', paymentMethodId] as const,
  },

  // Organization Payment Methods (assignments)
  orgPaymentMethods: {
    byPaymentMethod: (paymentMethodId: string) =>
      ['org-payment-methods', 'payment-method', paymentMethodId] as const,
    detail: (paymentMethodId: string, assignmentId: string) =>
      ['org-payment-methods', paymentMethodId, assignmentId] as const,
    qualification: (paymentMethodId: string, assignmentId: string) =>
      ['org-payment-methods', paymentMethodId, assignmentId, 'qualification'] as const,
    waivers: (paymentMethodId: string, assignmentId: string) =>
      ['org-payment-methods', paymentMethodId, assignmentId, 'waivers'] as const,
    availableDocuments: (paymentMethodId: string, assignmentId: string) =>
      ['org-payment-methods', paymentMethodId, assignmentId, 'available-documents'] as const,
  },
} as const;

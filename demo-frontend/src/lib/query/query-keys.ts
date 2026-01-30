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
} as const;

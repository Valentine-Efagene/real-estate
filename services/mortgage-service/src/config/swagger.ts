import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
  CreatePaymentPlanSchema,
  UpdatePaymentPlanSchema,
} from '../validators/payment-plan.validator';
import {
  CreatePaymentMethodSchema,
} from '../validators/payment-method.validator';
import {
  CreateApplicationSchema,
} from '../validators/application.validator';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Register common schemas
registry.register('ApiError', z.object({
  success: z.literal(false),
  error: z.string(),
}).openapi('ApiError'));

registry.register('ApiSuccess', z.object({
  success: z.literal(true),
  data: z.any(),
}).openapi('ApiSuccess'));

// ============ Payment Plans ============
registry.registerPath({
  method: 'post',
  path: '/payment-plans',
  tags: ['Payment Plans'],
  summary: 'Create a new payment plan',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePaymentPlanSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Payment plan created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.any(),
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/payment-plans',
  tags: ['Payment Plans'],
  summary: 'List all payment plans',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of payment plans',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(z.any()),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/payment-plans/{id}',
  tags: ['Payment Plans'],
  summary: 'Get a payment plan by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Payment plan details',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.any(),
          }),
        },
      },
    },
    404: {
      description: 'Payment plan not found',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/payment-plans/{id}',
  tags: ['Payment Plans'],
  summary: 'Update a payment plan',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePaymentPlanSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Payment plan updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.any(),
          }),
        },
      },
    },
  },
});

// ============ Payment Methods ============
registry.registerPath({
  method: 'post',
  path: '/payment-methods',
  tags: ['Payment Methods'],
  summary: 'Assign a payment method to a property',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePaymentMethodSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Payment method assigned successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.any(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/payment-methods/property/{propertyId}',
  tags: ['Payment Methods'],
  summary: 'Get payment methods for a property',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      propertyId: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'List of payment methods for the property',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(z.any()),
          }),
        },
      },
    },
  },
});

// ============ applications ============
registry.registerPath({
  method: 'post',
  path: '/applications',
  tags: ['applications'],
  summary: 'Create a new application',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateApplicationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'application created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.any(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/applications',
  tags: ['applications'],
  summary: 'List all applications',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of applications',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(z.any()),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/applications/{id}',
  tags: ['applications'],
  summary: 'Get an application by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'application details',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.any(),
          }),
        },
      },
    },
    404: {
      description: 'application not found',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
  },
});

// Register security scheme
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// ============ Prequalifications ============
registry.registerPath({
  method: 'post',
  path: '/prequalifications',
  tags: ['Prequalifications'],
  summary: 'Create a new prequalification',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            propertyId: z.string().uuid().optional(),
            propertyUnitId: z.string().uuid().optional(),
            paymentMethodId: z.string().uuid().optional(),
            employmentType: z.string().optional(),
            monthlyIncome: z.number().optional(),
            additionalIncome: z.number().optional(),
            existingDebts: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Prequalification created successfully' },
    400: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/prequalifications',
  tags: ['Prequalifications'],
  summary: 'List all prequalifications for tenant',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'List of prequalifications' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/prequalifications/{id}',
  tags: ['Prequalifications'],
  summary: 'Get a prequalification by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Prequalification details' },
    404: { description: 'Prequalification not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/prequalifications/{id}',
  tags: ['Prequalifications'],
  summary: 'Update a prequalification',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Prequalification updated' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/prequalifications/{id}',
  tags: ['Prequalifications'],
  summary: 'Delete a prequalification',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Prequalification deleted' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/prequalifications/{id}/required-documents',
  tags: ['Prequalifications'],
  summary: 'Get required documents for a prequalification',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'List of required documents' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/prequalifications/{id}/documents',
  tags: ['Prequalifications'],
  summary: 'Submit a document for prequalification',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    201: { description: 'Document submitted' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/prequalifications/{id}/submit',
  tags: ['Prequalifications'],
  summary: 'Submit prequalification for review',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Prequalification submitted for review' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/prequalifications/{id}/review',
  tags: ['Prequalifications'],
  summary: 'Review a prequalification (admin)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Prequalification reviewed' },
  },
});

// ============ application Terminations ============
registry.registerPath({
  method: 'post',
  path: '/applications/{applicationId}/terminate',
  tags: ['application Terminations'],
  summary: 'Request termination (buyer/seller initiated)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ applicationId: z.string() }),
  },
  responses: {
    201: { description: 'Termination request created' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{applicationId}/admin-terminate',
  tags: ['application Terminations'],
  summary: 'Admin-initiated termination',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ applicationId: z.string() }),
  },
  responses: {
    201: { description: 'Admin termination initiated' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/applications/{applicationId}/terminations',
  tags: ['application Terminations'],
  summary: 'Get terminations for an application',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ applicationId: z.string() }),
  },
  responses: {
    200: { description: 'List of terminations' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/terminations/pending',
  tags: ['application Terminations'],
  summary: 'Get pending terminations for review (admin)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'List of pending terminations' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/terminations/{terminationId}',
  tags: ['application Terminations'],
  summary: 'Get termination details',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ terminationId: z.string() }),
  },
  responses: {
    200: { description: 'Termination details' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/terminations/{terminationId}/review',
  tags: ['application Terminations'],
  summary: 'Review termination request (approve/reject)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ terminationId: z.string() }),
  },
  responses: {
    200: { description: 'Termination reviewed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/terminations/{terminationId}/refund',
  tags: ['application Terminations'],
  summary: 'Initiate refund processing',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ terminationId: z.string() }),
  },
  responses: {
    200: { description: 'Refund processing initiated' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/terminations/{terminationId}/refund/complete',
  tags: ['application Terminations'],
  summary: 'Complete refund (after gateway confirmation)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ terminationId: z.string() }),
  },
  responses: {
    200: { description: 'Refund completed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/terminations/{terminationId}/cancel',
  tags: ['application Terminations'],
  summary: 'Cancel termination request',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ terminationId: z.string() }),
  },
  responses: {
    200: { description: 'Termination cancelled' },
  },
});

// ============ application Additional Routes ============
registry.registerPath({
  method: 'get',
  path: '/applications/number/{applicationNumber}',
  tags: ['applications'],
  summary: 'Get application by application number',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ applicationNumber: z.string() }),
  },
  responses: {
    200: { description: 'application details' },
    404: { description: 'application not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/applications/{id}',
  tags: ['applications'],
  summary: 'Update an application',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'application updated' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/transition',
  tags: ['applications'],
  summary: 'Transition application state',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'application transitioned' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/sign',
  tags: ['applications'],
  summary: 'Sign application',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'application signed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/cancel',
  tags: ['applications'],
  summary: 'Cancel application',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'application cancelled' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/applications/{id}',
  tags: ['applications'],
  summary: 'Delete application (draft only)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'application deleted' },
  },
});

// ============ application Phases ============
registry.registerPath({
  method: 'get',
  path: '/applications/{id}/phases',
  tags: ['application Phases'],
  summary: 'Get phases for an application',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'List of phases' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/applications/{id}/phases/{phaseId}',
  tags: ['application Phases'],
  summary: 'Get phase by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), phaseId: z.string() }),
  },
  responses: {
    200: { description: 'Phase details' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/phases/{phaseId}/activate',
  tags: ['application Phases'],
  summary: 'Activate phase',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), phaseId: z.string() }),
  },
  responses: {
    200: { description: 'Phase activated' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/phases/{phaseId}/installments',
  tags: ['application Phases'],
  summary: 'Generate installments for phase',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), phaseId: z.string() }),
  },
  responses: {
    200: { description: 'Installments generated' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/phases/{phaseId}/steps/complete',
  tags: ['application Phases'],
  summary: 'Complete a step in a documentation phase',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), phaseId: z.string() }),
  },
  responses: {
    200: { description: 'Step completed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/phases/{phaseId}/documents',
  tags: ['application Phases'],
  summary: 'Upload document for phase',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), phaseId: z.string() }),
  },
  responses: {
    201: { description: 'Document uploaded' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/documents/{documentId}/review',
  tags: ['application Phases'],
  summary: 'Review/approve a document',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), documentId: z.string() }),
  },
  responses: {
    200: { description: 'Document reviewed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/phases/{phaseId}/complete',
  tags: ['application Phases'],
  summary: 'Complete phase',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), phaseId: z.string() }),
  },
  responses: {
    200: { description: 'Phase completed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/phases/{phaseId}/skip',
  tags: ['application Phases'],
  summary: 'Skip phase (admin)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), phaseId: z.string() }),
  },
  responses: {
    200: { description: 'Phase skipped' },
  },
});

// ============ application Payments ============
registry.registerPath({
  method: 'post',
  path: '/applications/{id}/payments',
  tags: ['application Payments'],
  summary: 'Create payment',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    201: { description: 'Payment created' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/applications/{id}/payments',
  tags: ['application Payments'],
  summary: 'Get payments for application',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'List of payments' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/applications/{id}/payments/{paymentId}',
  tags: ['application Payments'],
  summary: 'Get payment by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), paymentId: z.string() }),
  },
  responses: {
    200: { description: 'Payment details' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/payments/process',
  tags: ['application Payments'],
  summary: 'Process payment (webhook callback)',
  responses: {
    200: { description: 'Payment processed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/payments/{paymentId}/refund',
  tags: ['application Payments'],
  summary: 'Refund payment',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), paymentId: z.string() }),
  },
  responses: {
    200: { description: 'Payment refunded' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/applications/{id}/pay-ahead',
  tags: ['application Payments'],
  summary: 'Pay ahead (apply excess to future installments)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Pay ahead applied' },
  },
});

export function generateOpenAPIDocument(baseUrl?: string): any {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '2.0.0',
      title: 'QShelter Mortgage Service API',
      description: 'Mortgage and application management service for QShelter platform. Handles prequalifications, applications, payment plans, phases, payments, and terminations.',
    },
    servers: [
      {
        url: baseUrl !== undefined ? baseUrl : '',
        description: 'Current environment',
      },
    ],
    tags: [
      { name: 'Payment Plans', description: 'Payment plan templates (e.g., Outright, Installment 6mo)' },
      { name: 'Payment Methods', description: 'Property-specific payment method configurations' },
      { name: 'Applications', description: 'Buyer applications for property units' },
      { name: 'application Phases', description: 'application lifecycle phases (documentation, payment, etc.)' },
      { name: 'Application Payments', description: 'Payment processing for applications' },
      { name: 'application Terminations', description: 'application termination workflow' },
      { name: 'Prequalifications', description: 'Buyer prequalification for properties' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  });
}

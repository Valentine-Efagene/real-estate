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
  CreateContractSchema,
} from '../validators/contract.validator';

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

// ============ Contracts ============
registry.registerPath({
  method: 'post',
  path: '/contracts',
  tags: ['Contracts'],
  summary: 'Create a new contract',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateContractSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Contract created successfully',
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
  path: '/contracts',
  tags: ['Contracts'],
  summary: 'List all contracts',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of contracts',
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
  path: '/contracts/{id}',
  tags: ['Contracts'],
  summary: 'Get a contract by ID',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Contract details',
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
      description: 'Contract not found',
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

// ============ Contract Terminations ============
registry.registerPath({
  method: 'post',
  path: '/contracts/{contractId}/terminate',
  tags: ['Contract Terminations'],
  summary: 'Request termination (buyer/seller initiated)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ contractId: z.string() }),
  },
  responses: {
    201: { description: 'Termination request created' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/contracts/{contractId}/admin-terminate',
  tags: ['Contract Terminations'],
  summary: 'Admin-initiated termination',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ contractId: z.string() }),
  },
  responses: {
    201: { description: 'Admin termination initiated' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/contracts/{contractId}/terminations',
  tags: ['Contract Terminations'],
  summary: 'Get terminations for a contract',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ contractId: z.string() }),
  },
  responses: {
    200: { description: 'List of terminations' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/terminations/pending',
  tags: ['Contract Terminations'],
  summary: 'Get pending terminations for review (admin)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'List of pending terminations' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/terminations/{terminationId}',
  tags: ['Contract Terminations'],
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
  tags: ['Contract Terminations'],
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
  tags: ['Contract Terminations'],
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
  tags: ['Contract Terminations'],
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
  tags: ['Contract Terminations'],
  summary: 'Cancel termination request',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ terminationId: z.string() }),
  },
  responses: {
    200: { description: 'Termination cancelled' },
  },
});

// ============ Contract Additional Routes ============
registry.registerPath({
  method: 'get',
  path: '/contracts/number/{contractNumber}',
  tags: ['Contracts'],
  summary: 'Get contract by contract number',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ contractNumber: z.string() }),
  },
  responses: {
    200: { description: 'Contract details' },
    404: { description: 'Contract not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/contracts/{id}',
  tags: ['Contracts'],
  summary: 'Update a contract',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Contract updated' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/contracts/{id}/transition',
  tags: ['Contracts'],
  summary: 'Transition contract state',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Contract transitioned' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/contracts/{id}/sign',
  tags: ['Contracts'],
  summary: 'Sign contract',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Contract signed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/contracts/{id}/cancel',
  tags: ['Contracts'],
  summary: 'Cancel contract',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Contract cancelled' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/contracts/{id}',
  tags: ['Contracts'],
  summary: 'Delete contract (draft only)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Contract deleted' },
  },
});

// ============ Contract Phases ============
registry.registerPath({
  method: 'get',
  path: '/contracts/{id}/phases',
  tags: ['Contract Phases'],
  summary: 'Get phases for a contract',
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
  path: '/contracts/{id}/phases/{phaseId}',
  tags: ['Contract Phases'],
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
  path: '/contracts/{id}/phases/{phaseId}/activate',
  tags: ['Contract Phases'],
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
  path: '/contracts/{id}/phases/{phaseId}/installments',
  tags: ['Contract Phases'],
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
  path: '/contracts/{id}/phases/{phaseId}/steps/complete',
  tags: ['Contract Phases'],
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
  path: '/contracts/{id}/phases/{phaseId}/documents',
  tags: ['Contract Phases'],
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
  path: '/contracts/{id}/documents/{documentId}/review',
  tags: ['Contract Phases'],
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
  path: '/contracts/{id}/phases/{phaseId}/complete',
  tags: ['Contract Phases'],
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
  path: '/contracts/{id}/phases/{phaseId}/skip',
  tags: ['Contract Phases'],
  summary: 'Skip phase (admin)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), phaseId: z.string() }),
  },
  responses: {
    200: { description: 'Phase skipped' },
  },
});

// ============ Contract Payments ============
registry.registerPath({
  method: 'post',
  path: '/contracts/{id}/payments',
  tags: ['Contract Payments'],
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
  path: '/contracts/{id}/payments',
  tags: ['Contract Payments'],
  summary: 'Get payments for contract',
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
  path: '/contracts/{id}/payments/{paymentId}',
  tags: ['Contract Payments'],
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
  path: '/contracts/payments/process',
  tags: ['Contract Payments'],
  summary: 'Process payment (webhook callback)',
  responses: {
    200: { description: 'Payment processed' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/contracts/{id}/payments/{paymentId}/refund',
  tags: ['Contract Payments'],
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
  path: '/contracts/{id}/pay-ahead',
  tags: ['Contract Payments'],
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
      description: 'Mortgage and contract management service for QShelter platform. Handles prequalifications, contracts, payment plans, phases, payments, and terminations.',
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
      { name: 'Contracts', description: 'Buyer contracts for property units' },
      { name: 'Contract Phases', description: 'Contract lifecycle phases (documentation, payment, etc.)' },
      { name: 'Contract Payments', description: 'Payment processing for contracts' },
      { name: 'Contract Terminations', description: 'Contract termination workflow' },
      { name: 'Prequalifications', description: 'Buyer prequalification for properties' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  });
}

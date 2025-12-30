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

export function generateOpenAPIDocument(): any {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '2.0.0',
      title: 'QShelter Contract Service API',
      description: 'Contract and payment management service for QShelter platform. Handles property contracts, payment plans, and installment tracking.',
    },
    servers: [
      {
        url: 'http://localhost:3003',
        description: 'Local development server',
      },
      {
        url: 'https://api-dev.qshelter.com',
        description: 'Development server',
      },
      {
        url: 'https://api.qshelter.com',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'Payment Plans', description: 'Payment plan templates (e.g., Outright, Installment 6mo)' },
      { name: 'Payment Methods', description: 'Property-specific payment method configurations' },
      { name: 'Contracts', description: 'Buyer contracts for property units' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  });
}

import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
  createMortgageSchema,
  updateMortgageSchema,
  mortgageResponseSchema,
  createMortgageTypeSchema,
  createPaymentSchema,
  paymentResponseSchema,
  createDownpaymentSchema,
} from '../validators/mortgage.validator.js';

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

// Register Mortgage routes
registry.registerPath({
  method: 'post',
  path: '/mortgage/mortgages',
  tags: ['Mortgages'],
  summary: 'Create a new mortgage application',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createMortgageSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Mortgage created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: mortgageResponseSchema,
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
  path: '/mortgage/mortgages',
  tags: ['Mortgages'],
  summary: 'List all mortgages',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of mortgages',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(mortgageResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/mortgage/payments',
  tags: ['Payments'],
  summary: 'Create a mortgage payment',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createPaymentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Payment created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: paymentResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/mortgage/downpayments',
  tags: ['Downpayments'],
  summary: 'Create a downpayment',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createDownpaymentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Downpayment created successfully',
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
  method: 'post',
  path: '/mortgage/mortgage-types',
  tags: ['Mortgage Types'],
  summary: 'Create a mortgage type',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createMortgageTypeSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Mortgage type created successfully',
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
      version: '1.0.0',
      title: 'QShelter Mortgage Service API',
      description: 'Mortgage management and processing service for QShelter platform',
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
      { name: 'Mortgages', description: 'Mortgage application endpoints' },
      { name: 'Mortgage Types', description: 'Mortgage type management' },
      { name: 'Payments', description: 'Mortgage payment endpoints' },
      { name: 'Downpayments', description: 'Downpayment endpoints' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  });
}

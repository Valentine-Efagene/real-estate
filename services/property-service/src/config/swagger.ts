import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
    createPropertySchema,
    updatePropertySchema,
    propertyResponseSchema,
    presignedUrlRequestSchema,
    presignedUrlResponseSchema,
} from '../validators/property.validator';

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

// Register Property routes
registry.registerPath({
    method: 'post',
    path: '/property/properties',
    tags: ['Properties'],
    summary: 'Create a new property listing',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createPropertySchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Property created successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: propertyResponseSchema,
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
    path: '/property/properties',
    tags: ['Properties'],
    summary: 'List all properties',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'List of properties',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.array(propertyResponseSchema),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/property/properties/{id}',
    tags: ['Properties'],
    summary: 'Get a property by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            description: 'Property details',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: propertyResponseSchema,
                    }),
                },
            },
        },
        404: {
            description: 'Property not found',
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
    path: '/property/properties/{id}',
    tags: ['Properties'],
    summary: 'Update a property',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string(),
        }),
        body: {
            content: {
                'application/json': {
                    schema: updatePropertySchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Property updated successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: propertyResponseSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/property/upload/presigned-url',
    tags: ['Upload'],
    summary: 'Get presigned S3 URL for file upload',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: presignedUrlRequestSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Presigned URL generated',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: presignedUrlResponseSchema,
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
            title: 'QShelter Property Service API',
            description: 'Property management service for QShelter platform',
        },
        servers: [
            {
                url: 'http://localhost:3002',
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
            { name: 'Properties', description: 'Property management endpoints' },
            { name: 'Upload', description: 'File upload endpoints' },
            { name: 'Health', description: 'Health check endpoints' },
        ],
    });
}

import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// =============================================================================
// Schemas
// =============================================================================

const ApiErrorSchema = z.object({
    error: z.string(),
    details: z.array(z.any()).optional(),
}).openapi('ApiError');

const TemplateSchema = z.object({
    id: z.string(),
    tenantId: z.string(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    category: z.string(),
    contentType: z.string(),
    templateBody: z.string(),
    version: z.number(),
    isActive: z.boolean(),
    mergeFields: z.array(z.string()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('Template');

const CreateTemplateSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.enum(['OFFER_LETTER', 'CONTRACT', 'RECEIPT', 'STATEMENT', 'NOTIFICATION', 'OTHER']),
    contentType: z.enum(['html', 'markdown', 'pdf']).default('html'),
    templateBody: z.string().min(1),
    mergeFields: z.array(z.string()).optional(),
}).openapi('CreateTemplate');

const UpdateTemplateSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    category: z.enum(['OFFER_LETTER', 'CONTRACT', 'RECEIPT', 'STATEMENT', 'NOTIFICATION', 'OTHER']).optional(),
    contentType: z.enum(['html', 'markdown', 'pdf']).optional(),
    templateBody: z.string().optional(),
    mergeFields: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
}).openapi('UpdateTemplate');

const GenerateDocumentSchema = z.object({
    templateCode: z.string().optional(),
    templateId: z.string().optional(),
    mergeData: z.record(z.string(), z.any()),
    outputFormat: z.enum(['html', 'pdf']).default('html'),
}).openapi('GenerateDocument');

// Register schemas
registry.register('Template', TemplateSchema);
registry.register('ApiError', ApiErrorSchema);

// Security scheme
registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});

// =============================================================================
// Template Endpoints
// =============================================================================

registry.registerPath({
    method: 'post',
    path: '/templates',
    tags: ['Templates'],
    summary: 'Create a new template',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateTemplateSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Template created',
            content: {
                'application/json': {
                    schema: TemplateSchema,
                },
            },
        },
        400: {
            description: 'Validation error',
            content: {
                'application/json': {
                    schema: ApiErrorSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/templates',
    tags: ['Templates'],
    summary: 'List all templates',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            category: z.string().optional().openapi({ description: 'Filter by category' }),
            isActive: z.string().optional().openapi({ description: 'Filter by active status (true/false)' }),
        }),
    },
    responses: {
        200: {
            description: 'List of templates',
            content: {
                'application/json': {
                    schema: z.array(TemplateSchema),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/templates/{id}',
    tags: ['Templates'],
    summary: 'Get template by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Template ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Template details',
            content: {
                'application/json': {
                    schema: TemplateSchema,
                },
            },
        },
        404: {
            description: 'Template not found',
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/templates/code/{code}',
    tags: ['Templates'],
    summary: 'Get template by code',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            code: z.string().openapi({ description: 'Template code' }),
        }),
        query: z.object({
            version: z.string().optional().openapi({ description: 'Specific version number' }),
        }),
    },
    responses: {
        200: {
            description: 'Template details',
            content: {
                'application/json': {
                    schema: TemplateSchema,
                },
            },
        },
        404: {
            description: 'Template not found',
        },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/templates/{id}',
    tags: ['Templates'],
    summary: 'Update template',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Template ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: UpdateTemplateSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Template updated',
            content: {
                'application/json': {
                    schema: TemplateSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/templates/{id}',
    tags: ['Templates'],
    summary: 'Delete template',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Template ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Template deleted',
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/templates/{id}/versions',
    tags: ['Templates'],
    summary: 'Create new template version',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Template ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        templateBody: z.string(),
                        mergeFields: z.array(z.string()).optional(),
                    }),
                },
            },
        },
    },
    responses: {
        201: {
            description: 'New version created',
            content: {
                'application/json': {
                    schema: TemplateSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/templates/validate',
    tags: ['Templates'],
    summary: 'Validate template syntax',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        templateBody: z.string(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Validation result',
            content: {
                'application/json': {
                    schema: z.object({
                        valid: z.boolean(),
                        errors: z.array(z.string()).optional(),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/templates/extract-fields',
    tags: ['Templates'],
    summary: 'Extract merge fields from template',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        templateBody: z.string(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Extracted merge fields',
            content: {
                'application/json': {
                    schema: z.object({
                        fields: z.array(z.string()),
                    }),
                },
            },
        },
    },
});

// =============================================================================
// Generation Endpoints
// =============================================================================

registry.registerPath({
    method: 'post',
    path: '/generate',
    tags: ['Generation'],
    summary: 'Generate document from template',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: GenerateDocumentSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Generated document',
            content: {
                'application/json': {
                    schema: z.object({
                        content: z.string(),
                        contentType: z.string(),
                    }),
                },
                'application/pdf': {
                    schema: z.any(),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/generate/offer-letter',
    tags: ['Generation'],
    summary: 'Generate offer letter for application',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        applicationId: z.string(),
                        templateCode: z.string().optional(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Generated offer letter',
            content: {
                'application/json': {
                    schema: z.object({
                        content: z.string(),
                        contentType: z.string(),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/generate/preview',
    tags: ['Generation'],
    summary: 'Preview template with sample data',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        templateCode: z.string().optional(),
                        templateId: z.string().optional(),
                        templateBody: z.string().optional(),
                        sampleData: z.record(z.string(), z.any()).optional(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Preview content',
            content: {
                'application/json': {
                    schema: z.object({
                        content: z.string(),
                        contentType: z.string(),
                    }),
                },
            },
        },
    },
});

// =============================================================================
// Generate OpenAPI Document
// =============================================================================

export function generateOpenAPIDocument(): any {
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            version: '1.0.0',
            title: 'QShelter Documents Service API',
            description: 'Document template management and generation service. Supports creating templates with merge fields and generating PDFs/HTML documents.',
        },
        servers: [
            {
                url: '',
                description: 'Current environment',
            },
        ],
        tags: [
            { name: 'Templates', description: 'Document template management' },
            { name: 'Generation', description: 'Document generation from templates' },
            { name: 'Health', description: 'Health check endpoints' },
        ],
    });
}

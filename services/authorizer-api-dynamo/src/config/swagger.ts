import {
    OpenAPIRegistry,
    OpenApiGeneratorV3,
    extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
    createPermissionSchema,
    permissionSchema,
    roleNameSchema,
    updatePermissionSchema,
} from '../validators/permission.validator';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const successEnvelope = <T extends z.ZodTypeAny>(schema: T) =>
    z.object({
        success: z.literal(true),
        data: schema,
    });

const errorEnvelope = z.object({
    success: z.literal(false),
    error: z.object({
        message: z.string(),
        details: z.any().optional(),
    }),
});

registry.register('Permission', permissionSchema);
registry.register('CreatePermissionRequest', createPermissionSchema);
registry.register('UpdatePermissionRequest', updatePermissionSchema);
registry.register('ApiError', errorEnvelope);

registry.registerComponent('securitySchemes', 'none', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'No auth is enforced in this sample project.',
});

registry.registerPath({
    method: 'get',
    path: '/permissions',
    tags: ['Permissions'],
    summary: 'List all permissions',
    responses: {
        200: {
            description: 'Permissions returned successfully',
            content: {
                'application/json': {
                    schema: successEnvelope(z.array(permissionSchema)),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/permissions',
    tags: ['Permissions'],
    summary: 'Create a permission policy record',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createPermissionSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Permission created',
            content: {
                'application/json': {
                    schema: successEnvelope(permissionSchema),
                },
            },
        },
        400: {
            description: 'Validation failed',
            content: {
                'application/json': {
                    schema: errorEnvelope,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/permissions/{roleName}',
    tags: ['Permissions'],
    summary: 'Get one permission by roleName',
    request: {
        params: z.object({ roleName: roleNameSchema }),
    },
    responses: {
        200: {
            description: 'Permission found',
            content: {
                'application/json': {
                    schema: successEnvelope(permissionSchema),
                },
            },
        },
        404: {
            description: 'Permission not found',
            content: {
                'application/json': {
                    schema: errorEnvelope,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'put',
    path: '/permissions/{roleName}',
    tags: ['Permissions'],
    summary: 'Update one permission by roleName',
    request: {
        params: z.object({ roleName: roleNameSchema }),
        body: {
            content: {
                'application/json': {
                    schema: updatePermissionSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Permission updated',
            content: {
                'application/json': {
                    schema: successEnvelope(permissionSchema),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/permissions/{roleName}',
    tags: ['Permissions'],
    summary: 'Partially update one permission by roleName',
    request: {
        params: z.object({ roleName: roleNameSchema }),
        body: {
            content: {
                'application/json': {
                    schema: updatePermissionSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Permission updated',
            content: {
                'application/json': {
                    schema: successEnvelope(permissionSchema),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/permissions/{roleName}',
    tags: ['Permissions'],
    summary: 'Delete one permission by roleName',
    request: {
        params: z.object({ roleName: roleNameSchema }),
    },
    responses: {
        200: {
            description: 'Permission deleted',
            content: {
                'application/json': {
                    schema: successEnvelope(z.object({ roleName: z.string() })),
                },
            },
        },
    },
});

export function generateOpenAPIDocument() {
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            title: 'Permissions API',
            version: '1.0.0',
            description:
                'CRUD API for permission policies stored in DynamoDB using Express, Zod, Swagger, TypeScript, esbuild, and Serverless.',
        },
        servers: [{ url: '/' }],
    });
}

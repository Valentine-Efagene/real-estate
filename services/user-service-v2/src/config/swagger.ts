import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { loginSchema, signupSchema, refreshTokenSchema, authResponseSchema } from '../validators/auth.validator';

extendZodWithOpenApi(z);

// Create a registry for all API endpoints
export const registry = new OpenAPIRegistry();

// Register common schemas
registry.register('User', z.object({
    id: z.string(),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    isActive: z.boolean(),
    isEmailVerified: z.boolean(),
    tenantId: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('User'));

registry.register('Tenant', z.object({
    id: z.string(),
    name: z.string(),
    subdomain: z.string(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('Tenant'));

registry.register('ApiError', z.object({
    success: z.literal(false),
    error: z.object({
        message: z.string(),
        code: z.string().optional(),
    }),
}).openapi('ApiError'));

registry.register('ApiSuccess', z.object({
    success: z.literal(true),
    data: z.any(),
}).openapi('ApiSuccess'));

// Register Auth routes
registry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['Auth'],
    summary: 'Login with email and password',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: loginSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Login successful',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: authResponseSchema,
                    }),
                },
            },
        },
        401: {
            description: 'Invalid credentials',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(false),
                        error: z.object({
                            message: z.string(),
                            code: z.string().optional(),
                        }),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/signup',
    tags: ['Auth'],
    summary: 'Register a new user account',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: signupSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Account created successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: authResponseSchema,
                    }),
                },
            },
        },
        409: {
            description: 'User already exists',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(false),
                        error: z.object({
                            message: z.string(),
                            code: z.string().optional(),
                        }),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags: ['Auth'],
    summary: 'Refresh access token',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: refreshTokenSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Token refreshed successfully',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: authResponseSchema,
                    }),
                },
            },
        },
        401: {
            description: 'Invalid or expired refresh token',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(false),
                        error: z.object({
                            message: z.string(),
                            code: z.string().optional(),
                        }),
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

// Generate OpenAPI document
export function generateOpenAPIDocument() {
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            version: '2.0.0',
            title: 'QShelter User Service API',
            description: 'User authentication and management service for QShelter platform',
        },
        servers: [
            {
                url: 'http://localhost:3000',
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
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Users', description: 'User management endpoints' },
            { name: 'Tenants', description: 'Tenant management endpoints' },
            { name: 'Health', description: 'Health check endpoints' },
        ],
    });
}

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
import {
    createVariantSchema,
    updateVariantSchema,
    variantResponseSchema,
} from '../validators/variant.validator';
import {
    createUnitSchema,
    updateUnitSchema,
    unitResponseSchema,
    bulkCreateUnitsSchema,
} from '../validators/unit.validator';
import {
    createAmenitySchema,
    updateAmenitySchema,
    amenityResponseSchema,
} from '../validators/amenity.validator';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// =============================================================================
// Common Schemas
// =============================================================================

const ApiErrorSchema = z.object({
    success: z.literal(false),
    error: z.object({
        message: z.string(),
        code: z.string().optional(),
    }),
}).openapi('ApiError');

const PaginationSchema = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
}).openapi('Pagination');

// Register schemas
registry.register('Property', propertyResponseSchema);
registry.register('Variant', variantResponseSchema);
registry.register('Unit', unitResponseSchema);
registry.register('Amenity', amenityResponseSchema);
registry.register('ApiError', ApiErrorSchema);
registry.register('Pagination', PaginationSchema);

// Register security scheme
registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});

// =============================================================================
// Property Endpoints
// =============================================================================
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

// =============================================================================
// Variant Endpoints
// =============================================================================

registry.registerPath({
    method: 'post',
    path: '/properties/{propertyId}/variants',
    tags: ['Variants'],
    summary: 'Create a variant for a property',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            propertyId: z.string().openapi({ description: 'Property ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: createVariantSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Variant created',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: variantResponseSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/properties/{propertyId}/variants',
    tags: ['Variants'],
    summary: 'List variants for a property',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            propertyId: z.string().openapi({ description: 'Property ID' }),
        }),
    },
    responses: {
        200: {
            description: 'List of variants',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.array(variantResponseSchema),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/variants/{variantId}',
    tags: ['Variants'],
    summary: 'Get a variant by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            variantId: z.string().openapi({ description: 'Variant ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Variant details',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: variantResponseSchema,
                    }),
                },
            },
        },
        404: {
            description: 'Variant not found',
            content: {
                'application/json': {
                    schema: ApiErrorSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'put',
    path: '/properties/{propertyId}/variants/{variantId}',
    tags: ['Variants'],
    summary: 'Update a variant',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            propertyId: z.string().openapi({ description: 'Property ID' }),
            variantId: z.string().openapi({ description: 'Variant ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: updateVariantSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Variant updated',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: variantResponseSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/properties/{propertyId}/variants/{variantId}',
    tags: ['Variants'],
    summary: 'Delete a variant',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            propertyId: z.string().openapi({ description: 'Property ID' }),
            variantId: z.string().openapi({ description: 'Variant ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Variant deleted',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({ message: z.string() }),
                    }),
                },
            },
        },
    },
});

// =============================================================================
// Unit Endpoints
// =============================================================================

registry.registerPath({
    method: 'post',
    path: '/properties/{propertyId}/variants/{variantId}/units',
    tags: ['Units'],
    summary: 'Create a unit for a variant',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            propertyId: z.string().openapi({ description: 'Property ID' }),
            variantId: z.string().openapi({ description: 'Variant ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: createUnitSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Unit created',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: unitResponseSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/properties/{propertyId}/variants/{variantId}/units/bulk',
    tags: ['Units'],
    summary: 'Bulk create units for a variant',
    description: 'Create multiple units at once in a single transaction. More efficient than creating units one by one. Max 500 units per request.',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            propertyId: z.string().openapi({ description: 'Property ID' }),
            variantId: z.string().openapi({ description: 'Variant ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: bulkCreateUnitsSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Units created',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.array(unitResponseSchema),
                    }),
                },
            },
        },
        400: {
            description: 'Validation error or duplicate unit numbers in batch',
        },
        409: {
            description: 'Unit numbers already exist in the variant',
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/properties/{propertyId}/variants/{variantId}/units',
    tags: ['Units'],
    summary: 'List units for a variant',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            propertyId: z.string().openapi({ description: 'Property ID' }),
            variantId: z.string().openapi({ description: 'Variant ID' }),
        }),
        query: z.object({
            status: z.string().optional().openapi({ description: 'Filter by status (AVAILABLE, RESERVED, SOLD)' }),
        }),
    },
    responses: {
        200: {
            description: 'List of units',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.array(unitResponseSchema),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/units/{unitId}',
    tags: ['Units'],
    summary: 'Get a unit by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            unitId: z.string().openapi({ description: 'Unit ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Unit details',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: unitResponseSchema,
                    }),
                },
            },
        },
        404: {
            description: 'Unit not found',
            content: {
                'application/json': {
                    schema: ApiErrorSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'put',
    path: '/units/{unitId}',
    tags: ['Units'],
    summary: 'Update a unit',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            unitId: z.string().openapi({ description: 'Unit ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: updateUnitSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Unit updated',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: unitResponseSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/units/{unitId}',
    tags: ['Units'],
    summary: 'Delete a unit',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            unitId: z.string().openapi({ description: 'Unit ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Unit deleted',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({ message: z.string() }),
                    }),
                },
            },
        },
    },
});

// =============================================================================
// Amenity Endpoints
// =============================================================================

registry.registerPath({
    method: 'post',
    path: '/amenities',
    tags: ['Amenities'],
    summary: 'Create a new amenity',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: createAmenitySchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Amenity created',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: amenityResponseSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/amenities',
    tags: ['Amenities'],
    summary: 'List all amenities',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'List of amenities',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.array(amenityResponseSchema),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/amenities/{id}',
    tags: ['Amenities'],
    summary: 'Get an amenity by ID',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Amenity ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Amenity details',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: amenityResponseSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'put',
    path: '/amenities/{id}',
    tags: ['Amenities'],
    summary: 'Update an amenity',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Amenity ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: updateAmenitySchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Amenity updated',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: amenityResponseSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/amenities/{id}',
    tags: ['Amenities'],
    summary: 'Delete an amenity',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Amenity ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Amenity deleted',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({ message: z.string() }),
                    }),
                },
            },
        },
    },
});

// =============================================================================
// Variant Amenity Management
// =============================================================================

registry.registerPath({
    method: 'post',
    path: '/variants/{variantId}/amenities',
    tags: ['Variants'],
    summary: 'Add amenities to a variant',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            variantId: z.string().openapi({ description: 'Variant ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        amenityIds: z.array(z.string()).openapi({ description: 'Array of amenity IDs to add' }),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Amenities added to variant',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({ message: z.string() }),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/variants/{variantId}/amenities/{amenityId}',
    tags: ['Variants'],
    summary: 'Remove an amenity from a variant',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            variantId: z.string().openapi({ description: 'Variant ID' }),
            amenityId: z.string().openapi({ description: 'Amenity ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Amenity removed from variant',
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({ message: z.string() }),
                    }),
                },
            },
        },
    },
});

export function generateOpenAPIDocument(): any {
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            version: '2.0.0',
            title: 'QShelter Property Service API',
            description: 'Property management service for QShelter platform. Manage properties, variants (unit types), individual units, and amenities.',
        },
        servers: [
            {
                url: '',
                description: 'Current environment',
            },
        ],
        tags: [
            { name: 'Properties', description: 'Property listings management' },
            { name: 'Variants', description: 'Property variants (unit types like 3-Bedroom, Studio)' },
            { name: 'Units', description: 'Individual sellable/rentable units' },
            { name: 'Amenities', description: 'Amenity management and assignment to variants' },
            { name: 'Upload', description: 'File upload endpoints' },
            { name: 'Health', description: 'Health check endpoints' },
        ],
    });
}

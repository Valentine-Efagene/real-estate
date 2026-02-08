import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Property schemas - aligned with Prisma schema (without price/bedrooms which moved to PropertyVariant)
export const createPropertySchema = z
    .object({
        title: z.string().min(1).openapi({ example: 'Luxury Apartment Complex' }),
        description: z.string().min(10).optional().openapi({ example: 'Beautiful modern apartment complex in downtown' }),
        category: z.enum(['SALE', 'RENT', 'LEASE']).openapi({ example: 'SALE' }),
        propertyType: z.string().openapi({ example: 'APARTMENT' }), // APARTMENT, HOUSE, LAND, COMMERCIAL, ESTATE, TOWNHOUSE
        country: z.string().min(1).openapi({ example: 'USA' }),
        currency: z.string().min(1).openapi({ example: 'USD' }),
        city: z.string().min(1).openapi({ example: 'New York' }),
        district: z.string().optional().openapi({ example: 'Manhattan' }),
        zipCode: z.string().optional().openapi({ example: '10001' }),
        streetAddress: z.string().optional().openapi({ example: '123 Main St' }),
        longitude: z.number().optional().openapi({ example: -73.935242 }),
        latitude: z.number().optional().openapi({ example: 40.730610 }),
        // Optional organization ownership - if set, any member of this org with DEVELOPER role can manage
        organizationId: z.string().optional().openapi({
            example: 'org_lekki_gardens_123',
            description: 'ID of the organization that owns this property (e.g., developer). If null, only the creating user can manage it.'
        }),
        // Display image ID - reference to a PropertyMedia record
        displayImageId: z.string().optional().openapi({
            example: 'media_123',
            description: 'ID of the PropertyMedia to use as display image'
        }),
        // Initial status - defaults to DRAFT
        status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT').openapi({
            example: 'DRAFT',
            description: 'Initial property status. If PUBLISHED, publishedAt will be set automatically.'
        }),
    })
    .openapi('CreatePropertyRequest');

export const updatePropertySchema = createPropertySchema.partial().openapi('UpdatePropertyRequest');

export const propertyResponseSchema = z
    .object({
        id: z.string().openapi({ example: 'prop_123' }),
        title: z.string(),
        description: z.string(),
        price: z.number(),
        address: z.string(),
        propertyType: z.string(),
        bedrooms: z.number().nullable(),
        bathrooms: z.number().nullable(),
        squareFeet: z.number().nullable(),
        lotSize: z.number().nullable(),
        yearBuilt: z.number().nullable(),
        ownerId: z.string(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    })
    .openapi('Property');

// Property Media schemas
export const uploadPropertyMediaSchema = z
    .object({
        propertyId: z.string().openapi({ example: 'prop_123' }),
        mediaType: z.enum(['IMAGE', 'VIDEO']).openapi({ example: 'IMAGE' }),
        url: z.string().url().openapi({ example: 'https://example.com/image.jpg' }),
        caption: z.string().optional().openapi({ example: 'Living room view' }),
    })
    .openapi('UploadPropertyMediaRequest');

// Presigned URL schema
export const presignedUrlRequestSchema = z
    .object({
        fileName: z.string().openapi({ example: 'property-image.jpg' }),
        fileType: z.string().openapi({ example: 'image/jpeg' }),
        propertyId: z.string().optional().openapi({ example: 'prop_123' }),
    })
    .openapi('PresignedUrlRequest');

export const presignedUrlResponseSchema = z
    .object({
        uploadUrl: z.string().url().openapi({ example: 'https://s3.amazonaws.com/...' }),
        fileUrl: z.string().url().openapi({ example: 'https://cdn.example.com/...' }),
        expiresIn: z.number().openapi({ example: 300 }),
    })
    .openapi('PresignedUrlResponse');

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyResponse = z.infer<typeof propertyResponseSchema>;
export type UploadPropertyMediaInput = z.infer<typeof uploadPropertyMediaSchema>;
export type PresignedUrlRequest = z.infer<typeof presignedUrlRequestSchema>;
export type PresignedUrlResponse = z.infer<typeof presignedUrlResponseSchema>;

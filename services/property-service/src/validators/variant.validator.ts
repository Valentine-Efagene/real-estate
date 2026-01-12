import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const createVariantSchema = z
    .object({
        name: z.string().min(1).openapi({ example: '3-Bedroom Flat' }),
        description: z.string().optional().openapi({ example: 'Spacious 3-bedroom flat with modern finishes' }),
        nBedrooms: z.number().int().min(0).optional().openapi({ example: 3 }),
        nBathrooms: z.number().int().min(0).optional().openapi({ example: 2 }),
        nParkingSpots: z.number().int().min(0).optional().openapi({ example: 1 }),
        area: z.number().positive().optional().openapi({ example: 150 }),
        price: z.number().positive().openapi({ example: 85000000 }),
        pricePerSqm: z.number().positive().optional().openapi({ example: 566667 }),
        totalUnits: z.number().int().min(1).default(1).openapi({ example: 20 }),
        availableUnits: z.number().int().min(0).optional().openapi({ example: 15 }),
        status: z.enum(['AVAILABLE', 'LOW_STOCK', 'SOLD_OUT', 'ARCHIVED']).default('AVAILABLE').openapi({ example: 'AVAILABLE' }),
        isActive: z.boolean().default(true).openapi({ example: true }),
    })
    .openapi('CreateVariantRequest');

export const updateVariantSchema = createVariantSchema.partial().openapi('UpdateVariantRequest');

export const variantResponseSchema = z
    .object({
        id: z.string().openapi({ example: 'clz1234567890' }),
        propertyId: z.string().openapi({ example: 'prop_123' }),
        name: z.string(),
        description: z.string().nullable(),
        nBedrooms: z.number().nullable(),
        nBathrooms: z.number().nullable(),
        nParkingSpots: z.number().nullable(),
        area: z.number().nullable(),
        price: z.number(),
        pricePerSqm: z.number().nullable(),
        totalUnits: z.number(),
        availableUnits: z.number(),
        reservedUnits: z.number(),
        soldUnits: z.number(),
        status: z.string(),
        isActive: z.boolean(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    })
    .openapi('Variant');

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type VariantResponse = z.infer<typeof variantResponseSchema>;

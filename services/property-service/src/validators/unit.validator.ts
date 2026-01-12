import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const createUnitSchema = z
    .object({
        unitNumber: z.string().min(1).openapi({ example: '14B' }),
        floorNumber: z.number().int().optional().openapi({ example: 14 }),
        blockName: z.string().optional().openapi({ example: 'Block B' }),
        priceOverride: z.number().positive().optional().openapi({ example: 87000000 }),
        areaOverride: z.number().positive().optional().openapi({ example: 155 }),
        notes: z.string().optional().openapi({ example: 'Corner unit with extra windows' }),
        status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED', 'UNAVAILABLE']).default('AVAILABLE').openapi({ example: 'AVAILABLE' }),
    })
    .openapi('CreateUnitRequest');

export const updateUnitSchema = createUnitSchema.partial().openapi('UpdateUnitRequest');

export const unitResponseSchema = z
    .object({
        id: z.string().openapi({ example: 'clz1234567890' }),
        variantId: z.string().openapi({ example: 'var_123' }),
        unitNumber: z.string(),
        floorNumber: z.number().nullable(),
        blockName: z.string().nullable(),
        priceOverride: z.number().nullable(),
        areaOverride: z.number().nullable(),
        notes: z.string().nullable(),
        status: z.string(),
        reservedAt: z.string().datetime().nullable(),
        reservedUntil: z.string().datetime().nullable(),
        reservedById: z.string().nullable(),
        ownerId: z.string().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    })
    .openapi('Unit');

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type UnitResponse = z.infer<typeof unitResponseSchema>;

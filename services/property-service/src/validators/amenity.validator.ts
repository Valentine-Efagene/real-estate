import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Amenity schemas
export const createAmenitySchema = z
    .object({
        name: z.string().min(1).openapi({ example: 'Swimming Pool' }),
    })
    .openapi('CreateAmenityRequest');

export const updateAmenitySchema = createAmenitySchema.partial().openapi('UpdateAmenityRequest');

export const amenityResponseSchema = z
    .object({
        id: z.string().openapi({ example: 'amenity_123' }),
        name: z.string(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    })
    .openapi('Amenity');

export type CreateAmenityInput = z.infer<typeof createAmenitySchema>;
export type UpdateAmenityInput = z.infer<typeof updateAmenitySchema>;

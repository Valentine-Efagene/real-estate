import { z } from 'zod';

export const PromotionDiscountTypeSchema = z.enum(['PERCENTAGE', 'FIXED_AMOUNT']);

export const createPropertyPromotionSchema = z.object({
    variantId: z.string().optional(),
    name: z.string().min(1).max(120),
    description: z.string().optional(),
    discountType: PromotionDiscountTypeSchema,
    discountValue: z.number().positive(),
    maxDiscount: z.number().positive().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
    priority: z.number().int().min(0).max(1000).optional(),
});

export const updatePropertyPromotionSchema = createPropertyPromotionSchema.partial();

export type CreatePropertyPromotionInput = z.infer<typeof createPropertyPromotionSchema>;
export type UpdatePropertyPromotionInput = z.infer<typeof updatePropertyPromotionSchema>;

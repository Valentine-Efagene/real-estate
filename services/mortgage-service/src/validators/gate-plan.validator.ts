import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const CreateGatePlanSchema = z.object({
    name: z.string().min(1).max(200).openapi({ example: 'Platform Developer Approval' }),
    description: z.string().optional().openapi({ example: 'Platform admin reviews and approves developer organizations' }),
    isActive: z.boolean().default(true),
    requiredApprovals: z.number().int().min(1).default(1).openapi({ example: 1 }),
    reviewerOrganizationTypeCode: z.string().min(1).openapi({
        example: 'PLATFORM',
        description: 'Code of the organization type whose members can review this gate',
    }),
    reviewerInstructions: z.string().optional().openapi({ example: 'Verify the organization meets platform standards' }),
}).openapi('CreateGatePlan');

export const UpdateGatePlanSchema = CreateGatePlanSchema.partial().openapi('UpdateGatePlan');

export type CreateGatePlanInput = z.infer<typeof CreateGatePlanSchema>;
export type UpdateGatePlanInput = z.infer<typeof UpdateGatePlanSchema>;

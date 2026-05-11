import { z } from 'zod';

export const CreateAdminDocumentOverrideSchema = z.object({
    applicationId: z.string().min(1).openapi({ example: 'clapp123', description: 'Application to override' }),
    phaseId: z.string().optional().openapi({ example: 'clphase456', description: 'Limit override to a specific phase (omit for application-wide)' }),
    documentDefinitionId: z.string().optional().openapi({ example: 'cldoc789', description: 'Limit override to a specific document definition (omit for phase or application-wide)' }),
    decision: z.enum(['proceed']).default('proceed').openapi({ description: "Override decision. Currently only 'proceed'" }),
    reason: z.string().min(3).max(2000).openapi({ example: 'Customer confirmed identity via notarised affidavit; document definition pre-dates current policy' }),
}).openapi('CreateAdminDocumentOverride');

export type CreateAdminDocumentOverrideInput = z.infer<typeof CreateAdminDocumentOverrideSchema>;

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const CreateDocumentWaiverSchema = z.object({
    documentDefinitionId: z.string().uuid().openapi({
        description: 'ID of the document definition to waive',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    reason: z.string().max(500).optional().openapi({
        description: 'Optional reason for waiving this document',
        example: 'Organization already provided equivalent documentation',
    }),
}).openapi('CreateDocumentWaiver');

export const BulkCreateDocumentWaiverSchema = z.object({
    documentDefinitionIds: z.array(z.string().uuid()).min(1).openapi({
        description: 'IDs of the document definitions to waive',
        example: ['550e8400-e29b-41d4-a716-446655440000'],
    }),
    reason: z.string().max(500).optional().openapi({
        description: 'Optional reason for waiving these documents',
        example: 'Pre-approved organization — standard docs waived',
    }),
}).openapi('BulkCreateDocumentWaiver');

// TYPE EXPORTS
export type CreateDocumentWaiverInput = z.infer<typeof CreateDocumentWaiverSchema>;
export type BulkCreateDocumentWaiverInput = z.infer<typeof BulkCreateDocumentWaiverSchema>;

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Define merge field schema
const MergeFieldSchema = z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'date', 'currency', 'boolean']),
    required: z.boolean().default(true),
    description: z.string().optional(),
    defaultValue: z.any().optional(),
});

// Create template
export const CreateTemplateSchema = z
    .object({
        name: z.string().min(1).max(200),
        code: z.string().min(1).max(50).regex(/^[A-Z_]+$/, 'Code must be uppercase with underscores'),
        description: z.string().optional(),
        htmlTemplate: z.string().min(1),
        cssStyles: z.string().optional(),
        mergeFields: z.array(MergeFieldSchema).optional(),
        isDefault: z.boolean().default(false),
    })
    .openapi('CreateTemplate');

export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;

// Update template
export const UpdateTemplateSchema = z
    .object({
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        htmlTemplate: z.string().min(1).optional(),
        cssStyles: z.string().optional(),
        mergeFields: z.array(MergeFieldSchema).optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
    })
    .openapi('UpdateTemplate');

export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;

// Generate document from template
export const GenerateDocumentSchema = z
    .object({
        templateId: z.string().optional(),
        templateCode: z.string().optional(),
        mergeData: z.record(z.string(), z.any()),
    })
    .refine((data) => data.templateId || data.templateCode, {
        message: 'Either templateId or templateCode must be provided',
    })
    .openapi('GenerateDocument');

export type GenerateDocumentInput = z.infer<typeof GenerateDocumentSchema>;

// List templates query
export const ListTemplatesSchema = z
    .object({
        code: z.string().optional(),
        isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    })
    .openapi('ListTemplates');

export type ListTemplatesInput = z.infer<typeof ListTemplatesSchema>;

// Create new version of template
export const CreateTemplateVersionSchema = z
    .object({
        htmlTemplate: z.string().min(1),
        cssStyles: z.string().optional(),
        mergeFields: z.array(MergeFieldSchema).optional(),
    })
    .openapi('CreateTemplateVersion');

export type CreateTemplateVersionInput = z.infer<typeof CreateTemplateVersionSchema>;

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const SendWhatsAppMessageSchema = z.object({
    destinationNumber: z.string().min(1),
    message: z.string().min(1),
}).openapi('SendWhatsAppMessage');

export type SendWhatsAppMessageInput = z.infer<typeof SendWhatsAppMessageSchema>;

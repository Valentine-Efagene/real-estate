import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const SendSmsSchema = z.object({
    destinationNumber: z.string().min(1),
    message: z.string().min(1),
}).openapi('SendSms');

export type SendSmsInput = z.infer<typeof SendSmsSchema>;

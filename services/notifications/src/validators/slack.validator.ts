import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const SendSlackMessageSchema = z.object({
    channel: z.string().min(1),
    text: z.string().min(1),
}).openapi('SendSlackMessage');

export type SendSlackMessageInput = z.infer<typeof SendSlackMessageSchema>;

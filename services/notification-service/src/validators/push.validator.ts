import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const TokenRegistrationSchema = z.object({
    userId: z.string().uuid(),
    token: z.string().min(1),
}).openapi('TokenRegistration');

export const EndpointVerificationSchema = z.object({
    endpointArn: z.string().min(1),
}).openapi('EndpointVerification');

export const NotificationSchema = z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    endpointArn: z.string().min(1),
    data: z.record(z.string(), z.string()).optional(),
}).openapi('Notification');

export type TokenRegistrationInput = z.infer<typeof TokenRegistrationSchema>;
export type EndpointVerificationInput = z.infer<typeof EndpointVerificationSchema>;
export type NotificationInput = z.infer<typeof NotificationSchema>;

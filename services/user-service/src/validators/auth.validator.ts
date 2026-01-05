import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const loginSchema = z.object({
    email: z.string().email().openapi({ example: 'user@example.com' }),
    password: z.string().min(8).openapi({ example: 'Password123!' }),
}).openapi('LoginRequest');

export const signupSchema = z.object({
    email: z.string().email().openapi({ example: 'newuser@example.com' }),
    password: z.string().min(8).openapi({ example: 'SecurePass123!' }),
    firstName: z.string().min(1).openapi({ example: 'John' }),
    lastName: z.string().min(1).openapi({ example: 'Doe' }),
    avatar: z.string().url().optional().openapi({ example: 'https://example.com/avatar.jpg' }),
}).openapi('SignupRequest');

export const refreshTokenSchema = z.object({
    refreshToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
}).openapi('RefreshTokenRequest');

export const authResponseSchema = z.object({
    accessToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    refreshToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    expiresIn: z.number().openapi({ example: 900 }),
}).openapi('AuthResponse');

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

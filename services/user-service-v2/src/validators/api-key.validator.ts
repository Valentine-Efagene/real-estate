import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Schema for creating a new API key
 * 
 * The partner provides:
 * - name: Human-readable identifier (e.g., "CRM Integration")
 * - description: Optional detailed description
 * - provider: Optional identifier for the integration partner
 * - scopes: Array of scopes this key grants access to
 * - expiresAt: Optional expiration date
 */
export const createApiKeySchema = z.object({
    name: z.string().min(1).max(100).openapi({
        example: 'CRM Integration',
        description: 'Human-readable name for the API key',
    }),
    description: z.string().max(500).optional().openapi({
        example: 'Used by Salesforce to sync property data',
        description: 'Detailed description of the key purpose',
    }),
    provider: z.string().max(50).optional().openapi({
        example: 'salesforce',
        description: 'Identifier for the integration partner',
    }),
    scopes: z.array(z.string()).min(1).openapi({
        example: ['property:read', 'mortgage:read'],
        description: 'Scopes this key grants. Use format "resource:action"',
    }),
    expiresAt: z.coerce.date().optional().openapi({
        example: '2025-12-31T23:59:59.000Z',
        description: 'Optional expiration date for the key',
    }),
}).openapi('CreateApiKeyRequest');

/**
 * Response when an API key is created
 * 
 * IMPORTANT: The `credential` field contains the secret and is
 * returned ONLY at creation time. Store it securely!
 */
export const createApiKeyResponseSchema = z.object({
    id: z.string().uuid().openapi({
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        description: 'Unique identifier for the API key',
    }),
    credential: z.string().openapi({
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479.abc123def456...',
        description: 'The full API key credential (keyId.secret). Store securely - shown only once!',
    }),
    name: z.string().openapi({ example: 'CRM Integration' }),
    scopes: z.array(z.string()).openapi({ example: ['property:read', 'mortgage:read'] }),
    expiresAt: z.date().nullable().openapi({
        example: '2025-12-31T23:59:59.000Z',
    }),
    createdAt: z.date().openapi({
        example: '2024-01-15T10:30:00.000Z',
    }),
}).openapi('CreateApiKeyResponse');

/**
 * API key metadata (returned in list and get operations)
 * 
 * Note: Never includes the actual secret
 */
export const apiKeyMetadataSchema = z.object({
    id: z.string().uuid().openapi({
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    }),
    name: z.string().openapi({ example: 'CRM Integration' }),
    description: z.string().nullable().openapi({
        example: 'Used by Salesforce to sync property data',
    }),
    provider: z.string().nullable().openapi({ example: 'salesforce' }),
    scopes: z.array(z.string()).openapi({
        example: ['property:read', 'mortgage:read'],
    }),
    enabled: z.boolean().openapi({
        example: true,
        description: 'Whether the key is currently active',
    }),
    expiresAt: z.date().nullable().openapi({
        example: '2025-12-31T23:59:59.000Z',
    }),
    lastUsedAt: z.date().nullable().openapi({
        example: '2024-01-20T14:22:00.000Z',
        description: 'Last time the key was used to exchange for a token',
    }),
    revokedAt: z.date().nullable().openapi({
        example: null,
        description: 'If set, the key has been revoked',
    }),
    createdAt: z.date().openapi({
        example: '2024-01-15T10:30:00.000Z',
    }),
}).openapi('ApiKeyMetadata');

/**
 * List API keys response
 */
export const listApiKeysResponseSchema = z.array(apiKeyMetadataSchema).openapi('ListApiKeysResponse');

/**
 * Token exchange request
 * 
 * The credential should be in format: {keyId}.{secret}
 */
export const exchangeTokenSchema = z.object({
    credential: z.string().min(1).openapi({
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479.abc123def456789012345678901234567890123456789012345678901234',
        description: 'API key credential in format: keyId.secret',
    }),
}).openapi('ExchangeTokenRequest');

/**
 * Token response from exchange
 */
export const apiKeyTokenResponseSchema = z.object({
    accessToken: z.string().openapi({
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'JWT access token to use for API calls',
    }),
    tokenType: z.literal('Bearer').openapi({
        example: 'Bearer',
        description: 'Token type (always Bearer)',
    }),
    expiresIn: z.number().openapi({
        example: 900,
        description: 'Token lifetime in seconds',
    }),
}).openapi('ApiKeyTokenResponse');

/**
 * Enable/disable request
 */
export const setEnabledSchema = z.object({
    enabled: z.boolean().openapi({
        example: true,
        description: 'Whether to enable or disable the key',
    }),
}).openapi('SetEnabledRequest');

// Type exports
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;
export type ApiKeyMetadata = z.infer<typeof apiKeyMetadataSchema>;
export type ExchangeTokenInput = z.infer<typeof exchangeTokenSchema>;
export type ApiKeyTokenResponse = z.infer<typeof apiKeyTokenResponseSchema>;
export type SetEnabledInput = z.infer<typeof setEnabledSchema>;

import { randomBytes, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import {
    SecretsManagerClient,
    CreateSecretCommand,
    GetSecretValueCommand,
    DeleteSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { prisma } from '../lib/prisma';
import {
    NotFoundError,
    UnauthorizedError,
    ValidationError,
    ForbiddenError,
} from '@valentine-efagene/qshelter-common';

/**
 * AWS Secrets Manager client configuration
 * 
 * In production: connects to real AWS Secrets Manager
 * In LocalStack: connects to LocalStack's emulated Secrets Manager
 * 
 * The secret is stored with a name like: qshelter/{stage}/api-keys/{keyId}
 * This allows easy management and rotation.
 */
function createSecretsClient(): SecretsManagerClient {
    const stage = process.env.NODE_ENV || 'dev';
    const isLocalStack = stage === 'test' || process.env.LOCALSTACK_ENDPOINT;

    const clientConfig: any = { region: process.env.AWS_REGION || 'us-east-1' };

    if (isLocalStack) {
        const endpoint = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
        clientConfig.endpoint = endpoint;
        clientConfig.credentials = {
            accessKeyId: 'test',
            secretAccessKey: 'test',
        };
    }

    return new SecretsManagerClient(clientConfig);
}

const secretsClient = createSecretsClient();

/**
 * Input for creating a new API key
 */
export interface CreateApiKeyInput {
    /** Human-readable name for the key (e.g., "CRM Integration") */
    name: string;
    /** Optional description */
    description?: string;
    /** Provider/partner identifier (e.g., "salesforce", "hubspot") */
    provider?: string;
    /** Scopes this key grants (e.g., ["property:read", "mortgage:read"]) */
    scopes: string[];
    /** Optional expiration date */
    expiresAt?: Date;
}

/**
 * Response when creating an API key
 * 
 * IMPORTANT: The `secret` is returned ONLY at creation time.
 * It cannot be retrieved later - only regenerated.
 */
export interface CreateApiKeyResponse {
    /** The API key ID */
    id: string;
    /** The raw API key credential in format: {id}.{secret} */
    credential: string;
    /** Human-readable name */
    name: string;
    /** Granted scopes */
    scopes: string[];
    /** Expiration date if set */
    expiresAt: Date | null;
    /** When the key was created */
    createdAt: Date;
}

/**
 * API key metadata (no secret)
 */
export interface ApiKeyMetadata {
    id: string;
    name: string;
    description: string | null;
    provider: string | null;
    scopes: string[];
    enabled: boolean;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
}

/**
 * Token response from API key exchange
 */
export interface ApiKeyTokenResponse {
    /** JWT access token */
    accessToken: string;
    /** Token type (always "Bearer") */
    tokenType: 'Bearer';
    /** Time to expiry in seconds */
    expiresIn: number;
}

/**
 * API Key Service
 * 
 * Manages API keys for third-party integrations. Each API key:
 * 1. Has a random secret stored in AWS Secrets Manager (not in DB)
 * 2. Has metadata (name, scopes, expiry) stored in the database
 * 3. Can be exchanged for a short-lived JWT token
 * 
 * Flow:
 * 1. Admin creates API key → gets `id.secret` credential (shown once)
 * 2. Partner stores credential securely
 * 3. Partner calls token endpoint with credential
 * 4. We validate and return short-lived JWT
 * 5. Partner uses JWT for API calls
 * 6. When JWT expires, partner exchanges credential again
 */
class ApiKeyService {
    private readonly stage = process.env.NODE_ENV || 'dev';

    /**
     * Create a new API key for a tenant
     * 
     * Security considerations:
     * - Generates a cryptographically secure random secret (32 bytes = 64 hex chars)
     * - Stores secret in Secrets Manager, not in the database
     * - Returns the full credential ONLY once
     * - The credential format is: {keyId}.{secret}
     * 
     * @param tenantId - The tenant this key belongs to
     * @param input - Key configuration (name, scopes, expiry)
     * @param createdBy - User ID who created this key (for audit trail)
     * @returns The API key with its secret (shown only once)
     */
    async create(
        tenantId: string,
        input: CreateApiKeyInput,
        createdBy: string
    ): Promise<CreateApiKeyResponse> {
        // Validate scopes are not empty
        if (!input.scopes || input.scopes.length === 0) {
            throw new ValidationError('At least one scope is required');
        }

        // Generate a unique key ID and a cryptographically secure secret
        const keyId = randomUUID();
        const secret = randomBytes(32).toString('hex'); // 64 character hex string

        // Build the secret name for Secrets Manager
        // Format: qshelter/{stage}/api-keys/{keyId}
        const secretName = this.buildSecretName(keyId);

        try {
            // Step 1: Store the secret in Secrets Manager
            await secretsClient.send(new CreateSecretCommand({
                Name: secretName,
                SecretString: secret,
                Description: `API Key for ${input.name} (Tenant: ${tenantId})`,
                Tags: [
                    { Key: 'tenantId', Value: tenantId },
                    { Key: 'keyId', Value: keyId },
                    { Key: 'provider', Value: input.provider || 'unknown' },
                ],
            }));

            // Step 2: Store metadata in database (with secretRef, not the actual secret)
            // The secretRef is the ARN or name of the secret in Secrets Manager
            const apiKey = await prisma.apiKey.create({
                data: {
                    id: keyId,
                    tenantId,
                    name: input.name,
                    description: input.description,
                    provider: input.provider || 'unknown',
                    secretRef: secretName, // Reference to Secrets Manager, not the actual secret
                    scopes: input.scopes,
                    enabled: true,
                    expiresAt: input.expiresAt,
                    createdBy,
                },
            });

            // Return the credential - this is the ONLY time the secret is returned
            return {
                id: apiKey.id,
                credential: `${keyId}.${secret}`, // Format: {id}.{secret}
                name: apiKey.name,
                scopes: apiKey.scopes as string[],
                expiresAt: apiKey.expiresAt,
                createdAt: apiKey.createdAt,
            };
        } catch (error: any) {
            // If database insert fails, try to clean up the secret
            try {
                await secretsClient.send(new DeleteSecretCommand({
                    SecretId: secretName,
                    ForceDeleteWithoutRecovery: true,
                }));
            } catch {
                // Ignore cleanup errors
            }
            throw error;
        }
    }

    /**
     * List all API keys for a tenant (metadata only, no secrets)
     * 
     * @param tenantId - Filter by tenant
     * @param includeRevoked - Whether to include revoked keys
     */
    async list(tenantId: string, includeRevoked = false): Promise<ApiKeyMetadata[]> {
        const where: any = { tenantId };
        if (!includeRevoked) {
            where.revokedAt = null;
        }

        const keys = await prisma.apiKey.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                description: true,
                provider: true,
                scopes: true,
                enabled: true,
                expiresAt: true,
                lastUsedAt: true,
                revokedAt: true,
                createdAt: true,
            },
        });

        return keys.map(key => ({
            ...key,
            scopes: key.scopes as string[],
        }));
    }

    /**
     * Get a single API key by ID (metadata only)
     */
    async getById(tenantId: string, keyId: string): Promise<ApiKeyMetadata> {
        const key = await prisma.apiKey.findFirst({
            where: { id: keyId, tenantId },
            select: {
                id: true,
                name: true,
                description: true,
                provider: true,
                scopes: true,
                enabled: true,
                expiresAt: true,
                lastUsedAt: true,
                revokedAt: true,
                createdAt: true,
            },
        });

        if (!key) {
            throw new NotFoundError('API key not found');
        }

        return {
            ...key,
            scopes: key.scopes as string[],
        };
    }

    /**
     * Revoke an API key
     * 
     * This:
     * 1. Marks the key as revoked in the database
     * 2. Deletes the secret from Secrets Manager
     * 
     * Revoked keys cannot be used to exchange for tokens.
     * 
     * @param tenantId - The tenant owning the key
     * @param keyId - The key to revoke
     * @param revokedBy - User ID who is revoking (for audit)
     */
    async revoke(tenantId: string, keyId: string, revokedBy: string): Promise<void> {
        const key = await prisma.apiKey.findFirst({
            where: { id: keyId, tenantId },
        });

        if (!key) {
            throw new NotFoundError('API key not found');
        }

        if (key.revokedAt) {
            throw new ValidationError('API key is already revoked');
        }

        // Delete the secret from Secrets Manager
        try {
            await secretsClient.send(new DeleteSecretCommand({
                SecretId: key.secretRef,
                ForceDeleteWithoutRecovery: true, // Immediate deletion
            }));
        } catch (error: any) {
            // Log but don't fail if secret doesn't exist (might already be deleted)
            console.warn(`Failed to delete secret ${key.secretRef}:`, error.message);
        }

        // Mark as revoked in database
        await prisma.apiKey.update({
            where: { id: keyId },
            data: {
                revokedAt: new Date(),
                revokedBy,
                enabled: false,
            },
        });
    }

    /**
     * Enable or disable an API key
     * 
     * Disabled keys cannot be used to exchange for tokens, but the secret
     * is preserved. This is useful for temporary suspension.
     */
    async setEnabled(tenantId: string, keyId: string, enabled: boolean): Promise<void> {
        const key = await prisma.apiKey.findFirst({
            where: { id: keyId, tenantId },
        });

        if (!key) {
            throw new NotFoundError('API key not found');
        }

        if (key.revokedAt) {
            throw new ValidationError('Cannot modify a revoked API key');
        }

        await prisma.apiKey.update({
            where: { id: keyId },
            data: { enabled },
        });
    }

    /**
     * Exchange an API key credential for a short-lived JWT token
     * 
     * This is the main authentication flow for API key users:
     * 1. Parse the credential into keyId and secret
     * 2. Look up the key metadata from database
     * 3. Validate the key is active (enabled, not revoked, not expired)
     * 4. Retrieve the stored secret from Secrets Manager
     * 5. Compare secrets using timing-safe comparison
     * 6. Generate a short-lived JWT with the key's scopes
     * 7. Update lastUsedAt timestamp
     * 
     * @param credential - The API key credential in format: {keyId}.{secret}
     * @returns A short-lived JWT token
     */
    async exchangeToken(credential: string): Promise<ApiKeyTokenResponse> {
        // Step 1: Parse the credential
        const { keyId, secret } = this.parseCredential(credential);

        // Step 2: Look up key metadata
        const key = await prisma.apiKey.findUnique({
            where: { id: keyId },
            include: {
                tenant: {
                    select: { id: true },
                },
            },
        });

        if (!key) {
            // Use generic error to prevent enumeration
            throw new UnauthorizedError('Invalid API key');
        }

        // Step 3: Validate key state
        if (key.revokedAt) {
            throw new UnauthorizedError('API key has been revoked');
        }

        if (!key.enabled) {
            throw new ForbiddenError('API key is disabled');
        }

        if (key.expiresAt && key.expiresAt < new Date()) {
            throw new UnauthorizedError('API key has expired');
        }

        // Step 4: Retrieve the stored secret from Secrets Manager
        let storedSecret: string;
        try {
            const response = await secretsClient.send(new GetSecretValueCommand({
                SecretId: key.secretRef,
            }));
            storedSecret = response.SecretString || '';
        } catch (error: any) {
            console.error(`Failed to retrieve secret for key ${keyId}:`, error.message);
            throw new UnauthorizedError('Invalid API key');
        }

        // Step 5: Compare secrets using timing-safe comparison
        if (!this.timingSafeEqual(secret, storedSecret)) {
            throw new UnauthorizedError('Invalid API key');
        }

        // Step 6: Generate short-lived JWT
        const accessSecret = process.env.JWT_ACCESS_SECRET!;
        const expiresInSeconds = 900; // 15 minutes - short-lived for API keys

        const payload = {
            sub: key.id, // The API key ID as subject
            tenantId: key.tenantId,
            principalType: 'apiKey' as const, // Distinguishes from user tokens
            scopes: key.scopes, // Scopes are embedded directly for API keys
            provider: key.provider,
            iat: Math.floor(Date.now() / 1000),
        };

        const accessToken = jwt.sign(payload, accessSecret, {
            expiresIn: expiresInSeconds,
        } as jwt.SignOptions);

        // Step 7: Update lastUsedAt (fire-and-forget, don't wait)
        prisma.apiKey.update({
            where: { id: keyId },
            data: { lastUsedAt: new Date() },
        }).catch(err => {
            console.warn(`Failed to update lastUsedAt for key ${keyId}:`, err.message);
        });

        return {
            accessToken,
            tokenType: 'Bearer',
            expiresIn: expiresInSeconds,
        };
    }

    /**
     * Parse a credential string into keyId and secret
     * 
     * The credential format is: {keyId}.{secret}
     * Where keyId is a UUID and secret is a 64-character hex string
     */
    private parseCredential(credential: string): { keyId: string; secret: string } {
        if (!credential || typeof credential !== 'string') {
            throw new UnauthorizedError('Invalid API key format');
        }

        // Split on first dot only (in case secret contains dots, though it shouldn't)
        const dotIndex = credential.indexOf('.');
        if (dotIndex === -1) {
            throw new UnauthorizedError('Invalid API key format');
        }

        const keyId = credential.substring(0, dotIndex);
        const secret = credential.substring(dotIndex + 1);

        // Validate keyId looks like a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(keyId)) {
            throw new UnauthorizedError('Invalid API key format');
        }

        // Validate secret is a 64-char hex string
        const hexRegex = /^[0-9a-f]{64}$/i;
        if (!hexRegex.test(secret)) {
            throw new UnauthorizedError('Invalid API key format');
        }

        return { keyId, secret };
    }

    /**
     * Timing-safe string comparison to prevent timing attacks
     * 
     * A timing attack could measure how long comparison takes to
     * determine how many characters match. This function always
     * takes the same time regardless of where the mismatch is.
     */
    private timingSafeEqual(a: string, b: string): boolean {
        if (a.length !== b.length) {
            return false;
        }

        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    /**
     * Build the secret name for Secrets Manager
     * 
     * Format: qshelter/{stage}/api-keys/{keyId}
     */
    private buildSecretName(keyId: string): string {
        return `qshelter/${this.stage}/api-keys/${keyId}`;
    }
}

export const apiKeyService = new ApiKeyService();

import { Router, Request } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { apiKeyService } from '../services/api-key.service';
import {
    createApiKeySchema,
    exchangeTokenSchema,
    setEnabledSchema,
} from '../validators/api-key.validator';

export const apiKeyRouter = Router();

/**
 * Get the authenticated user's info from request context
 * 
 * In production, this comes from the Lambda authorizer context.
 * The authorizer validates the JWT and injects user info into the request.
 */
function getAuthContext(req: Request): { userId: string; tenantId: string } {
    // The authorizer injects this into requestContext (via Lambda)
    // or we can read from a custom header for testing
    const context = (req as any).requestContext?.authorizer || {};

    const userId = context.userId || context.sub;
    const tenantId = context.tenantId;

    if (!userId || !tenantId) {
        throw new Error('Authentication required');
    }

    return { userId, tenantId };
}

/**
 * POST /api-keys
 * 
 * Create a new API key for the authenticated tenant.
 * 
 * Requires: Admin authentication
 * Returns: The API key with its secret (shown only once)
 * 
 * Example request:
 * ```json
 * {
 *   "name": "CRM Integration",
 *   "description": "Used by Salesforce to sync property data",
 *   "provider": "salesforce",
 *   "scopes": ["property:read", "mortgage:read"],
 *   "expiresAt": "2025-12-31T23:59:59.000Z"
 * }
 * ```
 * 
 * Example response:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
 *     "credential": "f47ac10b-58cc-4372-a567-0e02b2c3d479.abc123...",
 *     "name": "CRM Integration",
 *     "scopes": ["property:read", "mortgage:read"],
 *     "expiresAt": "2025-12-31T23:59:59.000Z",
 *     "createdAt": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 * ```
 */
apiKeyRouter.post('/', async (req, res, next) => {
    try {
        const { userId, tenantId } = getAuthContext(req);
        const input = createApiKeySchema.parse(req.body);

        const result = await apiKeyService.create(tenantId, input, userId);

        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api-keys
 * 
 * List all API keys for the authenticated tenant.
 * 
 * Query params:
 * - includeRevoked: "true" to include revoked keys
 * 
 * Returns: Array of API key metadata (no secrets)
 */
apiKeyRouter.get('/', async (req, res, next) => {
    try {
        const { tenantId } = getAuthContext(req);
        const includeRevoked = req.query.includeRevoked === 'true';

        const result = await apiKeyService.list(tenantId, includeRevoked);

        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api-keys/:id
 * 
 * Get a single API key by ID.
 * 
 * Returns: API key metadata (no secret)
 */
apiKeyRouter.get('/:id', async (req, res, next) => {
    try {
        const { tenantId } = getAuthContext(req);
        const { id } = req.params;

        const result = await apiKeyService.getById(tenantId, id);

        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api-keys/:id/enabled
 * 
 * Enable or disable an API key.
 * 
 * Disabled keys cannot be used to exchange for tokens, but the secret
 * is preserved. Use this for temporary suspension.
 */
apiKeyRouter.patch('/:id/enabled', async (req, res, next) => {
    try {
        const { tenantId } = getAuthContext(req);
        const { id } = req.params;
        const { enabled } = setEnabledSchema.parse(req.body);

        await apiKeyService.setEnabled(tenantId, id, enabled);

        res.json(successResponse({ message: `API key ${enabled ? 'enabled' : 'disabled'}` }));
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api-keys/:id
 * 
 * Revoke an API key.
 * 
 * This permanently revokes the key and deletes its secret from Secrets Manager.
 * Revoked keys cannot be used and cannot be re-enabled.
 */
apiKeyRouter.delete('/:id', async (req, res, next) => {
    try {
        const { userId, tenantId } = getAuthContext(req);
        const { id } = req.params;

        await apiKeyService.revoke(tenantId, id, userId);

        res.json(successResponse({ message: 'API key revoked' }));
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api-keys/token
 * 
 * Exchange an API key credential for a short-lived JWT token.
 * 
 * This is the PUBLIC endpoint that partners use to authenticate.
 * No prior authentication is required - the credential IS the authentication.
 * 
 * Example request:
 * ```json
 * {
 *   "credential": "f47ac10b-58cc-4372-a567-0e02b2c3d479.abc123def456..."
 * }
 * ```
 * 
 * Example response:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *     "tokenType": "Bearer",
 *     "expiresIn": 900
 *   }
 * }
 * ```
 * 
 * The partner then uses this token in the Authorization header:
 * `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
 */
apiKeyRouter.post('/token', async (req, res, next) => {
    try {
        const { credential } = exchangeTokenSchema.parse(req.body);

        const result = await apiKeyService.exchangeToken(credential);

        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

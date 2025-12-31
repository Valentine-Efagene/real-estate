const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

// Simple in-memory cache for idempotency keys
// In production, this would use Redis or a database table
const cache = new Map<string, { response: any; createdAt: Date }>();

/**
 * Check if a request with this idempotency key has already been processed.
 * Returns the cached response if found, null otherwise.
 */
export async function checkIdempotency(idempotencyKey: string): Promise<any | null> {
    const cached = cache.get(idempotencyKey);

    if (cached) {
        // Check if expired
        const expiresAt = new Date(cached.createdAt.getTime() + IDEMPOTENCY_TTL_SECONDS * 1000);
        if (new Date() > expiresAt) {
            // Key has expired, delete it and return null
            cache.delete(idempotencyKey);
            return null;
        }

        return cached.response;
    }

    return null;
}

/**
 * Store the response for an idempotency key.
 */
export async function setIdempotencyResponse(idempotencyKey: string, response: any): Promise<void> {
    cache.set(idempotencyKey, {
        response,
        createdAt: new Date(),
    });
}

/**
 * Clear all idempotency keys (useful for testing).
 */
export function clearIdempotencyCache(): void {
    cache.clear();
}

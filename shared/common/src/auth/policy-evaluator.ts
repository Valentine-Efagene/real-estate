/**
 * Policy evaluation utilities for scope-based authorization
 * 
 * Scopes follow a resource:action pattern with wildcard support:
 * - "contract:read" - specific action on specific resource
 * - "contract:*" - all actions on contracts
 * - "*" - superuser access
 * 
 * @example
 * ```typescript
 * import { hasScope, requireScope } from '@valentine-efagene/qshelter-common';
 * 
 * const scopes = ['contract:read', 'payment:*'];
 * 
 * hasScope(scopes, 'contract:read');  // true
 * hasScope(scopes, 'payment:create'); // true (wildcard match)
 * hasScope(scopes, 'user:read');      // false
 * 
 * requireScope(scopes, 'contract:read'); // passes
 * requireScope(scopes, 'user:read');     // throws 403 error
 * ```
 */

import { AppError } from '../utils/errors';

/**
 * Check if scopes array contains the required scope
 * Supports wildcards: "resource:*" matches "resource:action"
 * 
 * @param scopes - Array of scopes the principal has
 * @param required - The scope required for the operation
 * @returns true if the required scope is present (exact or wildcard match)
 */
export function hasScope(scopes: string[], required: string): boolean {
    if (!scopes || scopes.length === 0) {
        return false;
    }

    return scopes.some((s) => {
        // Superuser wildcard
        if (s === '*') return true;

        // Exact match
        if (s === required) return true;

        // Wildcard match: "contract:*" matches "contract:read"
        if (s.endsWith(':*')) {
            const prefix = s.slice(0, -1); // "contract:"
            return required.startsWith(prefix);
        }

        return false;
    });
}

/**
 * Throws a 403 Forbidden error if the required scope is missing
 * 
 * @param scopes - Array of scopes the principal has
 * @param required - The scope required for the operation
 * @throws AppError with status 403 if scope is missing
 */
export function requireScope(scopes: string[], required: string): void {
    if (!hasScope(scopes, required)) {
        throw new AppError(403, `Forbidden: missing required scope '${required}'`);
    }
}

/**
 * Check if ALL required scopes are present (AND logic)
 * 
 * @param scopes - Array of scopes the principal has
 * @param required - Array of scopes required (all must be present)
 * @returns true if all required scopes are present
 */
export function hasAllScopes(scopes: string[], required: string[]): boolean {
    return required.every((r) => hasScope(scopes, r));
}

/**
 * Check if ANY required scope is present (OR logic)
 * 
 * @param scopes - Array of scopes the principal has
 * @param required - Array of scopes (any one must be present)
 * @returns true if at least one required scope is present
 */
export function hasAnyScope(scopes: string[], required: string[]): boolean {
    return required.some((r) => hasScope(scopes, r));
}

/**
 * Throws a 403 Forbidden error if none of the required scopes are present
 * 
 * @param scopes - Array of scopes the principal has
 * @param required - Array of scopes (any one must be present)
 * @throws AppError with status 403 if no required scope is present
 */
export function requireAnyScope(scopes: string[], required: string[]): void {
    if (!hasAnyScope(scopes, required)) {
        throw new AppError(
            403,
            `Forbidden: requires at least one of scopes: ${required.join(', ')}`
        );
    }
}

/**
 * Throws a 403 Forbidden error if not all required scopes are present
 * 
 * @param scopes - Array of scopes the principal has
 * @param required - Array of scopes (all must be present)
 * @throws AppError with status 403 if any required scope is missing
 */
export function requireAllScopes(scopes: string[], required: string[]): void {
    if (!hasAllScopes(scopes, required)) {
        const missing = required.filter((r) => !hasScope(scopes, r));
        throw new AppError(
            403,
            `Forbidden: missing required scopes: ${missing.join(', ')}`
        );
    }
}

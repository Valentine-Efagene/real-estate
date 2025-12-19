import * as jwt from 'jsonwebtoken';
import { JwtPayload } from './types';

export class JwtService {
    private secret: string;

    constructor() {
        this.secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    }

    /**
     * Verifies and decodes a JWT token
     */
    verify(token: string): JwtPayload {
        try {
            // Remove 'Bearer ' prefix if present
            const cleanToken = token.replace(/^Bearer\s+/i, '');

            const decoded = jwt.verify(cleanToken, this.secret) as JwtPayload;

            if (!decoded.sub || !decoded.roles || !Array.isArray(decoded.roles)) {
                throw new Error('Invalid token payload: missing required fields');
            }

            return decoded;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new Error('Token has expired');
            } else if (error instanceof jwt.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            throw error;
        }
    }

    /**
     * Extracts token from Authorization header
     */
    extractToken(authorizationHeader: string | undefined): string {
        if (!authorizationHeader) {
            throw new Error('No authorization header provided');
        }

        // Handle both "Bearer token" and just "token" formats
        const parts = authorizationHeader.split(' ');

        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            return parts[1];
        }

        if (parts.length === 1) {
            return parts[0];
        }

        throw new Error('Invalid authorization header format');
    }
}

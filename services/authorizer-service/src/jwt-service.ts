import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@valentine-efagene/qshelter-common';
import { JwtPayload } from './types';

export class JwtService {
    private secret: string | null = null;
    private secretPromise: Promise<string> | null = null;
    private static instance: JwtService | null = null;

    private constructor() {}

    /**
     * Get singleton instance of JwtService
     */
    static getInstance(): JwtService {
        if (!JwtService.instance) {
            JwtService.instance = new JwtService();
        }
        return JwtService.instance;
    }

    /**
     * Initialize the JWT secret from ConfigService (Secrets Manager)
     * This must be called before using verify()
     */
    private async getSecret(): Promise<string> {
        if (this.secret) {
            return this.secret;
        }

        // Prevent multiple concurrent fetches
        if (this.secretPromise) {
            return this.secretPromise;
        }

        this.secretPromise = (async () => {
            const configService = ConfigService.getInstance();
            const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';
            const secretResult = await configService.getJwtAccessSecret(stage);
            this.secret = secretResult.secret;
            return this.secret;
        })();

        return this.secretPromise;
    }

    /**
     * Verifies and decodes a JWT token
     */
    async verify(token: string): Promise<JwtPayload> {
        const secret = await this.getSecret();
        try {
            // Remove 'Bearer ' prefix if present
            const cleanToken = token.replace(/^Bearer\s+/i, '');

            const decoded = jwt.verify(cleanToken, secret) as JwtPayload;

            if (!decoded.sub) {
                throw new Error('Invalid token payload: missing sub');
            }

            // Defaults for backward compatibility
            if (!decoded.roles || !Array.isArray(decoded.roles)) {
                decoded.roles = [];
            }
            if (!decoded.tenantId) {
                decoded.tenantId = '';
            }
            if (!decoded.principalType) {
                decoded.principalType = 'user';
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

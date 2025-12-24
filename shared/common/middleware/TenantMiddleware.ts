import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include tenantId
declare global {
    namespace Express {
        interface Request {
            tenantId?: number;
        }
    }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    async use(req: Request, _res: Response, next: NextFunction) {
        // Prefer explicit header `x-tenant-id`
        const tenantIdHeader = (req.headers['x-tenant-id'] as string) || (req.headers['X-Tenant-Id'] as string);
        if (tenantIdHeader) {
            const id = parseInt(tenantIdHeader, 10);
            if (!isNaN(id)) {
                req.tenantId = id;
                return next();
            }
        }

        // Fall back to subdomain extraction (subdomain.domain.tld)
        const host = (req.hostname || req.headers.host || '').toString();
        const subdomain = this.extractSubdomain(host);
        if (subdomain) {
            // If subdomain is numeric, treat as tenantId; otherwise leave undefined
            const id = parseInt(subdomain, 10);
            if (!isNaN(id)) {
                req.tenantId = id;
            }
        }

        next();
    }

    private extractSubdomain(host: string): string | null {
        if (!host) return null;
        const hostname = host.split(':')[0];
        const parts = hostname.split('.');
        if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
            return null;
        }
        if (parts.length >= 3) return parts[0];
        return null;
    }
}

export default TenantMiddleware;

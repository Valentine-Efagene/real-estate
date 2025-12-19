import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../../tenant/tenant.service';
import { Tenant } from '../../tenant/tenant.entity';

// Extend Express Request to include tenant
declare global {
    namespace Express {
        interface Request {
            tenant?: Tenant;
            tenantId?: number;
        }
    }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(private readonly tenantService: TenantService) { }

    async use(req: Request, res: Response, next: NextFunction) {
        let tenant: Tenant | null = null;

        // Strategy 1: Extract tenant from subdomain
        const host = req.hostname || req.headers.host || '';
        const subdomain = this.extractSubdomain(host);

        if (subdomain) {
            tenant = await this.tenantService.findBySubdomain(subdomain);
        }

        // Strategy 2: Extract tenant from custom domain
        if (!tenant && host) {
            tenant = await this.tenantService.findByDomain(host);
        }

        // Strategy 3: Extract tenant from X-Tenant-ID header
        if (!tenant) {
            const tenantIdHeader = req.headers['x-tenant-id'] as string;
            if (tenantIdHeader) {
                const tenantId = parseInt(tenantIdHeader, 10);
                if (!isNaN(tenantId)) {
                    tenant = await this.tenantService.findOne(tenantId);
                }
            }
        }

        // Strategy 4: Extract tenant from X-Tenant-Subdomain header
        if (!tenant) {
            const tenantSubdomainHeader = req.headers['x-tenant-subdomain'] as string;
            if (tenantSubdomainHeader) {
                tenant = await this.tenantService.findBySubdomain(tenantSubdomainHeader);
            }
        }

        if (tenant) {
            // Check if tenant is active
            const isActive = await this.tenantService.isActive(tenant.id);
            if (!isActive) {
                return res.status(403).json({
                    statusCode: 403,
                    message: 'Tenant is suspended or inactive',
                    error: 'Forbidden'
                });
            }

            req.tenant = tenant;
            req.tenantId = tenant.id;
        }

        // For routes that require a tenant, you can check here or use a guard
        // If tenant is required for all routes, uncomment below:
        // if (!tenant) {
        //     return res.status(400).json({
        //         statusCode: 400,
        //         message: 'Tenant not found. Please provide tenant information.',
        //         error: 'Bad Request'
        //     });
        // }

        next();
    }

    private extractSubdomain(host: string): string | null {
        // Remove port if present
        const hostname = host.split(':')[0];

        // Split by dots
        const parts = hostname.split('.');

        // If localhost or IP, no subdomain
        if (hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
            return null;
        }

        // If we have at least 3 parts (subdomain.domain.com), extract subdomain
        // Assuming format: subdomain.yourdomain.com
        if (parts.length >= 3) {
            // Get the first part as subdomain (before the main domain)
            return parts[0];
        }

        return null;
    }
}

export default TenantMiddleware;

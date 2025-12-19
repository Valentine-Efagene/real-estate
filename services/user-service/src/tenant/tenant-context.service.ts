import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

/**
 * Request-scoped service that provides access to the current tenant context
 * Inject this service to access tenant information in your services
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
    constructor(
        @Inject(REQUEST) private readonly request: Request
    ) { }

    /**
     * Get the current tenant ID from the request
     */
    getTenantId(): number | undefined {
        return this.request.tenantId;
    }

    /**
     * Get the current tenant object from the request
     */
    getTenant() {
        return this.request.tenant;
    }

    /**
     * Check if a tenant context exists in the request
     */
    hasTenant(): boolean {
        return !!this.request.tenantId;
    }

    /**
     * Get tenant ID or throw error if not present
     */
    requireTenantId(): number {
        const tenantId = this.getTenantId();
        if (!tenantId) {
            throw new Error('Tenant context is required but not found');
        }
        return tenantId;
    }
}

export default TenantContextService;

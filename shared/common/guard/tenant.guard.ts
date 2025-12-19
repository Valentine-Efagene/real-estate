import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Guard that ensures a tenant context is present in the request
 * Use this on routes that require tenant isolation
 */
@Injectable()
export class TenantGuard implements CanActivate {
    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();

        if (!request.tenant || !request.tenantId) {
            throw new ForbiddenException('Tenant context is required for this operation');
        }

        return true;
    }
}

export default TenantGuard;

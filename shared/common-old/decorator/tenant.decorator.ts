import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Tenant } from '../entities/tenant.entity';

export const CurrentTenant = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): Tenant | undefined => {
        const request = ctx.switchToHttp().getRequest();
        return request.tenant;
    },
);

export const CurrentTenantId = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): number | undefined => {
        const request = ctx.switchToHttp().getRequest();
        return request.tenantId;
    },
);


import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../permission/permissions.decorator';
import { User } from '../../user/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    matchPermissions(user: User, requiredPermissions: string[]): boolean {
        if (!user || !user.roles || !Array.isArray(user.roles)) {
            return false;
        }

        const roles = user.roles || [];
        const userPermissions = roles.reduce((acc, role) => {
            return acc.concat(role.permissions || []);
        }, []);

        if (!userPermissions) {
            return false;
        }

        return requiredPermissions.every(permission =>
            userPermissions.includes(permission)
        )
    }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions = this.reflector.getAllAndOverride<PermissionName[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiredPermissions) {
            return true;
        }
        const { user } = context.switchToHttp().getRequest();
        const hasPermission = this.matchPermissions(user, requiredPermissions)

        return hasPermission;
    }
}

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequirePermission } from '../decorator/permission.decorator';
import { Observable } from 'rxjs';
import { User } from '../../user/user.entity';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const permission = this.reflector.get(RequirePermission, context.getHandler());

    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user: User = request.user;

    if (!user) {
      return false
    }

    return this.matchPermission(permission, user);
  }

  matchPermission(permission: string, user: User) {
    const roles = user.roles

    if (!roles || roles.length < 1) {
      return false
    }

    const permissions = roles.map(role => role.permissions).reduce((acc, curr) => [...acc, ...curr]) ?? []
    const permissionNames = permissions?.map(permission => permission.name)
    return permissionNames.includes(permission)
  }
}

import { Reflector } from '@nestjs/core';
import { PermissionName } from '../../permission/permission.enums';

export const RequirePermission = Reflector.createDecorator<PermissionName>();

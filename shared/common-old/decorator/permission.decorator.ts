import { Reflector } from '@nestjs/core';
import { PermissionName } from '../types/permission.type';

export const RequirePermission = Reflector.createDecorator<PermissionName>();

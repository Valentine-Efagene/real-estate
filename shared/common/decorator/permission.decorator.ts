import { Reflector } from '@nestjs/core';
import { PermissionName } from '../types/permission.enums';

export const RequirePermission = Reflector.createDecorator<PermissionName>();

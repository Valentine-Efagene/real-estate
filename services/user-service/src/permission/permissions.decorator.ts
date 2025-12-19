
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'roles';
export const Permissions = (...permissions: PermissionName[]) => SetMetadata(PERMISSIONS_KEY, permissions);

import { UserRole } from '../../user/user.enums';
import RoleCheckerMiddleware from './RoleCheckerMiddleware';

export default class DeveloperRoleCheckerMiddleware extends RoleCheckerMiddleware {
  protected allowedRoles: UserRole[] = [UserRole.VENDOR, UserRole.ADMIN];
}

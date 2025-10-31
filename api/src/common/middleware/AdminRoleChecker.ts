import { UserRole } from '../../user/user.enums';
import RoleCheckerMiddleware from './RoleCheckerMiddleware';

export default class AdminRoleCheckerMiddleware extends RoleCheckerMiddleware {
  protected allowedRoles: UserRole[] = [UserRole.ADMIN];
}

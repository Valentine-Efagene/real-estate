import {
  BadRequestException,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../user/user.enums';
import { UserService } from '../../user/user.service';

@Injectable()
export default class RoleCheckerMiddleware implements NestMiddleware {
  constructor(private readonly userService: UserService) { }

  protected allowedRoles: UserRole[];

  async use(req: Request, res: Response, next: NextFunction) {
    const userId = req.headers['user_id'];

    if (!userId) {
      throw new BadRequestException('Invalid user ID');
    }

    try {
      const user = await this.userService.findOne(Number(userId));

      // if (!user.roles.some((value) => this.allowedRoles.includes(value))) {
      //   throw new UnauthorizedException();
      // }

      next();
    } catch (error) {
      throw new UnauthorizedException();
    }
  }
}

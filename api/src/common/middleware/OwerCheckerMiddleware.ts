import { UserRole } from '../../user/user.enums';
import {
  BadRequestException,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { NextFunction } from 'express';

export default class OwerCheckerMiddleware implements NestMiddleware {
  constructor(private readonly userService: UserService) { }

  protected allowedRoles: UserRole[];

  async use(req: Request, res: Response, next: NextFunction) {
    console.log('first')
    const userId = req.headers['user_id'];

    if (!userId) {
      throw new BadRequestException('Invalid user ID');
    }

    const user = await this.userService.findOne(1);

    if (!user.id === userId) {
      throw new UnauthorizedException();
    }

    next();
  }
}

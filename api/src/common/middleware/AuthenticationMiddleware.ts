import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from '../../auth/auth.constants';
import { IAccessTokenPayload } from '../../auth/auth.type';
import { UserService } from '../../user/user.service';
import { UserStatus } from '../../user/user.enums';

@Injectable()
export default class AuthenticationMiddleware implements NestMiddleware {
  private logger = new Logger(AuthenticationMiddleware.name);

  constructor(
    private jwtService: JwtService,
    private userService: UserService
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {
    const request = req;
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: IAccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync(
        token,
        {
          secret: jwtConstants.secret
        }
      );
    } catch (error) {
      throw new UnauthorizedException();
    }

    if (payload) {
      // 💡 We're assigning the payload to the request object here
      // so that we can access it in our route handlers
      const user = await this.userService.findOne(payload.sub)

      if (user.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('This account is suspended')
      }

      request['user'] = user;
    } else {
      request['user'] = null;
    }

    next()
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authorizationHeader = request.headers.authorization;
    const [type, token] = authorizationHeader?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

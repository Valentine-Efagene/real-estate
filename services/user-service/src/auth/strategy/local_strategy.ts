
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { User } from '@valentine-efagene/qshelter-common';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super();
    }

    async validate(identifier: string, password: string): Promise<Omit<User, 'password'>> {
        const user = await this.authService.validateUser(identifier, password);

        if (!user) {
            throw new UnauthorizedException();
        }

        return user;
    }
}

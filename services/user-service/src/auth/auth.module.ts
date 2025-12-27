
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from './auth.constants';
import { LocalStrategy } from './strategy/local_strategy';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { RefreshTokenModule } from '../refresh_token/refresh_token.module';
import { JwtStrategy } from './strategy/jwt_strategy';
import { GoogleStrategy } from './strategy/google.strategy';
import { PasswordResetTokenModule } from '../password_reset_tokens/password_reset_tokens.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, PasswordResetToken, Role } from '@valentine-efagene/qshelter-common';

@Module({
    imports: [
        UserModule,
        PassportModule,
        JwtModule.register({
            secret: getJwtSecret(),
            signOptions: { expiresIn: '100m' },
        }),
        RefreshTokenModule,
        PasswordResetTokenModule,
        TypeOrmModule.forFeature([User, PasswordResetToken, Role])
    ],
    controllers: [AuthController],
    providers: [AuthService, LocalStrategy, JwtStrategy, GoogleStrategy],
    exports: [AuthService],
})
export class AuthModule { }

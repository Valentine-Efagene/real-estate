import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

const envModule = ConfigModule.forRoot({
    validationSchema: Joi.object({
        NODE_ENV: Joi.string()
            .valid('development', 'production', 'test', 'provision')
            .default('development'),
        PORT: Joi.number().port().default(3001),

        // DB
        DB_HOST: Joi.string(),
        DB_NAME: Joi.string(),
        DB_PORT: Joi.number().port().default(3306),
        DB_USERNAME: Joi.string(),

        // AUTH
        JWT_SECRET: Joi.string(),
        REFRESH_TOKEN_SECRET: Joi.string(),

        ENCRYPTION_PASSWORD: Joi.string().required(),
        ENCRYPTION_SALT: Joi.string().required(),
    }),
    envFilePath: '.env',
    isGlobal: true
});

import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Import shared modules from ../../shared
import { DatabaseModule } from '../../shared/database/database.module';
import { TenantMiddleware } from '../../shared/common/middleware/TenantMiddleware';
import { PermissionGuard } from '../../shared/common/guard/permission.guard';
import AuthenticationMiddleware from '../../shared/common/middleware/AuthenticationMiddleware';
import { AccessLoggerMiddleware } from '../../shared/common/middleware/AccessLoggerMiddleware';

// Service-specific modules
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { TenantModule } from './tenant/tenant.module';
import { RefreshTokenModule } from './refresh_token/refresh_token.module';
import { PasswordResetTokenModule } from './password_reset_tokens/password_reset_tokens.module';
import { UserSuspensionModule } from './user_suspensions/user_suspensions.module';
import { SettingsModule } from './settings/settings.module';
import { MailModule } from './mail/mail.module';
import { EncryptionModule } from './encryption/encryption.module';
import { CaslModule } from './casl/casl.module';
import { jwtConstants } from './auth/auth.constants';

@Module({
    imports: [
        envModule,
        DatabaseModule,
        JwtModule.register({
            secret: jwtConstants.secret,
            signOptions: { expiresIn: '60s' },
            global: true
        }),
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 10,
        }]),
        MailModule,
        TenantModule,
        AuthModule,
        UserModule,
        RoleModule,
        PermissionModule,
        RefreshTokenModule,
        PasswordResetTokenModule,
        UserSuspensionModule,
        SettingsModule,
        EncryptionModule,
        CaslModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: PermissionGuard },
    ],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        const excludedPaths = [
            { path: 'auth/sign-up', method: RequestMethod.POST },
            { path: 'auth/request-password-reset', method: RequestMethod.POST },
            { path: 'auth/reset-password', method: RequestMethod.POST },
            { path: 'auth/sign-in/google-token', method: RequestMethod.POST },
            { path: 'auth/sign-in', method: RequestMethod.POST },
            { path: 'auth/google', method: RequestMethod.GET },
            { path: 'auth/google/callback', method: RequestMethod.GET },
            { path: 'auth/verify-email', method: RequestMethod.GET },
        ];

        // Apply TenantMiddleware globally
        consumer.apply(TenantMiddleware).forRoutes('*');

        consumer.apply(AuthenticationMiddleware).exclude(...excludedPaths).forRoutes('*');

        consumer.apply(AccessLoggerMiddleware).exclude(...excludedPaths).forRoutes('*');
    }
}

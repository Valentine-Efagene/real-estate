import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';

const envModule = ConfigModule.forRoot({
    validationSchema: Joi.object({
        NODE_ENV: Joi.string()
            .valid('development', 'production', 'test', 'provision', 'dev', 'prod')
            .default('development'),
        PORT: Joi.number().port().optional(),
    }),
    envFilePath: '.env',
    isGlobal: true,
    ignoreEnvFile: true, // Ignore .env file in Lambda, use SSM/Secrets Manager
});

import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Import shared modules
import { TypeOrmModule } from '@nestjs/typeorm';
import { options } from './data-source';
import { TenantMiddleware, AccessLoggerMiddleware } from '@valentine-efagene/qshelter-common';

// Service-specific modules
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { TenantModule } from './tenant/tenant.module';
import { RefreshTokenModule } from './refresh_token/refresh_token.module';
import { PasswordResetTokenModule } from './password_reset_tokens/password_reset_tokens.module';
import { UserSuspensionModule } from './user_suspensions/user_suspensions.module';
import { EncryptionModule } from '@valentine-efagene/qshelter-common';
import { jwtConstants } from './auth/auth.constants';

@Module({
    imports: [
        envModule,
        TypeOrmModule.forRoot(options),
        JwtModule.register({
            secret: jwtConstants.secret,
            signOptions: { expiresIn: '60s' },
            global: true
        }),
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 10,
        }]),
        TenantModule,
        AuthModule,
        UserModule,
        RoleModule,
        PermissionModule,
        RefreshTokenModule,
        PasswordResetTokenModule,
        UserSuspensionModule,
        EncryptionModule,
    ],
    providers: [
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

        // Use API Gateway authorizer for authentication; skip local AuthenticationMiddleware

        // Apply access logger middleware
        consumer.apply().exclude(...excludedPaths).forRoutes('*');
    }
}

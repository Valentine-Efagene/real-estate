import { ConfigService } from '@valentine-efagene/qshelter-common';
import { initializeSecrets, getJwtSecret } from './auth/auth.constants';

// Initialize secrets from SSM/Secrets Manager before app starts
// This is called in main.ts before bootstrapping
export { initializeSecrets };

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

@Module({
    imports: [
        TypeOrmModule.forRoot(options),
        JwtModule.register({
            secret: getJwtSecret(),
            signOptions: { expiresIn: '100m' },
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

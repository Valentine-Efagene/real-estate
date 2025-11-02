import { ConfigModule } from '@nestjs/config';

// https://stackoverflow.com/a/71045457/6132438
// Moved here to fix a bug (env not being loaded early enough)
import * as Joi from 'joi';

const envModule = ConfigModule.forRoot({
  validationSchema: Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'production', 'test', 'provision')
      .default('development'),
    // APP
    PORT: Joi.number().port().default(3000),

    // DB
    DB_HOST: Joi.string(),
    DB_NAME: Joi.string(),
    DB_PORT: Joi.number().port().default(3306),
    DB_USERNAME: Joi.string(),
    // DB_PASSWORD: ,

    // AUTH
    JWT_SECRET: Joi.string(),
    REFRESH_TOKEN_SECRET: Joi.string(),

    ENCRYPTION_PASSWORD: Joi.string().required(),
    ENCRYPTION_SALT: Joi.string().required(),

    // S3
    AWS_S3_BUCKET_NAME: Joi.string(),
    AWS_S3_ACCESS_KEY_ID: Joi.string(),
    AWS_S3_SECRET_ACCESS_KEY: Joi.string(),
    AWS_S3_REGION: Joi.string(),

    // QUEUE
    REDIS_PORT: Joi.number().port().default(6379),
    REDIS_HOST: Joi.string(),
  }),
  envFilePath: '.env',
  isGlobal: true
})

import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { AuthModule } from './auth/auth.module';
import { RefreshTokenModule } from './refresh_token/refresh_token.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './auth/auth.constants';
import { APP_GUARD } from '@nestjs/core';
import { PermissionGuard } from './common/guard/permission.guard';
import { UserSuspensionModule } from './user_suspensions/user_suspensions.module';
import { PasswordResetTokenModule } from './password_reset_tokens/password_reset_tokens.module';
import { MailModule } from './mail/mail.module';
import { ThrottlerModule } from '@nestjs/throttler';
import AuthenticationMiddleware from './common/middleware/AuthenticationMiddleware';
import { options } from './data-source';
import { SettingsModule } from './settings/settings.module';
import { PropertyModule } from './property/property.module';
import { PropertyMediaModule } from './property-media/property-media.module';
import { MortgageModule } from './mortgage/mortgage.module';
import { MortgageDocumentModule } from './mortgage-document/mortgage-document.module';
import { MortgageStepModule } from './mortgage-step/mortgage-step.module';
import { MortgageTypeModule } from './mortgage-type/mortgage-type.module';
import { EncryptionModule } from './encryption/encryption.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BulkInviteModule } from './bulk-invite/bulk-invite.module';
import { BullModule } from '@nestjs/bullmq';
import { AccessLoggerMiddleware } from './common/middleware/AccessLoggerMiddleware';
import { QrCodeModule } from './qr-code/qr-code.module';
import { PropertyDocumentModule } from './property-document/property-document.module';
import { CaslModule } from './casl/casl.module';

@Module({
  imports: [
    envModule,
    TypeOrmModule.forRoot(options as TypeOrmModuleOptions),
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '60s' },
      global: true
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
      },
    }),
    MailModule,
    UserModule,
    AuthModule,
    UserModule,
    RoleModule,
    PermissionModule,
    RefreshTokenModule,
    UserSuspensionModule,
    PasswordResetTokenModule,
    SettingsModule,
    PropertyModule,
    PropertyDocumentModule,
    PropertyMediaModule,
    MortgageModule,
    MortgageDocumentModule,
    MortgageStepModule,
    MortgageTypeModule,
    EncryptionModule,
    QrCodeModule,
    BulkInviteModule,
    ScheduleModule.forRoot(),
    CaslModule
  ],
  controllers: [AppController],
  providers: [AppService,
    { provide: APP_GUARD, useClass: PermissionGuard },],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // Exclude public endpoints from authentication middleware
    const excludedPaths = [
      { path: 'qr/(.*)', method: RequestMethod.GET },
      { path: 'auth/sign-up', method: RequestMethod.POST },
      { path: 'auth/request-password-reset', method: RequestMethod.POST },
      { path: 'auth/reset-password', method: RequestMethod.POST },
      { path: 'event-ticket-types/(.*)', method: RequestMethod.GET },
      { path: 'bulk-invite/test', method: RequestMethod.POST },
      { path: 'events/public/(.*)', method: RequestMethod.GET },
      { path: 'event-media/(.*)', method: RequestMethod.GET },
      { path: 'orders/paystack/webhook', method: RequestMethod.POST },
      { path: 'auth/sign-in/google-token', method: RequestMethod.POST },
      { path: 'auth/sign-in', method: RequestMethod.POST },
      { path: 'events/public', method: RequestMethod.GET },
      { path: 'auth/google', method: RequestMethod.GET },
      { path: 'auth/google/callback', method: RequestMethod.GET },
      { path: 'auth/verify-email', method: RequestMethod.GET },
      { path: 'mailer/(.*)', method: RequestMethod.POST },
    ];

    consumer.apply(AuthenticationMiddleware).exclude(...excludedPaths).forRoutes('*');

    consumer
      .apply(AccessLoggerMiddleware)
      .exclude(...excludedPaths)
      .forRoutes('*');
  }
}

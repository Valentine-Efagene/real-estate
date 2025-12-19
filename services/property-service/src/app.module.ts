import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

const envModule = ConfigModule.forRoot({
    validationSchema: Joi.object({
        NODE_ENV: Joi.string()
            .valid('development', 'production', 'test', 'provision')
            .default('development'),
        PORT: Joi.number().port().default(3003),

        DB_HOST: Joi.string(),
        DB_NAME: Joi.string(),
        DB_PORT: Joi.number().port().default(3306),
        DB_USERNAME: Joi.string(),

        JWT_SECRET: Joi.string(),

        // S3
        AWS_S3_BUCKET_NAME: Joi.string(),
        AWS_S3_ACCESS_KEY_ID: Joi.string(),
        AWS_S3_SECRET_ACCESS_KEY: Joi.string(),
        AWS_S3_REGION: Joi.string(),
    }),
    envFilePath: '.env',
    isGlobal: true
});

import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Import shared modules
import { DatabaseModule } from '../../shared/database/database.module';
import { TenantMiddleware } from '../../shared/common/middleware/TenantMiddleware';
import { PermissionGuard } from '../../shared/common/guard/permission.guard';
import AuthenticationMiddleware from '../../shared/common/middleware/AuthenticationMiddleware';

// Service-specific modules
import { PropertyModule } from './property/property.module';
import { PropertyMediaModule } from './property-media/property-media.module';
import { PropertyDocumentModule } from './property-document/property-document.module';
import { AmenityModule } from './amenity/amenity.module';
import { QrCodeModule } from './qr-code/qr-code.module';
import { S3UploaderModule } from './s3-uploader/s3-uploader.module';
import { jwtConstants } from '../../shared/common/common.type';

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
        PropertyModule,
        PropertyMediaModule,
        PropertyDocumentModule,
        AmenityModule,
        QrCodeModule,
        S3UploaderModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: PermissionGuard },
    ],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(TenantMiddleware).forRoutes('*');
        consumer.apply(AuthenticationMiddleware).forRoutes('*');
    }
}

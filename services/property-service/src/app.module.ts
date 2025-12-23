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
        DB_PASSWORD: Joi.string(),

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
import { DatabaseModule } from '@real-estate/shared-database';
import { TenantMiddleware } from '@real-estate/shared-common/middleware/TenantMiddleware';
import { PermissionGuard } from '@real-estate/shared-common/guard/permission.guard';
import AuthenticationMiddleware from '@real-estate/shared-common/middleware/AuthenticationMiddleware';

// Service-specific modules
import { PropertyModule } from './property/property.module';
import { PropertyMediaModule } from './property-media/property-media.module';
import { PropertyDocumentModule } from './property-document/property-document.module';
import { AmenityModule } from './amenity/amenity.module';
import { QrCodeModule } from './qr-code/qr-code.module';
import { S3UploaderModule } from './s3-uploader/s3-uploader.module';

@Module({
    imports: [
        envModule,
        DatabaseModule.forRoot({
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT) || 3306,
            username: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME,
            synchronize: process.env.DB_HOST === '127.0.0.1' || process.env.DB_HOST === 'localhost',
            logging: process.env.NODE_ENV !== 'production',
            isProduction: process.env.NODE_ENV === 'production',
        }),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
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

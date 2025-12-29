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
import { TypeOrmModule } from '@nestjs/typeorm';
import { options } from './data-source';

// Service-specific modules
import { PropertyModule } from './property/property.module';
import { PropertyMediaModule } from './property-media/property-media.module';
import { PropertyDocumentModule } from './property-document/property-document.module';
import { AmenityModule } from './amenity/amenity.module';
import { QrCodeModule, AccessLoggerMiddleware, TenantMiddleware } from '@valentine-efagene/qshelter-common';

@Module({
    imports: [
        envModule,
        TypeOrmModule.forRoot(options),
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
    ],
    providers: [
    ],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(TenantMiddleware).forRoutes('*');

        // Use API Gateway authorizer for authentication; skip local AuthenticationMiddleware

        // Apply access logger middleware
        consumer.apply(AccessLoggerMiddleware).forRoutes('*');
    }
}

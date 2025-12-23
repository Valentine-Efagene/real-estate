import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

const envModule = ConfigModule.forRoot({
    validationSchema: Joi.object({
        NODE_ENV: Joi.string()
            .valid('development', 'production', 'test', 'provision')
            .default('development'),
        PORT: Joi.number().port().default(3002),

        DB_HOST: Joi.string(),
        DB_NAME: Joi.string(),
        DB_PORT: Joi.number().port().default(3306),
        DB_USERNAME: Joi.string(),
        DB_PASSWORD: Joi.string(),

        JWT_SECRET: Joi.string(),
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
import { ScheduleModule } from '@nestjs/schedule';

// Import shared modules
import { DatabaseModule } from '@real-estate/shared-database';
import { TenantMiddleware } from '@real-estate/shared-common/middleware/TenantMiddleware';
import { PermissionGuard } from '@real-estate/shared-common/guard/permission.guard';
import AuthenticationMiddleware from '@real-estate/shared-common/middleware/AuthenticationMiddleware';
import { EventBusModule } from '@real-estate/shared-event-bus';

// Service-specific modules
import { MortgageModule } from './mortgage/mortgage.module';
import { MortgageDocumentModule } from './mortgage-document/mortgage-document.module';
import { MortgageStepModule } from './mortgage-step/mortgage-step.module';
import { MortgageTypeModule } from './mortgage-type/mortgage-type.module';
import MortgageDownpaymentModule from './mortgage-downpayment/mortgage-downpayment.module';
import PaymentsModule from './payments/payments.module';
import { WalletModule } from './wallet/wallet.module';
import { TransactionModule } from './transaction/transaction.module';

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
            signOptions: { expiresIn: '100m' },
            global: true
        }),
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 10,
        }]),
        ScheduleModule.forRoot(),
        EventBusModule.forRoot({
            awsRegion: process.env.AWS_REGION || 'us-east-1',
        }),
        MortgageModule,
        MortgageDocumentModule,
        MortgageStepModule,
        MortgageTypeModule,
        MortgageDownpaymentModule,
        PaymentsModule,
        WalletModule,
        TransactionModule,
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

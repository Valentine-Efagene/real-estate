import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CustomNamingStrategy } from '../common/helpers/CustomNamingStrategy';

// Entity imports - centralized from original locations
import { Tenant } from '../tenant/tenant.entity';
import { User } from '../user/user.entity';
import { Role } from '../role/role.entity';
import { Permission } from '../permission/permission.entity';
import { RefreshToken } from '../refresh_token/refresh_token.entity';
import { Property } from '../property/property.entity';
import { UserSuspension } from '../user_suspensions/user_suspensions.entity';
import { PropertyMedia } from '../property-media/property-media.entity';
import { PropertyDocument } from '../property-document/property-document.entity';
import Mortgage from '../mortgage/mortgage.entity';
import MortgageDocument from '../mortgage/mortgage-document.entity';
import MortgageStep from '../mortgage/mortgage-step.entity';
import { MortgageDownpaymentPlan } from '../mortgage-downpayment/mortgage-downpayment.entity';
import { MortgageDownpaymentInstallment } from '../mortgage-downpayment/mortgage-downpayment-installment.entity';
import { MortgageDownpaymentPayment } from '../mortgage-downpayment/mortgage-downpayment-payment.entity';
import MortgageType from '../mortgage-type/mortgage-type.entity';
import { Amenity } from '../amenity/amenity.entity';
import { PasswordResetToken } from '../password_reset_tokens/password_reset_tokens.entity';
import { Settings } from '../settings/settings.entity';
import { BulkInviteTask } from '../bulk-invite/bulk-invite-task.entity';
import { Wallet } from '../wallet/wallet.entity';
import { Transaction } from '../transaction/transaction.entity';

/**
 * All database entities exported from one place
 * Other modules import entities from here
 */
export const DATABASE_ENTITIES = [
    Tenant,
    User,
    Role,
    Permission,
    RefreshToken,
    Property,
    UserSuspension,
    PropertyMedia,
    PropertyDocument,
    Mortgage,
    MortgageDocument,
    MortgageStep,
    MortgageDownpaymentPlan,
    MortgageDownpaymentInstallment,
    MortgageDownpaymentPayment,
    MortgageType,
    Amenity,
    PasswordResetToken,
    Settings,
    BulkInviteTask,
    Wallet,
    Transaction,
];

/**
 * Get TypeORM configuration
 * Supports both local development and Lambda/RDS environments
 */
export function getDatabaseConfig(
    configService: ConfigService,
): TypeOrmModuleOptions {
    const isProduction = configService.get('NODE_ENV') === 'production';
    const isLocal = configService.get('DB_HOST') === '127.0.0.1' ||
        configService.get('DB_HOST') === 'localhost';

    return {
        type: 'mysql',
        host: configService.get('DB_HOST', '127.0.0.1'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_NAME'),
        entities: DATABASE_ENTITIES,
        // Only auto-sync in local non-production environments
        synchronize: isLocal && !isProduction,
        // Drop schema only in test environments on local
        dropSchema: configService.get('NODE_ENV')?.includes('test') && isLocal,
        namingStrategy: new CustomNamingStrategy(),
        // Migrations path
        migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
        migrationsRun: isProduction, // Auto-run migrations in production
        logging: !isProduction,
        // Connection pool settings for Lambda
        extra: {
            connectionLimit: isProduction ? 5 : 10,
            connectTimeout: 60000,
            acquireTimeout: 60000,
            timeout: 60000,
        },
    };
}

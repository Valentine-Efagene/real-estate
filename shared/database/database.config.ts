import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '@real-estate/entities';
import { CustomNamingStrategy } from '@real-estate/entities/helpers/CustomNamingStrategy';

/**
 * All database entities exported from @real-estate/entities package
 */
export const DATABASE_ENTITIES = ALL_ENTITIES;

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

import { Module, Global, DynamicModule } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';
import { DataSource } from 'typeorm';
import { DATABASE_ENTITIES } from './database.config';
import { CustomNamingStrategy } from '../common/helpers/CustomNamingStrategy';

export interface DatabaseModuleOptions {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize?: boolean;
    dropSchema?: boolean;
    logging?: boolean;
    isProduction?: boolean;
}

/**
 * Global Database Module
 * Centralized database configuration and migration management
 * Can be imported by multiple Lambda functions
 */
@Global()
@Module({})
export class DatabaseModule {
    /**
     * Configure DatabaseModule with runtime options
     * @param options - Database connection configuration
     * @returns Configured DynamicModule
     */
    static forRoot(options: DatabaseModuleOptions): DynamicModule {
        const typeOrmOptions: TypeOrmModuleOptions = {
            type: 'mysql',
            host: options.host,
            port: options.port,
            username: options.username,
            password: options.password,
            database: options.database,
            entities: DATABASE_ENTITIES,
            synchronize: options.synchronize ?? false,
            dropSchema: options.dropSchema ?? false,
            namingStrategy: new CustomNamingStrategy(),
            logging: options.logging ?? !options.isProduction,
            // Connection pool settings for Lambda
            extra: {
                connectionLimit: options.isProduction ? 5 : 10,
                connectTimeout: 60000,
                acquireTimeout: 60000,
                timeout: 60000,
            },
        };

        return {
            module: DatabaseModule,
            imports: [
                TypeOrmModule.forRootAsync({
                    useFactory: async () => typeOrmOptions,
                    dataSourceFactory: async (opts) => {
                        const dataSource = new DataSource(opts);
                        await dataSource.initialize();
                        return dataSource;
                    },
                }),
            ],
            providers: [DatabaseService],
            exports: [DatabaseService, TypeOrmModule],
        };
    }
}

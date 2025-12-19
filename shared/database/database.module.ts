import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from './database.config';

/**
 * Global Database Module
 * Centralized database configuration and migration management
 * Can be imported by multiple Lambda functions
 */
@Global()
@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
                return getDatabaseConfig(configService);
            },
            dataSourceFactory: async (options) => {
                const dataSource = new DataSource(options);
                await dataSource.initialize();
                return dataSource;
            },
        }),
    ],
    providers: [DatabaseService],
    exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule { }

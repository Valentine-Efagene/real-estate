import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Database Service
 * Handles database operations, health checks, and migration management
 */
@Injectable()
export class DatabaseService implements OnModuleInit {
    private readonly logger = new Logger(DatabaseService.name);

    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }

    async onModuleInit() {
        await this.checkConnection();
    }

    /**
     * Check database connection health
     */
    async checkConnection(): Promise<boolean> {
        try {
            if (!this.dataSource.isInitialized) {
                await this.dataSource.initialize();
            }
            await this.dataSource.query('SELECT 1');
            this.logger.log('Database connection established successfully');
            return true;
        } catch (error) {
            this.logger.error('Database connection failed', error);
            return false;
        }
    }

    /**
     * Get the data source (useful for migrations and raw queries)
     */
    getDataSource(): DataSource {
        return this.dataSource;
    }

    /**
     * Run pending migrations
     */
    async runMigrations(): Promise<void> {
        try {
            const migrations = await this.dataSource.runMigrations();
            this.logger.log(`Ran ${migrations.length} migrations successfully`);
        } catch (error) {
            this.logger.error('Migration failed', error);
            throw error;
        }
    }

    /**
     * Revert last migration
     */
    async revertLastMigration(): Promise<void> {
        try {
            await this.dataSource.undoLastMigration();
            this.logger.log('Reverted last migration successfully');
        } catch (error) {
            this.logger.error('Migration revert failed', error);
            throw error;
        }
    }

    /**
     * Get pending migrations
     */
    async getPendingMigrations(): Promise<boolean> {
        const migrations = await this.dataSource.showMigrations();
        return migrations;
    }

    /**
     * Close database connection (useful for Lambda cleanup)
     */
    async closeConnection(): Promise<void> {
        if (this.dataSource.isInitialized) {
            await this.dataSource.destroy();
            this.logger.log('Database connection closed');
        }
    }
}

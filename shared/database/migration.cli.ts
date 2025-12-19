import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from './database.service';

/**
 * Migration CLI
 * Run migrations from command line
 * Usage: npm run migration:run
 */
async function runMigrations() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const databaseService = app.get(DatabaseService);

    try {
        console.log('Running database migrations...');
        await databaseService.runMigrations();
        console.log('Migrations completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await app.close();
    }
}

async function revertMigration() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const databaseService = app.get(DatabaseService);

    try {
        console.log('Reverting last migration...');
        await databaseService.revertLastMigration();
        console.log('Migration reverted successfully');
    } catch (error) {
        console.error('Migration revert failed:', error);
        process.exit(1);
    } finally {
        await app.close();
    }
}

async function showMigrations() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const databaseService = app.get(DatabaseService);

    try {
        console.log('Checking pending migrations...');
        const pending = await databaseService.getPendingMigrations();
        console.log(`Pending migrations: ${pending ? 'Yes' : 'No'}`);
    } catch (error) {
        console.error('Failed to check migrations:', error);
        process.exit(1);
    } finally {
        await app.close();
    }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
    case 'run':
        runMigrations();
        break;
    case 'revert':
        revertMigration();
        break;
    case 'show':
        showMigrations();
        break;
    default:
        console.log('Usage: npm run migration:[run|revert|show]');
        process.exit(1);
}

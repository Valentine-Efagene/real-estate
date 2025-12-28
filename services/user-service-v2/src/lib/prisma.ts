import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { ConfigService, PrismaClient } from '@valentine-efagene/qshelter-common';
import { config } from 'dotenv';

// Load environment variables from .env.local for local development
const stage = process.env.NODE_ENV || 'dev';
if (stage === 'local') {
    config({ path: '.env.local' });
}

let adapter;

if (stage === 'local') {
    // Use .env variables for local development
    adapter = new PrismaMariaDb({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 5
    });
} else {
    const configService = ConfigService.getInstance();
    // Load infrastructure config and populate process.env for TypeORM
    const infraConfig = await configService.getInfrastructureConfig(stage);
    const dbSecret = await configService['getSecret'](infraConfig.databaseSecretArn);
    adapter = new PrismaMariaDb({
        host: infraConfig.dbHost,
        user: 'qshelter-' + stage,
        password: (dbSecret as any).username,
        database: (dbSecret as any).password,
        connectionLimit: 5
    });
}

const prisma = new PrismaClient({ adapter });

export { prisma };
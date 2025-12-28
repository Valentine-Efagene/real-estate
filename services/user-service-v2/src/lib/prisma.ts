import { config } from 'dotenv';
// Load environment variables FIRST, before checking NODE_ENV
config({ path: '.env.local' });

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { ConfigService, PrismaClient } from '@valentine-efagene/qshelter-common';

// Load environment variables from .env.local for local development
const stage = process.env.NODE_ENV || 'dev';
if (stage === 'local') {
    config({ path: '.env.local' });
}

async function createAdapter() {
    if (stage === 'local') {
        // Use .env variables for local development
        return new PrismaMariaDb({
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
        return new PrismaMariaDb({
            host: infraConfig.dbHost,
            user: 'qshelter-' + stage,
            password: (dbSecret as any).username,
            database: (dbSecret as any).password,
            connectionLimit: 5
        });
    }
}

const adapter = await createAdapter();
const prisma = new PrismaClient({ adapter });

export { prisma };
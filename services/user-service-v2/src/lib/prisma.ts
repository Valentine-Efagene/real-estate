import { config } from 'dotenv';
// Load environment variables FIRST, before checking NODE_ENV
config({ path: '.env.local' });

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { ConfigService, PrismaClient } from '@valentine-efagene/qshelter-common';

// Load environment variables from .env.local for local development
const stage = process.env.NODE_ENV || 'dev';

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
        // Use ConfigService for AWS environments
        const configService = ConfigService.getInstance();
        const dbCredentials = await configService.getDatabaseCredentials(stage);

        return new PrismaMariaDb({
            host: dbCredentials.host,
            user: dbCredentials.username,
            password: dbCredentials.password,
            database: dbCredentials.database,
            connectionLimit: 5
        });
    }
}

const adapter = await createAdapter();
const prisma = new PrismaClient({ adapter });

export { prisma };
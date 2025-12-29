import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { ConfigService, PrismaClient } from '@valentine-efagene/qshelter-common';

const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';

async function createAdapter() {
    if (stage === 'local') {
        return new PrismaMariaDb({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectionLimit: 5,
        });
    }

    const configService = ConfigService.getInstance();
    const dbCredentials = await configService.getDatabaseCredentials(stage);

    return new PrismaMariaDb({
        host: dbCredentials.host,
        user: dbCredentials.username,
        password: dbCredentials.password,
        database: dbCredentials.database,
        connectionLimit: 5,
    });
}

const adapter = await createAdapter();
export const prisma: PrismaClient = new PrismaClient({ adapter });

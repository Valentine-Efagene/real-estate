import { config } from 'dotenv';
config({ path: '.env.localstack' });

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { ConfigService, PrismaClient } from '@valentine-efagene/qshelter-common';

const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';

async function createAdapter() {
    // For local development (local) and LocalStack (localstack), use env vars directly
    if (stage === 'local' || stage === 'localstack') {
        return new PrismaMariaDb({
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT || '3307'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'rootpassword',
            database: process.env.DB_NAME || 'qshelter_test',
            connectionLimit: 3,
            allowPublicKeyRetrieval: true,
        });
    }

    // For AWS stages, use ConfigService to get DB credentials from SSM
    const configService = ConfigService.getInstance();
    const dbCredentials = await configService.getDatabaseCredentials(stage);

    return new PrismaMariaDb({
        host: dbCredentials.host,
        user: dbCredentials.username,
        password: dbCredentials.password,
        database: dbCredentials.database,
        connectionLimit: 1, // Lambda: one request per container
    });
}

const adapter = await createAdapter();
export const prisma: PrismaClient = new PrismaClient({ adapter });

import { config } from 'dotenv';
// Load environment variables FIRST, before checking NODE_ENV
// Use .env.localstack for localstack, .env for local development
const envFile = process.env.NODE_ENV === 'localstack' ? '.env.localstack' : '.env';
config({ path: envFile });

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { ConfigService, PrismaClient } from '@valentine-efagene/qshelter-common';

// Load environment variables from .env for local development
const stage = process.env.NODE_ENV || 'dev';

async function createAdapter() {
    // For local development (local) and LocalStack (localstack), use env vars directly
    if (stage === 'local' || stage === 'localstack') {
        return new PrismaMariaDb({
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT || '3307'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'rootpassword',
            database: process.env.DB_NAME || 'qshelter_test',
            connectionLimit: 10,
            allowPublicKeyRetrieval: true,
        });
    }

    // For AWS stages (dev, staging, prod), use ConfigService to get DB credentials from SSM
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
const prisma: PrismaClient = new PrismaClient({ adapter });

export { prisma };
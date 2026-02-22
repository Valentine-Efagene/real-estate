import { config } from 'dotenv';

const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';

// Load the appropriate env file based on stage
if (stage === 'localstack') {
    config({ path: '.env.localstack' });
} else if (stage === 'test') {
    config({ path: '.env.test' });
} else {
    config({ path: '.env' });
}

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { ConfigService, PrismaClient } from '@valentine-efagene/qshelter-common';

async function createAdapter() {
    // For local development (local), test, and LocalStack (localstack), use env vars directly
    if (stage === 'local' || stage === 'localstack' || stage === 'test') {
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

    // For AWS stages, use ConfigService to get DB credentials from SSM
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

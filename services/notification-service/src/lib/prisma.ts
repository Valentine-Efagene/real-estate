import { config } from 'dotenv';

const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';
if (stage === 'localstack') {
    config({ path: '.env.localstack' });
} else {
    config(); // Load default .env
}

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { ConfigService, PrismaClient } from '@valentine-efagene/qshelter-common';

const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';

async function createAdapter() {
    // For local development (local) and LocalStack (localstack), use env vars directly
    // This avoids the need for VPC-related SSM parameters
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
export const prisma: PrismaClient = new PrismaClient({ adapter });

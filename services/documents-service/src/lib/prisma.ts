import { config } from 'dotenv';
config({ path: '.env.test' });

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { ConfigService, PrismaClient } from '@valentine-efagene/qshelter-common';

const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';

async function createAdapter() {
    // For local development and tests without LocalStack, use env vars directly
    if (stage === 'test') {
        return new PrismaMariaDb({
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT || '3307'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'qshelter_test',
        });
    }

    // For deployed environments, use SSM + Secrets Manager
    const configService = ConfigService.getInstance();
    const [host, port, database, username, password] = await Promise.all([
        configService.getParameter('db-host'),
        configService.getParameter('db-port'),
        configService.getParameter('db-name'),
        configService.getSecret('db-credentials', 'username'),
        configService.getSecret('db-credentials', 'password'),
    ]);

    return new PrismaMariaDb({
        host,
        port: parseInt(port),
        user: username,
        password,
        database,
    });
}

const adapter = await createAdapter();

export const prisma = new PrismaClient({ adapter });

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
const secrets = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

const configCache = new Map<string, any>();

async function getParameter(path: string): Promise<string> {
    if (configCache.has(path)) return configCache.get(path);
    const response = await ssm.send(new GetParameterCommand({ Name: path, WithDecryption: true }));
    const value = response.Parameter?.Value || '';
    configCache.set(path, value);
    return value;
}

async function getSecret(secretId: string): Promise<any> {
    if (configCache.has(secretId)) return configCache.get(secretId);
    const response = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
    const value = JSON.parse(response.SecretString || '{}');
    configCache.set(secretId, value);
    return value;
}

export async function loadConfig() {
    const stage = process.env.STAGE || 'dev';

    try {
        const dbCredentials = await getSecret(`qshelter/${stage}/database/credentials`);
        const dbHost = await getParameter(`/qshelter/${stage}/database/host`);
        const dbPort = await getParameter(`/qshelter/${stage}/database/port`);
        const dbName = await getParameter(`/qshelter/${stage}/database/name`);

        process.env.DATABASE_URL = `mysql://${dbCredentials.username}:${dbCredentials.password}@${dbHost}:${dbPort}/${dbName}`;

        const jwtSecrets = await getSecret(`qshelter/${stage}/jwt/secrets`);
        process.env.JWT_ACCESS_SECRET = jwtSecrets.accessTokenSecret;
        process.env.JWT_REFRESH_SECRET = jwtSecrets.refreshTokenSecret;
        process.env.JWT_ACCESS_EXPIRY = jwtSecrets.accessTokenExpiry || '15m';
        process.env.JWT_REFRESH_EXPIRY = jwtSecrets.refreshTokenExpiry || '7d';
    } catch (error) {
        console.warn('Failed to load AWS config, using local .env:', error);
    }
}

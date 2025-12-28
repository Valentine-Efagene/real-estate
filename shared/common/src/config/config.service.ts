import { SSMClient, GetParameterCommand, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export interface InfrastructureConfig {
    httpApiId: string;
    vpcId: string;
    dbSecurityGroupId: string;
    privateSubnetIds: string[];
    dbHost: string;
    dbPort: number;
    databaseSecretArn: string;
    redisHost: string;
    redisPort: number;
    rolePoliciesTableName: string;
    s3BucketName: string;
    eventBridgeBusName: string;
}

export interface JwtSecrets {
    secret: string;
}

export interface DatabaseCredentials {
    username: string;
    password: string;
    host: string;
    port: number;
    database: string;
}

export interface EncryptionSecrets {
    password: string;
    salt: string;
}

export interface OAuthSecrets {
    google_client_id: string;
    google_client_secret: string;
    google_callback_url: string;
}

export interface PaystackSecrets {
    secret_key: string;
    public_key: string;
    base_url: string;
}

export interface EmailSecrets {
    office365_client_id: string;
    office365_client_secret: string;
    office365_tenant_id: string;
    office365_sender_email: string;
}

export class ConfigService {
    private static instance: ConfigService;
    private ssmClient: SSMClient;
    private secretsClient: SecretsManagerClient;
    private cache = new Map<string, any>();
    private cacheTimestamps = new Map<string, number>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    private constructor(region: string = 'us-east-1') {
        this.ssmClient = new SSMClient({ region });
        this.secretsClient = new SecretsManagerClient({ region });
    }

    static getInstance(region?: string): ConfigService {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService(region);
        }
        return ConfigService.instance;
    }

    /**
     * Get all infrastructure configuration from SSM Parameter Store
     */
    async getInfrastructureConfig(stage: string = process.env.NODE_ENV || 'dev'): Promise<InfrastructureConfig> {
        const cacheKey = `infra-${stage}`;
        const cached = this.getFromCache<InfrastructureConfig>(cacheKey);
        if (cached) return cached;

        const pathPrefix = `/qshelter/${stage}/`;

        try {
            const command = new GetParametersByPathCommand({
                Path: pathPrefix,
                Recursive: true,
                WithDecryption: false,
            });

            const response = await this.ssmClient.send(command);
            const params = response.Parameters || [];

            const config: InfrastructureConfig = {
                httpApiId: this.getParamValue(params, `${pathPrefix}http-api-id`),
                vpcId: this.getParamValue(params, `${pathPrefix}vpc-id`),
                dbSecurityGroupId: this.getParamValue(params, `${pathPrefix}db-security-group-id`),
                privateSubnetIds: this.getParamValue(params, `${pathPrefix}private-subnet-ids`).split(','),
                dbHost: this.getParamValue(params, `${pathPrefix}db-host`),
                dbPort: parseInt(this.getParamValue(params, `${pathPrefix}db-port`), 10),
                databaseSecretArn: this.getParamValue(params, `${pathPrefix}database-secret-arn`),
                redisHost: this.getParamValue(params, `${pathPrefix}redis-host`),
                redisPort: parseInt(this.getParamValue(params, `${pathPrefix}redis-port`), 10),
                rolePoliciesTableName: this.getParamValue(params, `${pathPrefix}role-policies-table-name`),
                s3BucketName: this.getParamValue(params, `${pathPrefix}s3-bucket-name`),
                eventBridgeBusName: this.getParamValue(params, `${pathPrefix}eventbridge-bus-name`),
            };

            this.setCache(cacheKey, config);
            return config;
        } catch (error: any) {
            console.error('Error fetching infrastructure config from SSM:', error);
            throw new Error(`Failed to load infrastructure configuration: ${error.message}`);
        }
    }

    /**
     * Get a single parameter from SSM
     */
    async getParameter(name: string): Promise<string> {
        const cached = this.getFromCache<string>(name);
        if (cached) return cached;

        try {
            const command = new GetParameterCommand({
                Name: name,
                WithDecryption: false,
            });

            const response = await this.ssmClient.send(command);
            const value = response.Parameter?.Value || '';

            this.setCache(name, value);
            return value;
        } catch (error: any) {
            console.error(`Error fetching parameter ${name}:`, error);
            throw new Error(`Failed to load parameter ${name}: ${error.message}`);
        }
    }

    /**
     * Get JWT secrets from Secrets Manager
     */
    async getJwtSecret(stage: string = process.env.NODE_ENV || 'dev'): Promise<JwtSecrets> {
        return this.getSecret<JwtSecrets>(`qshelter/${stage}/jwt-secret`);
    }

    /**
     * Get refresh token secret from Secrets Manager
     */
    async getRefreshTokenSecret(stage: string = process.env.NODE_ENV || 'dev'): Promise<JwtSecrets> {
        return this.getSecret<JwtSecrets>(`qshelter/${stage}/refresh-token-secret`);
    }

    /**
     * Get database credentials - combines secret and infrastructure config
     * Returns a complete DatabaseCredentials object ready to use
     */
    async getDatabaseCredentials(stage: string = process.env.NODE_ENV || 'dev'): Promise<DatabaseCredentials> {
        const cacheKey = `db-credentials-${stage}`;
        const cached = this.getFromCache<DatabaseCredentials>(cacheKey);
        if (cached) return cached;

        const infraConfig = await this.getInfrastructureConfig(stage);
        const dbSecret = await this.getSecret<{ username: string; password: string }>(infraConfig.databaseSecretArn);

        const credentials: DatabaseCredentials = {
            username: dbSecret.username,
            password: dbSecret.password,
            host: infraConfig.dbHost,
            port: infraConfig.dbPort,
            database: `qshelter_${stage}`,
        };

        this.setCache(cacheKey, credentials);
        return credentials;
    }

    /**
     * Get encryption secrets from Secrets Manager
     */
    async getEncryptionSecrets(stage: string = process.env.NODE_ENV || 'dev'): Promise<EncryptionSecrets> {
        return this.getSecret<EncryptionSecrets>(`qshelter/${stage}/encryption`);
    }

    /**
     * Get OAuth secrets from Secrets Manager
     */
    async getOAuthSecrets(stage: string = process.env.NODE_ENV || 'dev'): Promise<OAuthSecrets> {
        return this.getSecret<OAuthSecrets>(`qshelter/${stage}/oauth`);
    }

    /**
     * Get Paystack secrets from Secrets Manager
     */
    async getPaystackSecrets(stage: string = process.env.NODE_ENV || 'dev'): Promise<PaystackSecrets> {
        return this.getSecret<PaystackSecrets>(`qshelter/${stage}/paystack`);
    }

    /**
     * Get Email secrets from Secrets Manager
     */
    async getEmailSecrets(stage: string = process.env.NODE_ENV || 'dev'): Promise<EmailSecrets> {
        return this.getSecret<EmailSecrets>(`qshelter/${stage}/email`);
    }

    /**
     * Generic method to get any secret from Secrets Manager
     */
    private async getSecret<T>(secretName: string): Promise<T> {
        const cached = this.getFromCache<T>(secretName);
        if (cached) return cached;

        try {
            const command = new GetSecretValueCommand({
                SecretId: secretName,
            });

            const response = await this.secretsClient.send(command);
            const secretString = response.SecretString || '{}';

            // Try to parse as JSON first, if it fails treat as plain text
            let secret: any;
            try {
                secret = JSON.parse(secretString);
            } catch {
                // If not JSON, treat as plain text and wrap in object with 'secret' key
                secret = { secret: secretString };
            }

            this.setCache(secretName, secret);
            return secret as T;
        } catch (error: any) {
            console.error(`Error fetching secret ${secretName}:`, error);
            throw new Error(`Failed to load secret ${secretName}: ${error.message}`);
        }
    }

    /**
     * Helper to extract parameter value from SSM response
     */
    private getParamValue(params: any[], name: string): string {
        const param = params.find(p => p.Name === name);
        if (!param) {
            throw new Error(`Parameter ${name} not found in SSM`);
        }
        return param.Value || '';
    }

    /**
     * Get value from cache if valid
     */
    private getFromCache<T>(key: string): T | null {
        const now = Date.now();
        const cachedTime = this.cacheTimestamps.get(key);

        if (cachedTime && (now - cachedTime) < this.CACHE_TTL && this.cache.has(key)) {
            return this.cache.get(key) as T;
        }

        return null;
    }

    /**
     * Set value in cache with timestamp
     */
    private setCache(key: string, value: any): void {
        this.cache.set(key, value);
        this.cacheTimestamps.set(key, Date.now());
    }

    /**
     * Clear the cache (useful for testing or forcing refresh)
     */
    clearCache(): void {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Get a configuration value from environment variables
     * This is useful for local development when AWS services are not available
     */
    get(key: string): string {
        return process.env[key] || '';
    }
}

// Export singleton instance
export const configService = ConfigService.getInstance();

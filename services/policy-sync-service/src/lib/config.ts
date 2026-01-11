/**
 * Configuration for the Policy Sync Service
 */

export interface ServiceConfig {
    stage: string;
    awsRegion: string;
    localstackEndpoint?: string;
    rolePoliciesTableName: string;
    sqsQueueUrl?: string;
    snsTopicArn?: string;
}

let config: ServiceConfig | null = null;

export function getConfig(): ServiceConfig {
    if (config) {
        return config;
    }

    const stage = process.env.STAGE || process.env.NODE_ENV || 'dev';
    const isLocalStack = stage === 'localstack';

    config = {
        stage,
        awsRegion: process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1',
        localstackEndpoint: isLocalStack ? (process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566') : undefined,
        rolePoliciesTableName: process.env.ROLE_POLICIES_TABLE_NAME || `qshelter-${stage}-role-policies`,
        sqsQueueUrl: process.env.POLICY_SYNC_QUEUE_URL,
        snsTopicArn: process.env.POLICY_SYNC_TOPIC_ARN,
    };

    console.log('[Config] Initialized:', {
        stage: config.stage,
        awsRegion: config.awsRegion,
        localstackEndpoint: config.localstackEndpoint ? 'configured' : 'none',
        rolePoliciesTableName: config.rolePoliciesTableName,
    });

    return config;
}

export function resetConfig(): void {
    config = null;
}

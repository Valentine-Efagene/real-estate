/**
 * LocalStack AWS Client Factory
 *
 * Provides pre-configured AWS SDK clients that automatically
 * route to LocalStack when running in test/local environment.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SNSClient } from '@aws-sdk/client-sns';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { LambdaClient } from '@aws-sdk/client-lambda';

/**
 * Check if we're running against LocalStack
 */
export function isLocalStack(): boolean {
    return !!(
        process.env.AWS_ENDPOINT ||
        process.env.LOCALSTACK_ENDPOINT ||
        process.env.NODE_ENV === 'test'
    );
}

/**
 * Get the LocalStack endpoint URL
 */
export function getLocalStackEndpoint(): string | undefined {
    return process.env.AWS_ENDPOINT || process.env.LOCALSTACK_ENDPOINT;
}

/**
 * Get base configuration for AWS clients
 * NOTE: No explicit return type to avoid cross-client type conflicts
 */
function getClientConfig() {
    const endpoint = getLocalStackEndpoint();
    const region = process.env.AWS_REGION || 'us-east-1';

    if (!endpoint) {
        return { region };
    }

    return {
        endpoint,
        region,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
        },
    };
}

/**
 * Create an S3 client (LocalStack-aware)
 */
export function createS3Client(): S3Client {
    return new S3Client({
        ...getClientConfig(),
        forcePathStyle: isLocalStack(), // Required for LocalStack
    });
}

/**
 * Create an SSM client (LocalStack-aware)
 */
export function createSSMClient(): SSMClient {
    return new SSMClient(getClientConfig());
}

/**
 * Create a Secrets Manager client (LocalStack-aware)
 */
export function createSecretsManagerClient(): SecretsManagerClient {
    return new SecretsManagerClient(getClientConfig());
}

/**
 * Create a DynamoDB client (LocalStack-aware)
 */
export function createDynamoDBClient(): DynamoDBClient {
    return new DynamoDBClient(getClientConfig());
}

/**
 * Create an EventBridge client (LocalStack-aware)
 */
export function createEventBridgeClient(): EventBridgeClient {
    return new EventBridgeClient(getClientConfig());
}

/**
 * Create an SQS client (LocalStack-aware)
 */
export function createSQSClient(): SQSClient {
    return new SQSClient(getClientConfig());
}

/**
 * Create an SNS client (LocalStack-aware)
 */
export function createSNSClient(): SNSClient {
    return new SNSClient(getClientConfig());
}

/**
 * Create a CloudWatch Logs client (LocalStack-aware)
 */
export function createCloudWatchLogsClient(): CloudWatchLogsClient {
    return new CloudWatchLogsClient(getClientConfig());
}

/**
 * Create a Lambda client (LocalStack-aware)
 */
export function createLambdaClient(): LambdaClient {
    return new LambdaClient(getClientConfig());
}

/**
 * Export all clients with default configs
 */
export const localStackClients = {
    s3: () => createS3Client(),
    ssm: () => createSSMClient(),
    secretsManager: () => createSecretsManagerClient(),
    dynamodb: () => createDynamoDBClient(),
    eventBridge: () => createEventBridgeClient(),
    sqs: () => createSQSClient(),
    sns: () => createSNSClient(),
    cloudWatchLogs: () => createCloudWatchLogsClient(),
    lambda: () => createLambdaClient(),
};

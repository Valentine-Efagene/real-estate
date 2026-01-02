import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * LocalStack-compatible CDK Stack for QShelter
 * 
 * This stack provisions resources that work with LocalStack for local development.
 * It skips resources that LocalStack doesn't support well (VPC, RDS, ElastiCache).
 * 
 * Usage:
 *   cdklocal deploy --context stage=test
 * 
 * Prerequisites:
 *   - LocalStack running (docker-compose up -d)
 *   - Docker MySQL running (from docker-compose.yml)
 *   - local-dev/.env populated with secrets
 */
export class LocalStackStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Load environment variables from local-dev/.env
        dotenv.config({ path: path.resolve(__dirname, '../../local-dev/.env') });

        // Stage is always 'test' for LocalStack
        const stage = this.node.tryGetContext('stage') || 'test';
        const prefix = `qshelter-${stage}`;

        // === S3 Buckets ===
        const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
            bucketName: `${prefix}-uploads`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE, s3.HttpMethods.HEAD],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                    exposedHeaders: ['ETag'],
                },
            ],
        });

        const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
            bucketName: `${prefix}-documents`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // === DynamoDB for Role Policies ===
        const rolePoliciesTable = new dynamodb.Table(this, 'RolePoliciesTable', {
            tableName: `${prefix}-role-policies`,
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Global Secondary Index for tenant queries
        rolePoliciesTable.addGlobalSecondaryIndex({
            indexName: 'GSI1',
            partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
        });

        // === EventBridge Event Bus ===
        const eventBus = new events.EventBus(this, 'QShelterEventBus', {
            eventBusName: `${prefix}-event-bus`,
        });

        // Catch-all rule for debugging
        new events.Rule(this, 'CatchAllRule', {
            eventBus,
            ruleName: `${prefix}-catch-all`,
            eventPattern: {
                source: [{ prefix: 'qshelter' }] as any,
            },
        });

        // === SQS Queues ===
        const dlq = new sqs.Queue(this, 'DeadLetterQueue', {
            queueName: `${prefix}-dlq`,
        });

        const notificationsQueue = new sqs.Queue(this, 'NotificationsQueue', {
            queueName: `${prefix}-notifications`,
            deadLetterQueue: {
                queue: dlq,
                maxReceiveCount: 3,
            },
        });

        const contractEventsQueue = new sqs.Queue(this, 'ContractEventsQueue', {
            queueName: `${prefix}-contract-events`,
            deadLetterQueue: {
                queue: dlq,
                maxReceiveCount: 3,
            },
        });

        // === SNS Topics ===
        const notificationsTopic = new sns.Topic(this, 'NotificationsTopic', {
            topicName: `${prefix}-notifications`,
        });

        const contractEventsTopic = new sns.Topic(this, 'ContractEventsTopic', {
            topicName: `${prefix}-contract-events`,
        });

        // === CloudWatch Log Groups ===
        const serviceLogGroups = ['user-service', 'property-service', 'mortgage-service', 'notifications-service', 'authorizer-service'];
        for (const service of serviceLogGroups) {
            new logs.LogGroup(this, `${service.replace('-', '')}LogGroup`, {
                logGroupName: `/aws/lambda/${prefix}-${service}`,
                retention: logs.RetentionDays.ONE_WEEK,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
        }

        // === SSM Parameters - Database (for Docker MySQL) ===
        new ssm.StringParameter(this, 'DbHostParameter', {
            parameterName: `/qshelter/${stage}/DB_HOST`,
            stringValue: process.env.DB_HOST || '127.0.0.1',
            description: 'Database Host',
        });

        new ssm.StringParameter(this, 'DbPortParameter', {
            parameterName: `/qshelter/${stage}/DB_PORT`,
            stringValue: process.env.DB_PORT || '3307',
            description: 'Database Port',
        });

        new ssm.StringParameter(this, 'DbNameParameter', {
            parameterName: `/qshelter/${stage}/DB_NAME`,
            stringValue: process.env.DB_NAME || 'qshelter_test',
            description: 'Database Name',
        });

        new ssm.StringParameter(this, 'DbUserParameter', {
            parameterName: `/qshelter/${stage}/DB_USER`,
            stringValue: process.env.DB_USER || 'qshelter',
            description: 'Database User',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'DbPasswordParameter', {
            parameterName: `/qshelter/${stage}/DB_PASSWORD`,
            stringValue: process.env.DB_PASSWORD || 'qshelter_pass',
            description: 'Database Password',
            type: ssm.ParameterType.SECURE_STRING,
        });

        // Legacy database-url format (for backward compatibility)
        new ssm.StringParameter(this, 'DatabaseUrlParameter', {
            parameterName: `/qshelter/${stage}/database-url`,
            stringValue: `mysql://${process.env.DB_USER || 'qshelter'}:${process.env.DB_PASSWORD || 'qshelter_pass'}@host.docker.internal:${process.env.DB_PORT || '3307'}/${process.env.DB_NAME || 'qshelter_test'}`,
            description: 'Full Database URL',
            type: ssm.ParameterType.SECURE_STRING,
        });

        // === SSM Parameters - Infrastructure ===
        new ssm.StringParameter(this, 'S3BucketNameParameter', {
            parameterName: `/qshelter/${stage}/s3-bucket-name`,
            stringValue: uploadsBucket.bucketName,
            description: 'S3 Uploads Bucket Name',
        });

        new ssm.StringParameter(this, 'EventBusNameParameter', {
            parameterName: `/qshelter/${stage}/event-bus-name`,
            stringValue: eventBus.eventBusName,
            description: 'EventBridge Bus Name',
        });

        new ssm.StringParameter(this, 'RedisEndpointParameter', {
            parameterName: `/qshelter/${stage}/redis-endpoint`,
            stringValue: 'localhost:6379',
            description: 'Redis Endpoint',
        });

        new ssm.StringParameter(this, 'AuthorizerLambdaArnParameter', {
            parameterName: `/qshelter/${stage}/authorizer-lambda-arn`,
            stringValue: `arn:aws:lambda:us-east-1:000000000000:function:${prefix}-authorizer`,
            description: 'Authorizer Lambda ARN',
        });

        new ssm.StringParameter(this, 'RolePoliciesTableParameter', {
            parameterName: `/qshelter/${stage}/dynamodb-table-role-policies`,
            stringValue: rolePoliciesTable.tableName,
            description: 'DynamoDB Role Policies Table Name',
        });

        // === SSM Parameters - Notification Service ===
        new ssm.StringParameter(this, 'Office365ClientIdParameter', {
            parameterName: `/qshelter/${stage}/OFFICE365_CLIENT_ID`,
            stringValue: process.env.OFFICE365_CLIENT_ID || 'test-client-id',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'Office365ClientSecretParameter', {
            parameterName: `/qshelter/${stage}/OFFICE365_CLIENT_SECRET`,
            stringValue: process.env.OFFICE365_CLIENT_SECRET || 'test-client-secret',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'Office365TenantIdParameter', {
            parameterName: `/qshelter/${stage}/OFFICE365_TENANT_ID`,
            stringValue: process.env.OFFICE365_TENANT_ID || 'test-tenant-id',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'Office365SenderEmailParameter', {
            parameterName: `/qshelter/${stage}/OFFICE365_SENDER_EMAIL`,
            stringValue: process.env.OFFICE365_SENDER_EMAIL || 'info@qshelter.ng',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'SmtpHostParameter', {
            parameterName: `/qshelter/${stage}/SMTP_HOST`,
            stringValue: process.env.SMTP_HOST || 'smtp.mailtrap.io',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'SmtpPortParameter', {
            parameterName: `/qshelter/${stage}/SMTP_PORT`,
            stringValue: process.env.SMTP_PORT || '2525',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'SmtpUsernameParameter', {
            parameterName: `/qshelter/${stage}/SMTP_USERNAME`,
            stringValue: process.env.SMTP_USERNAME || 'test-smtp-user',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'SmtpPasswordParameter', {
            parameterName: `/qshelter/${stage}/SMTP_PASSWORD`,
            stringValue: process.env.SMTP_PASSWORD || 'test-smtp-pass',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'SmtpEncryptionParameter', {
            parameterName: `/qshelter/${stage}/SMTP_ENCRYPTION`,
            stringValue: process.env.SMTP_ENCRYPTION || 'STARTTLS',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'AwsAccessKeyIdParameter', {
            parameterName: `/qshelter/${stage}/AWS_ACCESS_KEY_ID`,
            stringValue: 'test',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'AwsSecretAccessKeyParameter', {
            parameterName: `/qshelter/${stage}/AWS_SECRET_ACCESS_KEY`,
            stringValue: 'test',
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'SqsUrlParameter', {
            parameterName: `/qshelter/${stage}/SQS_URL`,
            stringValue: notificationsQueue.queueUrl,
            type: ssm.ParameterType.SECURE_STRING,
        });

        new ssm.StringParameter(this, 'PlatformApplicationArnParameter', {
            parameterName: `/qshelter/${stage}/PLATFORM_APPLICATION_ARN`,
            stringValue: `arn:aws:sns:us-east-1:000000000000:app/GCM/qshelter-push`,
            type: ssm.ParameterType.SECURE_STRING,
        });

        // === Secrets Manager ===
        new secretsmanager.Secret(this, 'JwtAccessSecret', {
            secretName: `qshelter/${stage}/jwt-access-secret`,
            secretStringValue: cdk.SecretValue.unsafePlainText(
                process.env.ACCESS_TOKEN_SECRET || 'test-jwt-access-secret-key-for-e2e-testing-min-32-chars'
            ),
        });

        new secretsmanager.Secret(this, 'JwtRefreshSecret', {
            secretName: `qshelter/${stage}/jwt-refresh-secret`,
            secretStringValue: cdk.SecretValue.unsafePlainText(
                process.env.REFRESH_TOKEN_SECRET || 'test-jwt-refresh-secret-key-for-e2e-testing-min-32-chars'
            ),
        });

        new secretsmanager.Secret(this, 'OAuthSecret', {
            secretName: `qshelter/${stage}/oauth`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({
                    google_client_id: process.env.GOOGLE_CLIENT_ID || 'test-google-client-id',
                    google_client_secret: process.env.GOOGLE_CLIENT_SECRET || 'test-google-secret',
                    facebook_client_id: 'test-fb-id',
                    facebook_client_secret: 'test-fb-secret',
                }),
                generateStringKey: 'unused',
            },
        });

        new secretsmanager.Secret(this, 'PaystackSecret', {
            secretName: `qshelter/${stage}/paystack`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({
                    secret_key: process.env.PAYSTACK_SECRET_KEY || 'sk_test_xxx',
                    public_key: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_xxx',
                }),
                generateStringKey: 'unused',
            },
        });

        // === Outputs ===
        new cdk.CfnOutput(this, 'UploadsBucketName', {
            value: uploadsBucket.bucketName,
            description: 'S3 Uploads Bucket',
        });

        new cdk.CfnOutput(this, 'DocumentsBucketName', {
            value: documentsBucket.bucketName,
            description: 'S3 Documents Bucket',
        });

        new cdk.CfnOutput(this, 'RolePoliciesTableName', {
            value: rolePoliciesTable.tableName,
            description: 'DynamoDB Role Policies Table',
        });

        new cdk.CfnOutput(this, 'EventBusName', {
            value: eventBus.eventBusName,
            description: 'EventBridge Bus Name',
        });

        new cdk.CfnOutput(this, 'NotificationsQueueUrl', {
            value: notificationsQueue.queueUrl,
            description: 'Notifications SQS Queue URL',
        });
    }
}

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as dotenv from 'dotenv';
import * as path from 'path';

export class RealEstateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Load environment variables from .env file in infrastructure folder
    dotenv.config({ path: path.resolve(__dirname, '../.env') });

    // Get stage from context or default to 'dev'
    const stage = this.node.tryGetContext('stage') || 'dev';

    // Prefix for all resource names to avoid collisions across stages
    const prefix = `qshelter-${stage}`;

    // === Networking ===
    const vpc = new ec2.Vpc(this, "RealEstateVpc", {
      maxAzs: 2,
      natGateways: 1,
    });

    // === Lambda Security Group ===
    // Security group for Lambda functions to access RDS and other VPC resources
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      securityGroupName: `${prefix}-lambda-sg`,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // === MySQL RDS ===
    const cluster = new rds.DatabaseCluster(this, "AuroraServerlessDB", {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_10_0, // 8.0-compatible
      }),
      writer: rds.ClusterInstance.serverlessV2("writer", {
        scaleWithWriter: true,
        publiclyAccessible: true, // ⚠️ Allow only in dev.
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // 👈 Force use of public subnets. Allow only on dev.
      },
      credentials: rds.Credentials.fromGeneratedSecret("dbadmin"),
      defaultDatabaseName: `qshelter_${stage}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const dbCredentials = cluster.secret!;

    // Allow Lambda security group to access RDS
    cluster.connections.allowFrom(lambdaSecurityGroup, ec2.Port.tcp(3306), 'Allow Lambda functions to access Aurora MySQL');

    // Redis (Valkey)
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'ValkeySubnetGroup', {
      description: 'Valkey subnet group',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      cacheSubnetGroupName: `${prefix}-valkey-subnet-group`,
    });

    const valkeyCluster = new elasticache.CfnCacheCluster(this, 'ValkeyCluster', {
      cacheNodeType: 'cache.t4g.micro',
      engine: 'redis',
      numCacheNodes: 1,
      clusterName: `${prefix}-valkey-cluster`,
      vpcSecurityGroupIds: [vpc.vpcDefaultSecurityGroup],
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName!,
    });
    valkeyCluster.addDependency(subnetGroup);

    // === DynamoDB for Role Policies ===
    const rolePoliciesTable = new dynamodb.Table(this, 'RolePoliciesTable', {
      tableName: `${prefix}-role-policies`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // Global Secondary Index for tenant queries
    rolePoliciesTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // === S3 Buckets ===
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `${prefix}-uploads-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      autoDeleteObjects: true, // ⚠️ DEV ONLY: Remove in production
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
        {
          id: 'DeleteIncompleteUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Restrict in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      // ⚠️ DEV ONLY: Change to RETAIN in production to prevent data loss
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // === EventBridge Event Bus ===
    const eventBus = new events.EventBus(this, 'QShelterEventBus', {
      eventBusName: `${prefix}-event-bus`,
    });

    // Create CloudWatch Log Group for EventBridge
    const eventBusLogGroup = new logs.LogGroup(this, 'EventBusLogGroup', {
      logGroupName: `/aws/events/${prefix}-event-bus`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // === SQS Queues ===
    const dlq = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `${prefix}-dlq`,
      retentionPeriod: cdk.Duration.days(14),
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

    const paymentsQueue = new sqs.Queue(this, 'PaymentsQueue', {
      queueName: `${prefix}-payments`,
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    const policySyncQueue = new sqs.Queue(this, 'PolicySyncQueue', {
      queueName: `${prefix}-policy-sync`,
      visibilityTimeout: cdk.Duration.seconds(60),
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

    const paymentsTopic = new sns.Topic(this, 'PaymentsTopic', {
      topicName: `${prefix}-payments`,
    });

    const policySyncTopic = new sns.Topic(this, 'PolicySyncTopic', {
      topicName: `${prefix}-policy-sync`,
    });

    // === SNS Subscriptions ===
    notificationsTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(notificationsQueue, {
        rawMessageDelivery: false,
      })
    );

    contractEventsTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(contractEventsQueue, {
        rawMessageDelivery: false,
      })
    );

    paymentsTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(paymentsQueue, {
        rawMessageDelivery: false,
      })
    );

    policySyncTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(policySyncQueue, {
        rawMessageDelivery: false,
      })
    );

    // === CloudWatch Log Groups for Services ===
    new logs.LogGroup(this, 'UserServiceLogGroup', {
      logGroupName: `/aws/lambda/${prefix}-user-service`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'PropertyServiceLogGroup', {
      logGroupName: `/aws/lambda/${prefix}-property-service`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'MortgageServiceLogGroup', {
      logGroupName: `/aws/lambda/${prefix}-mortgage-service`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'NotificationsServiceLogGroup', {
      logGroupName: `/aws/lambda/${prefix}-notifications-service`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'AuthorizerServiceLogGroup', {
      logGroupName: `/aws/lambda/${prefix}-authorizer-service`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // === Systems Manager Parameters (Infrastructure - Free) ===
    new ssm.StringParameter(this, 'VpcIdParameter', {
      parameterName: `/qshelter/${stage}/vpc-id`,
      stringValue: vpc.vpcId,
      description: 'VPC ID',
    });

    new ssm.StringParameter(this, 'LambdaSecurityGroupIdParameter', {
      parameterName: `/qshelter/${stage}/lambda-security-group-id`,
      stringValue: lambdaSecurityGroup.securityGroupId,
      description: 'Lambda Security Group ID for VPC access',
    });

    new ssm.StringParameter(this, 'DbSecurityGroupIdParameter', {
      parameterName: `/qshelter/${stage}/db-security-group-id`,
      stringValue: cluster.connections.securityGroups[0].securityGroupId,
      description: 'Database Security Group ID',
    });

    new ssm.StringParameter(this, 'PrivateSubnetIdsParameter', {
      parameterName: `/qshelter/${stage}/private-subnet-ids`,
      stringValue: vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Private Subnet IDs (comma-separated)',
    });

    // Individual subnet IDs for Serverless Framework (which needs array format)
    vpc.privateSubnets.forEach((subnet, index) => {
      new ssm.StringParameter(this, `PrivateSubnet${index + 1}IdParameter`, {
        parameterName: `/qshelter/${stage}/private-subnet-${index + 1}-id`,
        stringValue: subnet.subnetId,
        description: `Private Subnet ${index + 1} ID`,
      });
    });

    new ssm.StringParameter(this, 'DbHostParameter', {
      parameterName: `/qshelter/${stage}/db-host`,
      stringValue: cluster.clusterEndpoint.hostname,
      description: 'Database Host',
    });

    new ssm.StringParameter(this, 'DbPortParameter', {
      parameterName: `/qshelter/${stage}/db-port`,
      stringValue: cluster.clusterEndpoint.port.toString(),
      description: 'Database Port',
    });

    new ssm.StringParameter(this, 'DatabaseSecretArnParameter', {
      parameterName: `/qshelter/${stage}/database-secret-arn`,
      stringValue: dbCredentials.secretArn,
      description: 'Database Secret ARN',
    });

    new ssm.StringParameter(this, 'RedisHostParameter', {
      parameterName: `/qshelter/${stage}/redis-host`,
      stringValue: valkeyCluster.attrRedisEndpointAddress,
      description: 'Redis/Valkey Host',
    });

    new ssm.StringParameter(this, 'RedisPortParameter', {
      parameterName: `/qshelter/${stage}/redis-port`,
      stringValue: '6379',
      description: 'Redis/Valkey Port',
    });

    new ssm.StringParameter(this, 'RolePoliciesTableNameParameter', {
      parameterName: `/qshelter/${stage}/role-policies-table-name`,
      stringValue: rolePoliciesTable.tableName,
      description: 'DynamoDB Role Policies Table Name',
    });

    new ssm.StringParameter(this, 'S3BucketNameParameter', {
      parameterName: `/qshelter/${stage}/s3-bucket-name`,
      stringValue: uploadsBucket.bucketName,
      description: 'S3 Uploads Bucket Name',
    });

    new ssm.StringParameter(this, 'EventBridgeBusNameParameter', {
      parameterName: `/qshelter/${stage}/eventbridge-bus-name`,
      stringValue: eventBus.eventBusName,
      description: 'EventBridge Bus Name',
    });

    // === SNS/SQS SSM Parameters ===
    new ssm.StringParameter(this, 'NotificationsTopicArnParameter', {
      parameterName: `/qshelter/${stage}/notifications-topic-arn`,
      stringValue: notificationsTopic.topicArn,
      description: 'Notifications SNS Topic ARN',
    });

    new ssm.StringParameter(this, 'NotificationsQueueArnParameter', {
      parameterName: `/qshelter/${stage}/notifications-queue-arn`,
      stringValue: notificationsQueue.queueArn,
      description: 'Notifications SQS Queue ARN',
    });

    new ssm.StringParameter(this, 'NotificationsQueueUrlParameter', {
      parameterName: `/qshelter/${stage}/notifications-queue-url`,
      stringValue: notificationsQueue.queueUrl,
      description: 'Notifications SQS Queue URL',
    });

    new ssm.StringParameter(this, 'PaymentsTopicArnParameter', {
      parameterName: `/qshelter/${stage}/payments-topic-arn`,
      stringValue: paymentsTopic.topicArn,
      description: 'Payments SNS Topic ARN',
    });

    new ssm.StringParameter(this, 'PaymentsQueueArnParameter', {
      parameterName: `/qshelter/${stage}/payments-queue-arn`,
      stringValue: paymentsQueue.queueArn,
      description: 'Payments SQS Queue ARN',
    });

    new ssm.StringParameter(this, 'PaymentsQueueUrlParameter', {
      parameterName: `/qshelter/${stage}/payments-queue-url`,
      stringValue: paymentsQueue.queueUrl,
      description: 'Payments SQS Queue URL',
    });

    new ssm.StringParameter(this, 'ContractEventsTopicArnParameter', {
      parameterName: `/qshelter/${stage}/contract-events-topic-arn`,
      stringValue: contractEventsTopic.topicArn,
      description: 'Contract Events SNS Topic ARN',
    });

    new ssm.StringParameter(this, 'ContractEventsQueueArnParameter', {
      parameterName: `/qshelter/${stage}/contract-events-queue-arn`,
      stringValue: contractEventsQueue.queueArn,
      description: 'Contract Events SQS Queue ARN',
    });

    new ssm.StringParameter(this, 'ContractEventsQueueUrlParameter', {
      parameterName: `/qshelter/${stage}/contract-events-queue-url`,
      stringValue: contractEventsQueue.queueUrl,
      description: 'Contract Events SQS Queue URL',
    });

    new ssm.StringParameter(this, 'PolicySyncTopicArnParameter', {
      parameterName: `/qshelter/${stage}/policy-sync-topic-arn`,
      stringValue: policySyncTopic.topicArn,
      description: 'Policy Sync SNS Topic ARN',
    });

    new ssm.StringParameter(this, 'PolicySyncQueueArnParameter', {
      parameterName: `/qshelter/${stage}/policy-sync-queue-arn`,
      stringValue: policySyncQueue.queueArn,
      description: 'Policy Sync SQS Queue ARN',
    });

    new ssm.StringParameter(this, 'PolicySyncQueueUrlParameter', {
      parameterName: `/qshelter/${stage}/policy-sync-queue-url`,
      stringValue: policySyncQueue.queueUrl,
      description: 'Policy Sync SQS Queue URL',
    });

    // NOTE: HTTP API ID parameter is created by user-service when it deploys the HTTP API Gateway
    // Do NOT create /qshelter/${stage}/http-api-id here to avoid conflicts

    // === Notification Service Secrets ===
    // Store notification service config in Secrets Manager (CloudFormation doesn't support SSM SecureString)

    new secretsmanager.Secret(this, 'NotificationConfigSecret', {
      secretName: `qshelter/${stage}/notification-config`,
      description: 'Notification service configuration (Office365, SMTP, AWS)',
      secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
        OFFICE365_CLIENT_ID: process.env.OFFICE365_CLIENT_ID || 'UPDATE_ME',
        OFFICE365_CLIENT_SECRET: process.env.OFFICE365_CLIENT_SECRET || 'UPDATE_ME',
        OFFICE365_TENANT_ID: process.env.OFFICE365_TENANT_ID || 'UPDATE_ME',
        OFFICE365_SENDER_EMAIL: process.env.OFFICE365_SENDER_EMAIL || 'info@qshelter.ng',
        SMTP_HOST: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        SMTP_PORT: process.env.SMTP_PORT || '2525',
        SMTP_USERNAME: process.env.SMTP_USERNAME || 'UPDATE_ME',
        SMTP_PASSWORD: process.env.SMTP_PASSWORD || 'UPDATE_ME',
        SMTP_ENCRYPTION: process.env.SMTP_ENCRYPTION || 'STARTTLS',
        AWS_ACCESS_KEY_ID: process.env.NOTIFICATION_AWS_ACCESS_KEY_ID || 'UPDATE_ME',
        AWS_SECRET_ACCESS_KEY: process.env.NOTIFICATION_AWS_SECRET_ACCESS_KEY || 'UPDATE_ME',
        SQS_URL: process.env.SQS_URL || 'UPDATE_ME',
        PLATFORM_APPLICATION_ARN: process.env.PLATFORM_APPLICATION_ARN || 'UPDATE_ME',
      })),
    });

    // SSM parameter to point to the secret ARN for discovery
    new ssm.StringParameter(this, 'NotificationConfigSecretArnParameter', {
      parameterName: `/qshelter/${stage}/notification-config-secret-arn`,
      stringValue: `arn:aws:secretsmanager:${this.region}:${this.account}:secret:qshelter/${stage}/notification-config`,
      description: 'ARN of the Secrets Manager secret containing notification config',
    });

    // === Secrets Manager (Sensitive Values) ===

    // JWT Secrets - Use from .env or auto-generate
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `qshelter/${stage}/jwt-secret`,
      description: 'JWT signing secret for authentication',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        process.env.ACCESS_TOKEN_SECRET ||
        // Fallback to auto-generation if not in .env
        require('crypto').randomBytes(32).toString('hex')
      ),
    });

    const refreshTokenSecret = new secretsmanager.Secret(this, 'RefreshTokenSecret', {
      secretName: `qshelter/${stage}/refresh-token-secret`,
      description: 'Refresh token signing secret',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        process.env.REFRESH_TOKEN_SECRET ||
        require('crypto').randomBytes(32).toString('hex')
      ),
    });

    // Encryption Keys - Use from .env or auto-generate
    const encryptionSecret = new secretsmanager.Secret(this, 'EncryptionSecret', {
      secretName: `qshelter/${stage}/encryption`,
      description: 'Encryption keys for sensitive data',
      secretObjectValue: {
        password: cdk.SecretValue.unsafePlainText(
          process.env.ENCRYPTION_PASSWORD || require('crypto').randomBytes(16).toString('hex')
        ),
        salt: cdk.SecretValue.unsafePlainText(
          process.env.ENCRYPTION_SALT || require('crypto').randomBytes(8).toString('hex')
        ),
      },
    });

    // OAuth secrets from .env
    const oauthSecret = new secretsmanager.Secret(this, 'OAuthSecret', {
      secretName: `qshelter/${stage}/oauth`,
      description: 'OAuth provider credentials (Google, etc)',
      secretObjectValue: {
        google_client_id: cdk.SecretValue.unsafePlainText(
          process.env.GOOGLE_CLIENT_ID || 'UPDATE_ME'
        ),
        google_client_secret: cdk.SecretValue.unsafePlainText(
          process.env.GOOGLE_CLIENT_SECRET || 'UPDATE_ME'
        ),
        google_callback_url: cdk.SecretValue.unsafePlainText(
          process.env.GOOGLE_CALLBACK_URL || 'UPDATE_ME'
        ),
      },
    });

    // Paystack secrets from .env
    const paystackSecret = new secretsmanager.Secret(this, 'PaystackSecret', {
      secretName: `qshelter/${stage}/paystack`,
      description: 'Paystack payment gateway credentials',
      secretObjectValue: {
        secret_key: cdk.SecretValue.unsafePlainText(
          process.env.PAYSTACK_SECRET_KEY || 'UPDATE_ME'
        ),
        public_key: cdk.SecretValue.unsafePlainText(
          process.env.PAYSTACK_PUBLIC_KEY || 'UPDATE_ME'
        ),
        base_url: cdk.SecretValue.unsafePlainText(
          process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co'
        ),
      },
    });

    // Email/SMTP secrets from .env
    const emailSecret = new secretsmanager.Secret(this, 'EmailSecret', {
      secretName: `qshelter/${stage}/email`,
      description: 'Email service credentials (Office365, SMTP)',
      secretObjectValue: {
        office365_client_id: cdk.SecretValue.unsafePlainText(
          process.env.OFFICE365_CLIENT_ID || 'UPDATE_ME'
        ),
        office365_client_secret: cdk.SecretValue.unsafePlainText(
          process.env.OFFICE365_CLIENT_SECRET || 'UPDATE_ME'
        ),
        office365_tenant_id: cdk.SecretValue.unsafePlainText(
          process.env.OFFICE365_TENANT_ID || 'UPDATE_ME'
        ),
        office365_sender_email: cdk.SecretValue.unsafePlainText(
          process.env.OFFICE365_SENDER_EMAIL || 'info@qshelter.ng'
        ),
        smtp_host: cdk.SecretValue.unsafePlainText(
          process.env.SMTP_HOST || 'smtp.mailtrap.io'
        ),
        smtp_port: cdk.SecretValue.unsafePlainText(
          process.env.SMTP_PORT || '2525'
        ),
        smtp_username: cdk.SecretValue.unsafePlainText(
          process.env.SMTP_USERNAME || 'UPDATE_ME'
        ),
        smtp_password: cdk.SecretValue.unsafePlainText(
          process.env.SMTP_PASSWORD || 'UPDATE_ME'
        ),
        smtp_encryption: cdk.SecretValue.unsafePlainText(
          process.env.SMTP_ENCRYPTION || 'STARTTLS'
        ),
        from_email: cdk.SecretValue.unsafePlainText(
          process.env.FROM_EMAIL || process.env.MAIL_FROM_ADDRESS || 'info@qshelter.ng'
        ),
      },
    });

    // === IAM Role for Lambda Services ===
    const lambdaServiceRole = new iam.Role(this, 'LambdaServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for QShelter microservice Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Grant permissions to Lambda role
    dbCredentials.grantRead(lambdaServiceRole);
    rolePoliciesTable.grantReadWriteData(lambdaServiceRole);
    uploadsBucket.grantReadWrite(lambdaServiceRole);

    // Grant EventBridge permissions
    lambdaServiceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'events:PutEvents',
      ],
      resources: [eventBus.eventBusArn],
    }));

    // Grant SSM Parameter Store read access
    lambdaServiceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/qshelter/${stage}/*`,
      ],
    }));

    // Grant Secrets Manager access
    lambdaServiceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [
        jwtSecret.secretArn,
        refreshTokenSecret.secretArn,
        encryptionSecret.secretArn,
        oauthSecret.secretArn,
        paystackSecret.secretArn,
        emailSecret.secretArn,
        dbCredentials.secretArn,
      ],
    }));

    // Grant CloudWatch Logs permissions
    lambdaServiceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    // === Outputs ===
    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(this, 'Stage', {
      value: stage,
      description: 'Deployment stage',
    });

    new cdk.CfnOutput(this, 'ParameterPathPrefix', {
      value: `/qshelter/${stage}/`,
      description: 'SSM Parameter Store path prefix - all infrastructure values stored here',
    });

    new cdk.CfnOutput(this, 'SecretsPathPrefix', {
      value: `qshelter/${stage}/`,
      description: 'Secrets Manager path prefix - all sensitive values stored here',
    });

    new cdk.CfnOutput(this, 'JwtSecretArn', {
      value: jwtSecret.secretArn,
      description: 'JWT Secret ARN in Secrets Manager (auto-generated)',
    });

    new cdk.CfnOutput(this, 'OAuthSecretArn', {
      value: oauthSecret.secretArn,
      description: 'OAuth Secret ARN (UPDATE with actual Google credentials)',
    });

    new cdk.CfnOutput(this, 'PaystackSecretArn', {
      value: paystackSecret.secretArn,
      description: 'Paystack Secret ARN (UPDATE with actual credentials)',
    });

    new cdk.CfnOutput(this, 'EmailSecretArn', {
      value: emailSecret.secretArn,
      description: 'Email Secret ARN (UPDATE with actual Office365 credentials)',
    });
  }
}

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
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class RealEstateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // === Networking ===
    const vpc = new ec2.Vpc(this, "RealEstateVpc", {
      maxAzs: 2,
      natGateways: 1,
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
      defaultDatabaseName: "authdb",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const dbCredentials = cluster.secret!;

    // Redis (Valkey)
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'ValkeySubnetGroup', {
      description: 'Valkey subnet group',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      cacheSubnetGroupName: 'valkey-subnet-group',
    });

    const valkeyCluster = new elasticache.CfnCacheCluster(this, 'ValkeyCluster', {
      cacheNodeType: 'cache.t4g.micro',
      engine: 'redis',
      numCacheNodes: 1,
      clusterName: 'valkey-cluster',
      vpcSecurityGroupIds: [vpc.vpcDefaultSecurityGroup],
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName!,
    });
    valkeyCluster.addDependency(subnetGroup);

    // === DynamoDB for Role Policies ===
    const rolePoliciesTable = new dynamodb.Table(this, 'RolePoliciesTable', {
      tableName: 'role-policies',
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
      bucketName: `qshelter-uploads-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
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
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // === EventBridge Event Bus ===
    const eventBus = new events.EventBus(this, 'QShelterEventBus', {
      eventBusName: 'qshelter-event-bus',
    });

    // Create CloudWatch Log Group for EventBridge
    const eventBusLogGroup = new logs.LogGroup(this, 'EventBusLogGroup', {
      logGroupName: '/aws/events/qshelter-event-bus',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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

    // Grant Secrets Manager access
    lambdaServiceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [
        `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:qshelter/*`,
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

    // === CloudWatch Log Groups for Services ===
    new logs.LogGroup(this, 'UserServiceLogGroup', {
      logGroupName: '/aws/lambda/qshelter-user-service',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'PropertyServiceLogGroup', {
      logGroupName: '/aws/lambda/qshelter-property-service',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'MortgageServiceLogGroup', {
      logGroupName: '/aws/lambda/qshelter-mortgage-service',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'NotificationsServiceLogGroup', {
      logGroupName: '/aws/lambda/qshelter-notifications-service',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, 'AuthorizerServiceLogGroup', {
      logGroupName: '/aws/lambda/qshelter-authorizer-service',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // === HTTP API Gateway (Shared) ===
    const httpApi = new apigatewayv2.CfnApi(this, 'QShelterHttpApi', {
      name: 'qshelter-api',
      protocolType: 'HTTP',
      corsConfiguration: {
        allowOrigins: ['*'], // Restrict in production
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Tenant-ID',
          'X-Tenant-Subdomain',
        ],
        maxAge: 300,
      },
    });

    // Create a default stage
    const apiStage = new apigatewayv2.CfnStage(this, 'QShelterHttpApiStage', {
      apiId: httpApi.ref,
      stageName: '$default',
      autoDeploy: true,
      accessLogSettings: {
        destinationArn: new logs.LogGroup(this, 'ApiAccessLogGroup', {
          logGroupName: '/aws/apigateway/qshelter-api',
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }).logGroupArn,
        format: JSON.stringify({
          requestId: '$context.requestId',
          ip: '$context.identity.sourceIp',
          requestTime: '$context.requestTime',
          httpMethod: '$context.httpMethod',
          routeKey: '$context.routeKey',
          status: '$context.status',
          protocol: '$context.protocol',
          responseLength: '$context.responseLength',
          errorMessage: '$context.error.message',
          integrationErrorMessage: '$context.integrationErrorMessage',
        }),
      },
      defaultRouteSettings: {
        throttlingBurstLimit: 200,
        throttlingRateLimit: 100,
      },
    });

    // === Outputs ===
    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID',
      exportName: 'QShelterVpcId',
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
      description: 'Private Subnet IDs',
      exportName: 'QShelterPrivateSubnetIds',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: cluster.clusterEndpoint.hostname,
      description: 'RDS Aurora Cluster Endpoint',
      exportName: 'QShelterDatabaseEndpoint',
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: cluster.clusterEndpoint.port.toString(),
      description: 'RDS Aurora Cluster Port',
      exportName: 'QShelterDatabasePort',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: dbCredentials.secretArn,
      description: 'Database credentials secret ARN',
      exportName: 'QShelterDatabaseSecretArn',
    });

    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: cluster.connections.securityGroups[0].securityGroupId,
      description: 'Database Security Group ID',
      exportName: 'QShelterDatabaseSecurityGroupId',
    });

    new cdk.CfnOutput(this, 'ValkeyEndpoint', {
      value: valkeyCluster.attrRedisEndpointAddress,
      description: 'Valkey (Redis) cluster endpoint',
      exportName: 'QShelterValkeyEndpoint',
    });

    new cdk.CfnOutput(this, 'ValkeyPort', {
      value: '6379',
      description: 'Valkey (Redis) cluster port',
      exportName: 'QShelterValkeyPort',
    });

    new cdk.CfnOutput(this, 'RolePoliciesTableName', {
      value: rolePoliciesTable.tableName,
      description: 'DynamoDB Role Policies Table Name',
      exportName: 'QShelterRolePoliciesTableName',
    });

    new cdk.CfnOutput(this, 'RolePoliciesTableArn', {
      value: rolePoliciesTable.tableArn,
      description: 'DynamoDB Role Policies Table ARN',
      exportName: 'QShelterRolePoliciesTableArn',
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: uploadsBucket.bucketName,
      description: 'S3 Uploads Bucket Name',
      exportName: 'QShelterUploadsBucketName',
    });

    new cdk.CfnOutput(this, 'UploadsBucketArn', {
      value: uploadsBucket.bucketArn,
      description: 'S3 Uploads Bucket ARN',
      exportName: 'QShelterUploadsBucketArn',
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: eventBus.eventBusName,
      description: 'EventBridge Event Bus Name',
      exportName: 'QShelterEventBusName',
    });

    new cdk.CfnOutput(this, 'EventBusArn', {
      value: eventBus.eventBusArn,
      description: 'EventBridge Event Bus ARN',
      exportName: 'QShelterEventBusArn',
    });

    new cdk.CfnOutput(this, 'LambdaServiceRoleArn', {
      value: lambdaServiceRole.roleArn,
      description: 'IAM Role ARN for Lambda functions',
      exportName: 'QShelterLambdaServiceRoleArn',
    });

    new cdk.CfnOutput(this, 'HttpApiId', {
      value: httpApi.ref,
      description: 'HTTP API Gateway ID',
      exportName: 'QShelterHttpApiId',
    });

    new cdk.CfnOutput(this, 'HttpApiEndpoint', {
      value: `https://${httpApi.ref}.execute-api.${cdk.Stack.of(this).region}.amazonaws.com`,
      description: 'HTTP API Gateway Endpoint',
      exportName: 'QShelterHttpApiEndpoint',
    });

    new cdk.CfnOutput(this, 'HttpApiExecutionArn', {
      value: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${httpApi.ref}/*`,
      description: 'HTTP API Gateway Execution ARN',
      exportName: 'QShelterHttpApiExecutionArn',
    });
  }
}

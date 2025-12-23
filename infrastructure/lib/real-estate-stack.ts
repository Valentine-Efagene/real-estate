import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

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

    // Shared environment variables for all Lambdas
    const sharedEnv = {
      NODE_ENV: 'production',
      DB_HOST: cluster.clusterEndpoint.hostname,
      DB_PORT: cluster.clusterEndpoint.port.toString(),
      DB_NAME: 'real_estate_db',
      DATABASE_SECRET_ARN: dbCredentials.secretArn,
      VALKEY_ENDPOINT: valkeyCluster.attrRedisEndpointAddress,
      VALKEY_PORT: '6379',
      AWS_REGION_NAME: cdk.Stack.of(this).region,
      ROLE_POLICIES_TABLE_NAME: rolePoliciesTable.tableName,
    };

    // === User Service Lambda ===
    const userServiceLambda = new lambda.Function(this, 'UserServiceLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'serverless.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/user-service'), {
        exclude: ['node_modules', 'test', 'dist'],
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c', [
              'npm install',
              'npm run build',
              'cp -r dist/* /asset-output/',
              'cp -r node_modules /asset-output/',
              'cp package.json /asset-output/',
            ].join(' && '),
          ],
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      environment: sharedEnv,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // === Mortgage Service Lambda ===
    const mortgageServiceLambda = new lambda.Function(this, 'MortgageServiceLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'serverless.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/mortgage-service'), {
        exclude: ['node_modules', 'test', 'dist'],
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c', [
              'npm install',
              'npm run build',
              'cp -r dist/* /asset-output/',
              'cp -r node_modules /asset-output/',
              'cp package.json /asset-output/',
            ].join(' && '),
          ],
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      environment: sharedEnv,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // === Property Service Lambda ===
    const propertyServiceLambda = new lambda.Function(this, 'PropertyServiceLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'serverless.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/property-service'), {
        exclude: ['node_modules', 'test', 'dist'],
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c', [
              'npm install',
              'npm run build',
              'cp -r dist/* /asset-output/',
              'cp -r node_modules /asset-output/',
              'cp package.json /asset-output/',
            ].join(' && '),
          ],
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      environment: sharedEnv,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to all Lambdas
    [userServiceLambda, mortgageServiceLambda, propertyServiceLambda].forEach(fn => {
      dbCredentials.grantRead(fn);
      cluster.connections.allowDefaultPortFrom(fn);
      rolePoliciesTable.grantReadWriteData(fn);
    });

    // === Lambda Authorizer ===
    const authorizerLambda = new lambda.Function(this, 'AuthorizerLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/authorizer-service'), {
        exclude: ['node_modules', 'test', 'dist'],
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c', [
              'npm install',
              'npm run build',
              'cp -r dist/* /asset-output/',
              'cp -r node_modules /asset-output/',
              'cp package.json /asset-output/',
            ].join(' && '),
          ],
        },
      }),
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
      environment: {
        ROLE_POLICIES_TABLE_NAME: rolePoliciesTable.tableName,
        JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        AWS_REGION_NAME: cdk.Stack.of(this).region,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant DynamoDB read access to authorizer
    rolePoliciesTable.grantReadData(authorizerLambda);

    // === API Gateway with Path-Based Routing ===
    const api = new apigateway.RestApi(this, 'RealEstateApi', {
      restApiName: 'Real Estate Microservices API',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Tenant-ID',
          'X-Tenant-Subdomain',
        ],
      },
    });

    // Configure Lambda authorizer
    const authorizer = new apigateway.TokenAuthorizer(this, 'JwtAuthorizer', {
      handler: authorizerLambda,
      identitySource: 'method.request.header.Authorization',
      resultsCacheTtl: cdk.Duration.minutes(5),
      authorizerName: 'JwtAuthorizer',
    });

    // User Service routes (/auth/*, /users/*, /roles/*, /permissions/*, /tenants/*)
    const authResource = api.root.addResource('auth');
    authResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(userServiceLambda),
      anyMethod: true,
    });

    const usersResource = api.root.addResource('users');
    usersResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(userServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    const rolesResource = api.root.addResource('roles');
    rolesResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(userServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    const permissionsResource = api.root.addResource('permissions');
    permissionsResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(userServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    const tenantsResource = api.root.addResource('tenants');
    tenantsResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(userServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    // Mortgage Service routes (/mortgages/*, /mortgage-types/*, /payments/*, /wallets/*)
    const mortgagesResource = api.root.addResource('mortgages');
    mortgagesResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(mortgageServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    const mortgageTypesResource = api.root.addResource('mortgage-types');
    mortgageTypesResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(mortgageServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    const paymentsResource = api.root.addResource('payments');
    paymentsResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(mortgageServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    const walletsResource = api.root.addResource('wallets');
    walletsResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(mortgageServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    // Property Service routes (/properties/*, /amenities/*, /qr-code/*)
    const propertiesResource = api.root.addResource('properties');
    propertiesResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(propertyServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    const amenitiesResource = api.root.addResource('amenities');
    amenitiesResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(propertyServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    const qrCodeResource = api.root.addResource('qr-code');
    qrCodeResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(propertyServiceLambda),
      anyMethod: true,
      defaultMethodOptions: {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
      },
    });

    // === Outputs ===
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserServiceLambdaArn', {
      value: userServiceLambda.functionArn,
      description: 'User Service Lambda ARN',
    });

    new cdk.CfnOutput(this, 'MortgageServiceLambdaArn', {
      value: mortgageServiceLambda.functionArn,
      description: 'Mortgage Service Lambda ARN',
    });

    new cdk.CfnOutput(this, 'PropertyServiceLambdaArn', {
      value: propertyServiceLambda.functionArn,
      description: 'Property Service Lambda ARN',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: dbCredentials.secretArn,
      description: 'Database credentials secret ARN',
    });

    new cdk.CfnOutput(this, 'ValkeyEndpoint', {
      value: valkeyCluster.attrRedisEndpointAddress,
      description: 'Valkey (Redis) cluster endpoint',
    });

    new cdk.CfnOutput(this, 'RolePoliciesTableName', {
      value: rolePoliciesTable.tableName,
      description: 'DynamoDB Role Policies Table Name',
    });

    new cdk.CfnOutput(this, 'AuthorizerLambdaArn', {
      value: authorizerLambda.functionArn,
      description: 'Lambda Authorizer ARN',
    });
  }
}

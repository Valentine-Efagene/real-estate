import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';

export class RealEstateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // === Networking ===
    const vpc = new ec2.Vpc(this, "AuthorizerVpc", {
      maxAzs: 2,
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
      defaultDatabaseName: "mediacraftdb",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    cluster.connections.allowDefaultPortFromAnyIpv4();

    // Get the database credentials
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

    // ECS Cluster
    const ecsCluster = new ecs.Cluster(this, 'RealEstateEcsCluster', {
      vpc,
    });

    // Application Load Balanced Fargate Service
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'RealEstateService', {
      cluster: ecsCluster,
      cpu: 512,
      desiredCount: 1,
      memoryLimitMiB: 1024,
      publicLoadBalancer: true,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('<your-account-id>.dkr.ecr.your-region.amazonaws.com/mediacraft-api:latest'), // change this
        containerPort: 3000,
        environment: {
          NODE_ENV: 'production',
          DATABASE_SECRET_ARN: dbCredentials.secretArn,
          DATABASE_CLUSTER_ARN: cluster.clusterArn,
          DATABASE_NAME: 'mediacraft',
          VALKEY_ENDPOINT: valkeyCluster.attrRedisEndpointAddress,
        },
      },
    });

    dbCredentials.grantRead(fargateService.taskDefinition.taskRole);
    cluster.grantDataApiAccess(fargateService.taskDefinition.taskRole);
  }
}

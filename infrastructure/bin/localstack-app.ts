#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LocalStackStack } from '../lib/localstack-stack';

/**
 * CDK App for LocalStack deployment
 * 
 * Usage:
 *   cd infrastructure
 *   cdklocal bootstrap  # One-time setup
 *   cdklocal deploy --context stage=test
 * 
 * Prerequisites:
 *   - npm install -g aws-cdk-local aws-cdk
 *   - LocalStack running (docker-compose up -d in local-dev)
 *   - local-dev/.env file with secrets
 */
const app = new cdk.App();

new LocalStackStack(app, 'QShelterLocalStack', {
    env: {
        account: '000000000000',
        region: 'us-east-1',
    },
});

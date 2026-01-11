/**
 * Lambda Entry Point for Policy Sync Service
 * 
 * Handles both:
 * 1. HTTP API requests (via API Gateway)
 * 2. SQS events (policy sync events)
 */

import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';
import { app } from './app';
import { sqsHandler } from './handlers/sqs-handler';

// Create the serverless express handler
const serverlessExpressInstance = serverlessExpress({ app });

/**
 * Main Lambda handler for HTTP API requests
 */
export const handler = (
    event: APIGatewayProxyEvent,
    context: Context,
    callback: Callback,
) => {
    console.log('[Lambda] HTTP request received');
    return serverlessExpressInstance(event, context, callback);
};

/**
 * SQS handler for policy sync events
 */
export { sqsHandler };

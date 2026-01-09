import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';
import { app } from './app';

// Re-export SQS handler for event-driven processing
export { handler as sqsHandler } from './handlers/sqs.handler';

// Create handler once - pass Express app directly, not app.listen()
const serverlessExpressInstance = serverlessExpress({ app });

export const handler = (
    event: APIGatewayProxyEvent,
    context: Context,
    callback: Callback,
) => {
    return serverlessExpressInstance(event, context, callback);
};

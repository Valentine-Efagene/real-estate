import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { setupAuth } from '@valentine-efagene/qshelter-common';
import { app } from './app';

// Re-export SQS handler for event-driven processing
export { handler as sqsHandler } from './handlers/sqs.handler';

let serverlessExpressInstance: any;

async function initialize() {
    await setupAuth();
    serverlessExpressInstance = serverlessExpress({ app });
    return serverlessExpressInstance;
}

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context,
): Promise<APIGatewayProxyResult> => {
    if (!serverlessExpressInstance) {
        await initialize();
    }
    return serverlessExpressInstance(event, context);
};

import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { setupAuth } from '@valentine-efagene/qshelter-common';
import { app } from './app';

// Export SQS handler for event-driven notifications
export { handler as sqsHandler } from './handlers/sqs.handler';

let serverlessExpressInstance: any;

async function setup() {
    await setupAuth();
    serverlessExpressInstance = serverlessExpress({ app });
    return serverlessExpressInstance;
}

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context,
): Promise<APIGatewayProxyResult> => {
    if (!serverlessExpressInstance) {
        await setup();
    }
    return serverlessExpressInstance(event, context);
};

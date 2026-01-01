import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { app } from './app';

let serverlessExpressInstance: any;

async function setup() {
    // Pass the Express app directly, not a running server
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

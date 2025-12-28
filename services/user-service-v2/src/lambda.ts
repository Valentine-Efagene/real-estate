import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { app } from './app.js';
import { loadConfig } from './lib/config.js';

let serverlessExpressInstance: any;

async function setup() {
    await loadConfig();
    const server = app.listen();
    serverlessExpressInstance = serverlessExpress({ app: server });
    return serverlessExpressInstance;
}

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    if (!serverlessExpressInstance) {
        await setup();
    }
    return serverlessExpressInstance(event, context);
};

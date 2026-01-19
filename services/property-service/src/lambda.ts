import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';
import { app } from './app';

// Create handler once - pass Express app directly, not app.listen()
const serverlessExpressInstance = serverlessExpress({ app });

export const handler = (
    event: APIGatewayProxyEvent,
    context: Context,
    callback: Callback,
) => {
    // DEBUG: Log the authorizer context from the event
    if (event.requestContext?.authorizer) {
        console.log('DEBUG: Authorizer context:', JSON.stringify(event.requestContext.authorizer, null, 2));
    } else {
        console.log('DEBUG: No authorizer context in event.requestContext');
    }
    return serverlessExpressInstance(event, context, callback);
};

import { Context, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import { AuthorizerService, SimpleAuthorizerResult } from './authorizer-service';

const authorizerService = new AuthorizerService();

export const handler = async (
    event: APIGatewayRequestAuthorizerEvent,
    context: Context
): Promise<SimpleAuthorizerResult> => {
    console.log('Authorizer invoked:', JSON.stringify({
        requestId: context.awsRequestId
    }));

    return authorizerService.authorize(event);
};

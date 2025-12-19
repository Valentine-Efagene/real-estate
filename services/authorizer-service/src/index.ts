import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { AuthorizerService } from './authorizer-service';

const authorizerService = new AuthorizerService();

export const handler = async (
    event: APIGatewayTokenAuthorizerEvent,
    context: Context
): Promise<APIGatewayAuthorizerResult> => {
    console.log('Authorizer invoked:', JSON.stringify({
        methodArn: event.methodArn,
        requestId: context.requestId
    }));

    return authorizerService.authorize(event);
};

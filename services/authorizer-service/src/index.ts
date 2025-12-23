import { APIGatewayAuthorizerResult, Context, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import { AuthorizerService } from './authorizer-service';

const authorizerService = new AuthorizerService();

export const handler = async (
    event: APIGatewayRequestAuthorizerEvent,
    context: Context
): Promise<APIGatewayAuthorizerResult> => {
    console.log('Authorizer invoked:', JSON.stringify({
        methodArn: event.methodArn,
        requestId: context.awsRequestId
    }));

    return authorizerService.authorize(event);
};

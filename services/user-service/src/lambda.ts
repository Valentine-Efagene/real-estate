import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { app } from './app';

let serverlessExpressInstance: any;

async function initialize() {
    serverlessExpressInstance = serverlessExpress({ app });
    return serverlessExpressInstance;
}

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context,
): Promise<APIGatewayProxyResult> => {
    injectAuthorizerHeaders(event);
    if (!serverlessExpressInstance) {
        await initialize();
    }
    return serverlessExpressInstance(event, context);
};

/**
 * Injects authorizer context from API Gateway as x-authorizer-* headers so
 * Express middleware can read them via extractAuthContext().
 * Handles both HTTP API v2 (context at authorizer.lambda) and REST API v1 (context at authorizer).
 */
function injectAuthorizerHeaders(event: APIGatewayProxyEvent): void {
    const authorizer = (event.requestContext as any)?.authorizer;
    const ctx = authorizer?.lambda ?? authorizer;
    if (!ctx || typeof ctx !== 'object') return;

    event.headers = event.headers ?? {};
    if (ctx.userId) event.headers['x-authorizer-user-id'] = String(ctx.userId);
    if (ctx.tenantId) event.headers['x-authorizer-tenant-id'] = String(ctx.tenantId);
    if (ctx.email) event.headers['x-authorizer-email'] = String(ctx.email);
    if (ctx.roles) event.headers['x-authorizer-roles'] = String(ctx.roles);
    if (ctx.orgRole) event.headers['x-authorizer-org-role'] = String(ctx.orgRole);
    if (ctx.orgRoles) event.headers['x-authorizer-org-roles'] = String(ctx.orgRoles);
    if (ctx.activeOrgId) event.headers['x-authorizer-active-org-id'] = String(ctx.activeOrgId);
    if (ctx.isPlatformOrg !== undefined) event.headers['x-authorizer-is-platform-org'] = String(ctx.isPlatformOrg);
}

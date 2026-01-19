import { Request, Response, NextFunction } from 'express';

// Try to import getCurrentInvoke from @codegenie/serverless-express
let getCurrentInvoke: (() => { event?: any; context?: any }) | null = null;
try {
    const serverlessExpress = require('@codegenie/serverless-express');
    getCurrentInvoke = serverlessExpress.getCurrentInvoke;
} catch {
    // Package not available
}

/**
 * Request logging middleware that logs method, path, status code, and duration.
 * Logs in JSON format for easy parsing by log aggregation tools.
 * 
 * In debug mode, also logs the authorizer context from API Gateway.
 */
export function requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const start = Date.now();

    // Debug: Log authorizer context structure
    if (process.env.DEBUG_AUTH === 'true' || process.env.NODE_ENV !== 'production') {
        let authorizer = null;
        let source = 'none';

        // Try getCurrentInvoke first (preferred for @codegenie/serverless-express)
        if (getCurrentInvoke) {
            const { event } = getCurrentInvoke();
            if (event?.requestContext?.authorizer) {
                authorizer = event.requestContext.authorizer;
                source = 'getCurrentInvoke';
            }
        }

        // Fallback to req.apiGateway (for other packages)
        if (!authorizer) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lambdaReq = req as any;
            if (lambdaReq.apiGateway?.event?.requestContext?.authorizer) {
                authorizer = lambdaReq.apiGateway.event.requestContext.authorizer;
                source = 'req.apiGateway';
            }
        }

        console.log(JSON.stringify({
            type: 'auth_debug',
            path: req.path,
            source,
            hasAuthorizer: !!authorizer,
            authorizerKeys: authorizer ? Object.keys(authorizer) : [],
            authorizer: authorizer,
        }));
    }

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
            JSON.stringify({
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration,
            }),
        );
    });

    next();
}

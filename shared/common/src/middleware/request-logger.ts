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
 * Fields to redact from request/response logging for security.
 */
const SENSITIVE_FIELDS = ['password', 'token', 'accessToken', 'refreshToken', 'secret', 'apiKey', 'credential'];

/**
 * Redact sensitive fields from an object for safe logging.
 */
function redactSensitive(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(redactSensitive);

    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
            redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            redacted[key] = redactSensitive(value);
        } else {
            redacted[key] = value;
        }
    }
    return redacted;
}

/**
 * Extract caller context from the request (authorizer or headers).
 */
function extractCaller(req: Request): { userId?: string; tenantId?: string; email?: string; roles?: string[] } {
    let authorizer: any = null;

    // Try getCurrentInvoke first
    if (getCurrentInvoke) {
        const { event } = getCurrentInvoke();
        if (event?.requestContext?.authorizer) {
            const auth = event.requestContext.authorizer;
            authorizer = auth.lambda || auth;
        }
    }

    // Fallback to req.apiGateway
    if (!authorizer) {
        const lambdaReq = req as any;
        if (lambdaReq.apiGateway?.event?.requestContext?.authorizer) {
            const auth = lambdaReq.apiGateway.event.requestContext.authorizer;
            authorizer = auth.lambda || auth;
        }
    }

    // Fallback to headers (for tests/local dev)
    if (!authorizer) {
        return {
            userId: req.headers['x-user-id'] as string,
            tenantId: req.headers['x-tenant-id'] as string,
            email: req.headers['x-user-email'] as string,
            roles: req.headers['x-user-roles'] ? (req.headers['x-user-roles'] as string).split(',') : undefined,
        };
    }

    return {
        userId: authorizer.userId,
        tenantId: authorizer.tenantId,
        email: authorizer.email,
        roles: authorizer.roles ? (typeof authorizer.roles === 'string' ? authorizer.roles.split(',') : authorizer.roles) : undefined,
    };
}

/**
 * Generate a unique request ID for correlation.
 */
function generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Request logging middleware that logs:
 * - HTTP method, path, status code, and duration
 * - Request body (with sensitive fields redacted)
 * - Caller info (userId, tenantId, email, roles)
 * - Response body (with sensitive fields redacted)
 * - Unique request ID for correlation
 * 
 * Logs in JSON format for easy parsing by CloudWatch/log aggregation tools.
 */
export function requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const start = Date.now();
    const requestId = generateRequestId();

    // Attach requestId to request for downstream use
    (req as any).requestId = requestId;

    // Extract caller info
    const caller = extractCaller(req);

    // Capture request body (redacted)
    const requestBody = req.body && Object.keys(req.body).length > 0
        ? redactSensitive(req.body)
        : undefined;

    // Log incoming request
    console.log(JSON.stringify({
        type: 'http_request',
        requestId,
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        caller: caller.userId ? caller : undefined,
        body: requestBody,
        timestamp: new Date().toISOString(),
    }));

    // Capture response body by intercepting res.json and res.send
    let responseBody: any = undefined;
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (body: any) {
        responseBody = body;
        return originalJson(body);
    };

    res.send = function (body: any) {
        // Only capture if it looks like JSON
        if (typeof body === 'object') {
            responseBody = body;
        } else if (typeof body === 'string') {
            try {
                responseBody = JSON.parse(body);
            } catch {
                // Not JSON, don't capture
            }
        }
        return originalSend(body);
    };

    res.on('finish', () => {
        const duration = Date.now() - start;

        // Determine log level based on status code
        const isError = res.statusCode >= 400;

        // Build response log
        const logEntry: Record<string, any> = {
            type: 'http_response',
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            caller: caller.userId ? { userId: caller.userId, tenantId: caller.tenantId } : undefined,
        };

        // Include response body for errors or when DEBUG_RESPONSE is set
        if (isError || process.env.DEBUG_RESPONSE === 'true') {
            logEntry.response = responseBody ? redactSensitive(responseBody) : undefined;
            // Also include request body for errors to aid debugging
            if (isError) {
                logEntry.request = requestBody;
            }
        }

        // Log with appropriate level
        if (res.statusCode >= 500) {
            console.error(JSON.stringify(logEntry));
        } else if (res.statusCode >= 400) {
            console.warn(JSON.stringify(logEntry));
        } else {
            console.log(JSON.stringify(logEntry));
        }
    });

    next();
}

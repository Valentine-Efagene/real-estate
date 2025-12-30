import { Request, Response, NextFunction } from 'express';

/**
 * Request logging middleware that logs method, path, status code, and duration.
 * Logs in JSON format for easy parsing by log aggregation tools.
 */
export function requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const start = Date.now();

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

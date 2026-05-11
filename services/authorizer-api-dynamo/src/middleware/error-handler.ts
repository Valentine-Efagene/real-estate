import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
    next(new AppError(404, 'Route not found'));
}

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    if (err instanceof ZodError) {
        return res.status(400).json({
            success: false,
            error: {
                message: 'Validation Error',
                details: err.issues,
            },
        });
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                details: err.details,
            },
        });
    }

    console.error('Unhandled error:', err);

    return res.status(500).json({
        success: false,
        error: {
            message: 'Internal Server Error',
        },
    });
}

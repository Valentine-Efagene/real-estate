import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

/**
 * Global error handler middleware for Express applications.
 * Handles ZodError, AppError, and generic errors with appropriate responses.
 */
export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) {
    if (err instanceof ZodError) {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            details: err.issues,
        });
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message,
        });
    }

    console.error('Unhandled error:', err);
    return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
    });
}

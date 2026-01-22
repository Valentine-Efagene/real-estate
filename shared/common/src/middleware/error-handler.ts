import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

/**
 * Extract a user-friendly field name from Prisma's target array.
 * Handles composite unique constraints like `tenantId_cacNumber`.
 */
function extractFieldName(target: string[]): string {
    // Filter out common fields that are not user-facing
    const userFacingFields = target.filter(
        (f) => !['tenantId', 'id', 'createdAt', 'updatedAt'].includes(f)
    );

    if (userFacingFields.length === 0) {
        // Fallback: use the last target field and make it readable
        const lastField = target[target.length - 1];
        return lastField.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    }

    // Convert camelCase to readable format
    return userFacingFields
        .map((f) => f.replace(/([A-Z])/g, ' $1').trim().toLowerCase())
        .join(', ');
}

/**
 * Handle Prisma-specific errors with user-friendly messages.
 */
function handlePrismaError(err: any): { statusCode: number; message: string } | null {
    // Check if this is a Prisma error (has code property)
    if (!err.code || typeof err.code !== 'string' || !err.code.startsWith('P')) {
        return null;
    }

    switch (err.code) {
        case 'P2002': {
            // Unique constraint violation
            const target = err.meta?.target as string[] | undefined;
            const modelName = err.meta?.modelName as string | undefined;

            if (target && target.length > 0) {
                const fieldName = extractFieldName(target);
                const entity = modelName || 'Record';
                return {
                    statusCode: 409,
                    message: `A ${entity.toLowerCase()} with this ${fieldName} already exists`,
                };
            }
            return {
                statusCode: 409,
                message: 'A record with these values already exists',
            };
        }

        case 'P2003': {
            // Foreign key constraint violation
            const field = err.meta?.field_name as string | undefined;
            return {
                statusCode: 400,
                message: field
                    ? `Referenced ${field.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} does not exist`
                    : 'Referenced record does not exist',
            };
        }

        case 'P2025': {
            // Record not found for update/delete
            return {
                statusCode: 404,
                message: 'Record not found',
            };
        }

        case 'P2014': {
            // Required relation violation
            return {
                statusCode: 400,
                message: 'This operation would violate a required relation',
            };
        }

        default:
            // Unknown Prisma error - log it but return generic message
            return null;
    }
}

/**
 * Global error handler middleware for Express applications.
 * Handles ZodError, AppError, Prisma errors, and generic errors with appropriate responses.
 */
export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) {
    // Handle Zod validation errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            error: 'Validation Error',
            details: err.issues,
        });
    }

    // Handle custom application errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            error: err.message,
        });
    }

    // Handle Prisma errors
    const prismaError = handlePrismaError(err);
    if (prismaError) {
        return res.status(prismaError.statusCode).json({
            success: false,
            message: prismaError.message,
            error: prismaError.message,
        });
    }

    // Unhandled error - log and return generic message
    console.error('Unhandled error:', err);
    return res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: 'Internal Server Error',
    });
}

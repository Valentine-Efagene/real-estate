import express, { Application, Request, Response, NextFunction } from 'express';
import {
    requestLogger,
    errorHandler,
    createTenantMiddleware,
    AppError,
} from '@valentine-efagene/qshelter-common';
import { ZodError } from 'zod';
import { prisma } from './lib/prisma';

// Routes
import walletRouter from './routes/wallet';
import webhookRouter from './routes/webhook';

export const app: Application = express();

// Set prisma client on app for routes to access
app.set('prisma', prisma);

app.use(express.json());
app.use(requestLogger);

// Health check (no auth required)
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'payment-service' });
});

// Webhook routes (no tenant middleware - verified by signature)
app.use('/webhooks', webhookRouter);

// Apply tenant middleware to authenticated routes
app.use(createTenantMiddleware({ prisma }));

// Authenticated routes
app.use('/wallets', walletRouter);

// Zod validation error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            details: err.issues,
        });
    }
    next(err);
});

app.use(errorHandler);

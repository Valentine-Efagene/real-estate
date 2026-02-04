import express, { Application, Request, Response, NextFunction } from 'express';
import {
    requestLogger,
    errorHandler,
    createTenantMiddleware,
    AppError,
} from '@valentine-efagene/qshelter-common';
import { ZodError } from 'zod';
import { prisma } from './lib/prisma';
import { generateOpenAPIDocument } from './config/swagger';

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

// OpenAPI JSON endpoint
app.get('/openapi.json', (_req, res) => {
    res.json(generateOpenAPIDocument());
});

// Swagger UI using CDN (works in serverless)
const getSwaggerHtml = () => {
    const openApiDocument = generateOpenAPIDocument();
    const specJson = JSON.stringify(openApiDocument);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - Payment Service</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            const url = new URL(window.location.href);
            const basePath = url.pathname.replace(/\\/api-docs\\/?$/, '');
            const currentPath = url.origin + basePath;
            
            const specString = ${JSON.stringify(specJson)};
            const spec = JSON.parse(specString);
            
            if (spec.servers && spec.servers[0]) {
                spec.servers[0].url = currentPath;
            }
            
            window.ui = SwaggerUIBundle({
                spec: spec,
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [SwaggerUIBundle.presets.apis]
            });
        };
    </script>
</body>
</html>`;
};

app.get('/api-docs', (_req, res) => res.send(getSwaggerHtml()));
app.get('/api-docs/', (_req, res) => res.send(getSwaggerHtml()));

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

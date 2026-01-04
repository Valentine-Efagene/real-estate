import express, { Application } from 'express';
import {
    requestLogger,
    errorHandler,
    createTenantMiddleware,
} from '@valentine-efagene/qshelter-common';
import { prisma } from './lib/prisma';

// Routes
import templateRouter from './routes/template';
import generateRouter from './routes/generate';

export const app: Application = express();

app.use(express.json());
app.use(requestLogger);

// Apply tenant middleware to extract tenant context from all requests
app.use(createTenantMiddleware({ prisma }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'documents-service' });
});

// OpenAPI JSON spec
app.get('/openapi.json', (req, res) => {
    res.json({
        openapi: '3.0.0',
        info: {
            title: 'Documents Service API',
            version: '1.0.0',
            description: 'API for document template management and generation',
        },
        paths: {
            '/templates': {
                get: { summary: 'List all templates', tags: ['Templates'] },
                post: { summary: 'Create a new template', tags: ['Templates'] },
            },
            '/templates/{id}': {
                get: { summary: 'Get template by ID', tags: ['Templates'] },
                patch: { summary: 'Update template', tags: ['Templates'] },
                delete: { summary: 'Delete template', tags: ['Templates'] },
            },
            '/templates/{id}/versions': {
                post: { summary: 'Create new template version', tags: ['Templates'] },
            },
            '/templates/code/{code}': {
                get: { summary: 'Get template by code', tags: ['Templates'] },
            },
            '/templates/validate': {
                post: { summary: 'Validate template syntax', tags: ['Templates'] },
            },
            '/templates/extract-fields': {
                post: { summary: 'Extract merge fields from template', tags: ['Templates'] },
            },
            '/generate': {
                post: { summary: 'Generate document from template', tags: ['Generation'] },
            },
            '/generate/offer-letter': {
                post: { summary: 'Generate offer letter', tags: ['Generation'] },
            },
            '/generate/preview': {
                post: { summary: 'Preview template with sample data', tags: ['Generation'] },
            },
        },
    });
});

// Swagger UI
app.get('/api-docs', (req, res) => {
    if (!req.originalUrl.endsWith('/')) {
        return res.redirect(301, req.originalUrl + '/');
    }
    res.send(getSwaggerHtml());
});

app.get('/api-docs/', (req, res) => {
    res.send(getSwaggerHtml());
});

function getSwaggerHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - Documents Service</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            const url = new URL(window.location.href);
            const basePath = url.pathname.replace(/\\/api-docs\\/?$/, '');
            const specUrl = url.origin + basePath + '/openapi.json';
            
            window.ui = SwaggerUIBundle({
                url: specUrl,
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [SwaggerUIBundle.presets.apis]
            });
        };
    </script>
</body>
</html>`;
}

// Routes
app.use('/templates', templateRouter);
app.use('/generate', generateRouter);

// Error handler
app.use(errorHandler);

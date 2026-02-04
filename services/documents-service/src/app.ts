import express, { Application } from 'express';
import {
    requestLogger,
    errorHandler,
    createTenantMiddleware,
} from '@valentine-efagene/qshelter-common';
import { prisma } from './lib/prisma';
import { generateOpenAPIDocument } from './config/swagger';

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
    res.json(generateOpenAPIDocument());
});

// Swagger UI
app.get('/api-docs', (_req, res) => {
    res.send(getSwaggerHtml());
});

app.get('/api-docs/', (_req, res) => {
    res.send(getSwaggerHtml());
});

function getSwaggerHtml(): string {
    const openApiDocument = generateOpenAPIDocument();
    const specJson = JSON.stringify(openApiDocument);

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
}

// Routes
app.use('/templates', templateRouter);
app.use('/generate', generateRouter);

// Error handler
app.use(errorHandler);

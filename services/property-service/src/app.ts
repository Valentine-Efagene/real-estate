import express, { Application } from 'express';
import {
    requestLogger,
    errorHandler,
    createTenantMiddleware,
} from '@valentine-efagene/qshelter-common';
import { propertyRouter } from './routes/property';
import { amenityRouter } from './routes/amenity';
import { variantRouter } from './routes/variant';
import { unitRouter } from './routes/unit';
import { generateOpenAPIDocument } from './config/swagger';
import { prisma } from './lib/prisma';

export const app: Application = express();

app.use(express.json());
app.use(requestLogger);

// Apply tenant middleware to extract tenant context from all requests
app.use(createTenantMiddleware({ prisma }));

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'property-service' });
});

// Swagger documentation - generate with dynamic base URL
app.get('/openapi.json', (_req, res) => {
    const openApiDocument = generateOpenAPIDocument();
    res.json(openApiDocument);
});

// Serve Swagger UI using CDN (works better in serverless)
app.get('/api-docs', (_req, res) => {
    const openApiDocument = generateOpenAPIDocument();
    const specJson = JSON.stringify(openApiDocument);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - Property Service</title>
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
    res.send(html);
});

// Match existing API Gateway paths (serverless.yml uses /property/*)
app.use('/property', propertyRouter);
app.use('/property', amenityRouter);
app.use('/property', variantRouter);
app.use('/property', unitRouter);

app.use(errorHandler);

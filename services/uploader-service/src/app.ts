import express, { Application } from 'express';
import { requestLogger, errorHandler } from '@valentine-efagene/qshelter-common';
import uploadRouter from './routes/upload';
import { generateOpenAPIDocument } from './config/openapi';

export const app: Application = express();

app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'uploader-service' });
});

// OpenAPI JSON spec
app.get('/openapi.json', (_req, res) => {
    const spec = generateOpenAPIDocument();
    res.json(spec);
});

// Swagger UI (CDN-based)
function getSwaggerHtml(): string {
    const spec = generateOpenAPIDocument();
    const specJson = JSON.stringify(spec);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - Uploader Service</title>
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

app.get('/api-docs', (_req, res) => {
    res.send(getSwaggerHtml());
});

app.get('/api-docs/', (_req, res) => {
    res.send(getSwaggerHtml());
});

// Routes
app.use('/upload', uploadRouter);

// Error handler
app.use(errorHandler);

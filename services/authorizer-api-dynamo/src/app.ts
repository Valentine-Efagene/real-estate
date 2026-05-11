import express from 'express';
import { generateOpenAPIDocument } from './config/swagger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { permissionRouter } from './routes/permissions';

const openApiDocument = generateOpenAPIDocument();

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            service: 'authorizer-api-dynamo',
        },
    });
});

app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
});

app.get(['/api-docs', '/api-docs/'], (_req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Permissions API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
        html, body, #swagger-ui {
            height: 100%;
            margin: 0;
        }

        body {
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            const spec = ${JSON.stringify(openApiDocument)};
            const url = new URL(window.location.href);
            const basePath = url.pathname.endsWith('/api-docs/')
                ? url.pathname.slice(0, -'/api-docs/'.length)
                : url.pathname.endsWith('/api-docs')
                  ? url.pathname.slice(0, -'/api-docs'.length)
                  : url.pathname;
            const currentPath = url.origin + basePath;

            if (spec.servers && spec.servers[0]) {
                spec.servers[0].url = currentPath || '/';
            }

            window.ui = SwaggerUIBundle({
                spec,
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [SwaggerUIBundle.presets.apis],
            });
        };
    </script>
</body>
</html>`;

    res.type('html').send(html);
});

app.use('/permissions', permissionRouter);

app.use(notFoundHandler);
app.use(errorHandler);

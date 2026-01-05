import express, { Application } from 'express';
import {
    requestLogger,
    errorHandler,
} from '@valentine-efagene/qshelter-common';
import { generateOpenAPIDocument } from './config/swagger';

// Routes
import emailRouter from './routes/email';
import smsRouter from './routes/sms';
import pushRouter from './routes/push';
import slackRouter from './routes/slack';
import whatsappRouter from './routes/whatsapp';

export const app: Application = express();

app.use(express.json());
app.use(requestLogger);

app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', service: 'notifications' });
});

// Swagger documentation - generate with dynamic base URL
app.get('/openapi.json', (_req, res) => {
    // Use empty string for server URL so Swagger UI uses relative paths from current origin
    const openApiDocument = generateOpenAPIDocument('');
    res.json(openApiDocument);
});

// Serve Swagger UI using CDN (works better in serverless)
app.get('/api-docs', (_req, res) => {
    // Generate spec with placeholder that will be replaced client-side
    const openApiDocument = generateOpenAPIDocument('__BASE_URL__');
    const specJson = JSON.stringify(openApiDocument);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - Notifications Service</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            // Build the base URL from current location, removing /api-docs and hash
            const url = new URL(window.location.href);
            const basePath = url.pathname.replace(/\\/api-docs\\/?$/, '');
            const currentPath = url.origin + basePath;
            
            // Parse the spec from JSON string
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

// Notification routes
app.use('/email', emailRouter);
app.use('/sms', smsRouter);
app.use('/push', pushRouter);
app.use('/slack', slackRouter);
app.use('/whatsapp', whatsappRouter);

app.use(errorHandler);

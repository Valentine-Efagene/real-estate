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
    // Generate spec inline to avoid CORS/fetch issues
    const openApiDocument = generateOpenAPIDocument('');
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
            // Use inline spec instead of fetching via URL
            const spec = ${specJson};
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

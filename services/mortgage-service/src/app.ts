import express, { Application } from 'express';
import {
  requestLogger,
  errorHandler,
  createTenantMiddleware,
} from '@valentine-efagene/qshelter-common';
import { generateOpenAPIDocument } from './config/swagger';
import { prisma } from './lib/prisma';

// New unified contract-based routes
import paymentPlanRouter from './routes/payment-plan';
import paymentMethodRouter from './routes/payment-method';
import contractRouter from './routes/contract';
import terminationRouter from './routes/contract-termination';
import offerLetterRouter from './routes/offer-letter';
import underwritingRouter from './routes/underwriting';
import paymentMethodChangeRouter from './routes/payment-method-change';
import eventConfigRouter from './routes/event-config';

export const app: Application = express();

// Set prisma client on app for routes to access
app.set('prisma', prisma);

app.use(express.json());
app.use(requestLogger);

// Apply tenant middleware to extract tenant context from all requests
app.use(createTenantMiddleware({ prisma }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mortgage-service' });
});

// OpenAPI JSON spec - no baseUrl, let client-side detect it
app.get('/openapi.json', (req, res) => {
  const openApiDocument = generateOpenAPIDocument();
  res.json(openApiDocument);
});

// CDN-based Swagger UI - works in Lambda without static file issues
app.get('/api-docs', (req, res) => {
  // Redirect to ensure trailing slash for relative paths
  if (!req.originalUrl.endsWith('/')) {
    return res.redirect(301, req.originalUrl + '/');
  }
  res.send(getSwaggerHtml());
});

app.get('/api-docs/', (req, res) => {
  res.send(getSwaggerHtml());
});

function getSwaggerHtml(): string {
  // Generate spec with placeholder for client-side URL replacement
  const spec = generateOpenAPIDocument('__BASE_URL__');
  const specString = JSON.stringify(spec).replace(/"/g, '\\"');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - QShelter Contract Service</title>
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
            const specString = "${specString}";
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

// New unified routes
app.use('/payment-plans', paymentPlanRouter);
app.use('/payment-methods', paymentMethodRouter);
app.use('/contracts', contractRouter);
app.use('/offer-letters', offerLetterRouter);
app.use('/underwriting', underwritingRouter);
app.use('/event-config', eventConfigRouter);
app.use('/', terminationRouter); // Handles both /contracts/:id/... and /terminations/...
app.use('/', paymentMethodChangeRouter); // Handles /contracts/:id/payment-method-change-requests and /payment-method-change-requests

app.use(errorHandler);

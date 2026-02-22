import express, { Application } from 'express';
import {
  requestLogger,
  errorHandler,
  createTenantMiddleware,
} from '@valentine-efagene/qshelter-common';
import { generateOpenAPIDocument } from './config/swagger';
import { prisma } from './lib/prisma';

// New unified application-based routes
import paymentPlanRouter from './routes/payment-plan';
import documentationPlanRouter from './routes/documentation-plan';
import questionnairePlanRouter from './routes/questionnaire-plan';
import paymentMethodRouter from './routes/payment-method';
import applicationRouter from './routes/application';
import terminationRouter from './routes/application-termination';
import offerLetterRouter from './routes/offer-letter';
import underwritingRouter from './routes/underwriting';
import paymentMethodChangeRouter from './routes/payment-method-change';
import propertyTransferRouter from './routes/property-transfer';
import approvalRequestRouter from './routes/approval-request';
import workflowBlockerRouter from './routes/workflow-blocker';
import organizationReviewsRouter from './routes/organization-reviews';
import qualificationFlowRouter from './routes/qualification-flow';
import gatePlanRouter from './routes/gate-plan';
import coApplicantRouter, { acceptByTokenRouter } from './routes/co-applicant';

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
function getSwaggerHtml(): string {
  const spec = generateOpenAPIDocument();
  const specJson = JSON.stringify(spec);
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - QShelter Mortgage Service</title>
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
}

app.get('/api-docs', (req, res) => {
  res.send(getSwaggerHtml());
});

app.get('/api-docs/', (req, res) => {
  res.send(getSwaggerHtml());
});

// New unified routes
app.use('/payment-plans', paymentPlanRouter);
app.use('/documentation-plans', documentationPlanRouter);
app.use('/questionnaire-plans', questionnairePlanRouter);
app.use('/payment-methods', paymentMethodRouter);
app.use('/qualification-flows', qualificationFlowRouter);
app.use('/gate-plans', gatePlanRouter);
app.use('/applications/:id/co-applicants', coApplicantRouter);
app.use('/applications', applicationRouter);
app.use('/co-applicant-invites', acceptByTokenRouter);
app.use('/offer-letters', offerLetterRouter);
app.use('/underwriting', underwritingRouter);
app.use('/approval-requests', approvalRequestRouter);
app.use('/workflow-blockers', workflowBlockerRouter);
app.use('/', organizationReviewsRouter); // Handles /organizations/:orgId/pending-reviews and /organizations/:orgId/document-requirements
app.use('/', terminationRouter); // Handles both /applications/:id/... and /terminations/...
app.use('/', paymentMethodChangeRouter); // Handles /applications/:id/payment-method-change-requests and /payment-method-change-requests
app.use('/', propertyTransferRouter); // Handles /applications/:id/transfer-requests and /transfer-requests

app.use(errorHandler);

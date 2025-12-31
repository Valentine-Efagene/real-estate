import express, { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
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
import prequalificationRouter from './routes/prequalification';

export const app: Application = express();

app.use(express.json());
app.use(requestLogger);

// Apply tenant middleware to extract tenant context from all requests
app.use(createTenantMiddleware({ prisma }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'mortgage-service' });
});

// Swagger documentation
const openApiDocument = generateOpenAPIDocument();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get('/openapi.json', (req, res) => {
  res.json(openApiDocument);
});

// New unified routes
app.use('/payment-plans', paymentPlanRouter);
app.use('/payment-methods', paymentMethodRouter);
app.use('/contracts', contractRouter);
app.use('/prequalifications', prequalificationRouter);

app.use(errorHandler);

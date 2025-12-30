import express, { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { generateOpenAPIDocument } from './config/swagger.js';

// New unified contract-based routes
import paymentPlanRouter from './routes/payment-plan.js';
import paymentMethodRouter from './routes/payment-method.js';
import contractRouter from './routes/contract.js';

export const app: Application = express();

app.use(express.json());
app.use(requestLogger);

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

app.use(errorHandler);

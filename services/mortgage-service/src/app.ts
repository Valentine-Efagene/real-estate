import express, { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { mortgageRouter } from './routes/mortgage.js';
import { generateOpenAPIDocument } from './config/swagger.js';

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

// Match existing API Gateway paths (serverless.yml uses /mortgage/*)
app.use('/mortgage', mortgageRouter);

app.use(errorHandler);

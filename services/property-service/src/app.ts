import express, { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { propertyRouter } from './routes/property.js';
import { amenityRouter } from './routes/amenity.js';
import { generateOpenAPIDocument } from './config/swagger.js';

export const app: Application = express();

app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'property-service' });
});

// Swagger documentation
const openApiDocument = generateOpenAPIDocument();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get('/openapi.json', (req, res) => {
    res.json(openApiDocument);
});

// Match existing API Gateway paths (serverless.yml uses /property/*)
app.use('/property', propertyRouter);
app.use('/property', amenityRouter);

app.use(errorHandler);

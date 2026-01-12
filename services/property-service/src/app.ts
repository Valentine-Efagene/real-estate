import express, { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import {
    requestLogger,
    errorHandler,
    createTenantMiddleware,
} from '@valentine-efagene/qshelter-common';
import { propertyRouter } from './routes/property';
import { amenityRouter } from './routes/amenity';
import { variantRouter } from './routes/variant';
import { unitRouter } from './routes/unit';
import { generateOpenAPIDocument } from './config/swagger';
import { prisma } from './lib/prisma';

export const app: Application = express();

app.use(express.json());
app.use(requestLogger);

// Apply tenant middleware to extract tenant context from all requests
app.use(createTenantMiddleware({ prisma }));

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
app.use('/property', variantRouter);
app.use('/property', unitRouter);

app.use(errorHandler);

import express, { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
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

// Swagger documentation
const openApiDocument = generateOpenAPIDocument();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
});

// Notification routes
app.use('/email', emailRouter);
app.use('/sms', smsRouter);
app.use('/push', pushRouter);
app.use('/slack', slackRouter);
app.use('/whatsapp', whatsappRouter);

app.use(errorHandler);

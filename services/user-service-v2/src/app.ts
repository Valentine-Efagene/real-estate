import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/users';
import { roleRouter } from './routes/roles';
import { tenantRouter } from './routes/tenants';
import { socialRouter } from './routes/socials';
import { apiKeyRouter } from './routes/api-keys';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { generateOpenAPIDocument } from './config/swagger';

export const app = express();

app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'user-service-v2' });
});

// Swagger documentation
const openApiDocument = generateOpenAPIDocument();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get('/openapi.json', (req, res) => {
    res.json(openApiDocument);
});

app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/roles', roleRouter);
app.use('/tenants', tenantRouter);
app.use('/socials', socialRouter);
app.use('/api-keys', apiKeyRouter);

app.use(errorHandler);

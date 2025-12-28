import express from 'express';
import { authRouter } from './routes/auth.js';
import { userRouter } from './routes/users.js';
import { roleRouter } from './routes/roles.js';
import { tenantRouter } from './routes/tenants.js';
import { socialRouter } from './routes/socials.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';

export const app = express();

app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'user-service-v2' });
});

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/roles', roleRouter);
app.use('/api/tenants', tenantRouter);
app.use('/api/socials', socialRouter);

app.use(errorHandler);

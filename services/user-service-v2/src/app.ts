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

app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/roles', roleRouter);
app.use('/tenants', tenantRouter);
app.use('/socials', socialRouter);

app.use(errorHandler);

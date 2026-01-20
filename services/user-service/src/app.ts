import express from 'express';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/users';
import { roleRouter } from './routes/roles';
import { permissionRouter } from './routes/permissions';
import { tenantRouter } from './routes/tenants';
import { tenantMembershipRouter } from './routes/tenant-memberships';
import { socialRouter } from './routes/socials';
import { apiKeyRouter } from './routes/api-keys';
import { adminRouter } from './routes/admin';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { generateOpenAPIDocument } from './config/swagger';

export const app = express();

app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'user-service-v2' });
});

// Swagger documentation - generate with dynamic base URL
app.get('/openapi.json', (_req, res) => {
    // Use empty string for server URL so Swagger UI uses relative paths from current origin
    const openApiDocument = generateOpenAPIDocument();
    res.json(openApiDocument);
});

// Serve Swagger UI using CDN (works better in serverless)
app.get('/api-docs', (_req, res) => {
    const openApiDocument = generateOpenAPIDocument();
    const specJson = JSON.stringify(openApiDocument);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - User Service</title>
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
    res.send(html);
});

app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/roles', roleRouter);
app.use('/permissions', permissionRouter);
app.use('/tenants', tenantRouter);
app.use('/socials', socialRouter);
app.use('/api-keys', apiKeyRouter);
app.use('/admin', adminRouter);

// Tenant membership routes (handles both /tenants/:id/members and /users/:id/tenants)
app.use(tenantMembershipRouter);

app.use(errorHandler);

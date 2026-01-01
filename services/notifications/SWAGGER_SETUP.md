# Swagger UI Setup for Serverless

## Problem

`swagger-ui-express` **does not work** in serverless Lambda environments because:

1. API Gateway Lambda proxy routes ALL requests through the handler
2. Static file middleware (`express.static`) cannot serve `.js` and `.css` files properly
3. All requests return HTML instead of the actual static assets
4. This is a fundamental limitation of API Gateway + Lambda

## Solution: CDN-based Swagger UI with Inline Spec

Use Swagger UI from CDN and embed the OpenAPI spec directly in the HTML.

### Implementation

```typescript
// app.ts
import { generateOpenAPIDocument } from './config/swagger';

// Separate endpoint for JSON spec (optional, for external tools)
app.get('/openapi.json', (_req, res) => {
  const openApiDocument = generateOpenAPIDocument('');
  res.json(openApiDocument);
});

// Swagger UI with inline spec
app.get('/api-docs', (_req, res) => {
  const openApiDocument = generateOpenAPIDocument('');
  const specJson = JSON.stringify(openApiDocument);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - Service Name</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            const spec = ${specJson};
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
```

### Swagger Config

```typescript
// config/swagger.ts
export function generateOpenAPIDocument(baseUrl?: string) {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Service Name API',
      version: '1.0.0',
      description: 'Service description',
    },
    servers:
      baseUrl !== undefined
        ? [{ url: baseUrl, description: 'Current environment' }]
        : [{ url: 'http://localhost:3000', description: 'Local development' }],
  });
}
```

**Important**:

- Use `baseUrl !== undefined` not `baseUrl` to allow empty string `''` as valid value
- Pass empty string `''` for serverless to use relative URLs
- The Swagger UI will show "- Current Environment" without displaying the URL - this is correct
- Empty server URL tells Swagger UI to make requests relative to the current page URL

## Benefits

✅ Smaller package size (no bundling swagger-ui-dist static files)
✅ Faster loads (CDN cached globally)
✅ Works reliably through API Gateway
✅ No CORS issues (spec embedded in page)
✅ No URL resolution problems
✅ Relative URLs work regardless of actual deployment URL (LocalStack, AWS, etc.)

## LocalStack Deployment

After deploying with serverless-localstack, manually create the API Gateway stage:

```bash
DEPLOY_ID=$(aws --endpoint-url=http://localhost:4566 apigateway get-deployments \
  --rest-api-id <API_ID> --query 'items[0].id' --output text)

aws --endpoint-url=http://localhost:4566 apigateway create-stage \
  --rest-api-id <API_ID> --stage-name test --deployment-id "$DEPLOY_ID"
```

## Do NOT

❌ Install `swagger-ui-express` - it won't work
❌ Try to bundle `node_modules/swagger-ui-dist/**` - static serving broken
❌ Use `swaggerUi.serve` or `swaggerUi.setup()` - designed for traditional Express servers
❌ Fetch spec via URL in browser - can cause CORS/path resolution issues in Lambda

## Apply to Other Services

When setting up Swagger in other services (property, mortgage, user-v2), use this exact pattern:

1. CDN for Swagger UI CSS/JS
2. Inline spec embedded in HTML
3. Empty string `''` for server URL to use relative paths

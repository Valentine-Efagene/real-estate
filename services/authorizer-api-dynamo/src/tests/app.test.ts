import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { app } from '../app';

describe('app endpoints', () => {
  it('returns a healthy status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
  });

  it('serves the OpenAPI document', async () => {
    const response = await request(app).get('/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body.info.title).toBe('Permissions API');
    expect(response.body.paths['/permissions']).toBeDefined();
  });

  it('serves the Swagger UI page', async () => {
    const response = await request(app).get('/api-docs');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('SwaggerUIBundle');
    expect(response.text).toContain('swagger-ui');
    expect(response.text).toContain('https://unpkg.com/swagger-ui-dist@5/swagger-ui.css');
  });

  it('loads the local dotenv values before resolving the DynamoDB table name', () => {
    const script = `
      import express from 'express';
      express.application.listen = function (_port, cb) {
        if (cb) cb();
        return { close() {} };
      };
      await import('./src/local.ts');
      const mod = await import('./src/lib/dynamodb.ts');
      console.log(mod.permissionsTableName);
    `;

    const output = execFileSync('node', ['--import', 'tsx', '--eval', script], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();

    expect(output).toContain('RolePolicies');
  });
});
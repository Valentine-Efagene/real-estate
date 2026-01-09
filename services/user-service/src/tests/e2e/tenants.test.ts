import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { setupTests, cleanDatabase, prisma } from './setup';

describe('Tenant E2E Tests', () => {
    beforeAll(async () => {
        await setupTests();
    });

    beforeEach(async () => {
        await cleanDatabase();
        await setupTests();
    });

    afterAll(async () => {
        await cleanDatabase();
        await prisma.$disconnect();
    });

    describe('GET /tenants', () => {
        it('should list all tenants', async () => {
            const response = await request(app)
                .get('/tenants')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThanOrEqual(1); // Seeded tenant
        });
    });

    describe('POST /tenants', () => {
        it('should create a new tenant', async () => {
            const tenantData = {
                name: 'Test Tenant ' + Date.now(),
                subdomain: 'test-tenant-' + Date.now(),
            };

            const response = await request(app)
                .post('/tenants')
                .send(tenantData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(tenantData.name);
            expect(response.body.data.subdomain).toBe(tenantData.subdomain);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.isActive).toBe(true);
        });

        it('should fail with duplicate subdomain', async () => {
            const subdomain = 'unique-sub-' + Date.now();

            // Create first tenant
            await prisma.tenant.create({
                data: { name: 'First Tenant', subdomain },
            });

            // Try to create second with same subdomain
            const response = await request(app)
                .post('/tenants')
                .send({ name: 'Second Tenant', subdomain })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should fail without required fields', async () => {
            const response = await request(app)
                .post('/tenants')
                .send({ name: 'Missing Subdomain' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /tenants/:id', () => {
        it('should get a tenant by ID', async () => {
            const tenant = await prisma.tenant.findFirst();

            const response = await request(app)
                .get(`/tenants/${tenant!.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(tenant!.id);
        });

        it('should return 404 for non-existent tenant', async () => {
            const response = await request(app)
                .get('/tenants/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /tenants/subdomain/:subdomain', () => {
        it('should get a tenant by subdomain', async () => {
            const subdomain = 'lookup-test-' + Date.now();
            await prisma.tenant.create({
                data: { name: 'Lookup Test', subdomain },
            });

            const response = await request(app)
                .get(`/tenants/subdomain/${subdomain}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.subdomain).toBe(subdomain);
        });

        it('should return 404 for non-existent subdomain', async () => {
            const response = await request(app)
                .get('/tenants/subdomain/non-existent-subdomain')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /tenants/:id', () => {
        it('should update tenant name', async () => {
            const tenant = await prisma.tenant.create({
                data: { name: 'Original Name', subdomain: 'orig-' + Date.now() },
            });

            const response = await request(app)
                .put(`/tenants/${tenant.id}`)
                .send({ name: 'Updated Name' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Updated Name');
        });

        it('should update tenant subdomain', async () => {
            const tenant = await prisma.tenant.create({
                data: { name: 'Subdomain Test', subdomain: 'old-sub-' + Date.now() },
            });

            const newSubdomain = 'new-sub-' + Date.now();
            const response = await request(app)
                .put(`/tenants/${tenant.id}`)
                .send({ subdomain: newSubdomain })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.subdomain).toBe(newSubdomain);
        });

        it('should deactivate a tenant', async () => {
            const tenant = await prisma.tenant.create({
                data: { name: 'Active Tenant', subdomain: 'active-' + Date.now() },
            });

            const response = await request(app)
                .put(`/tenants/${tenant.id}`)
                .send({ isActive: false })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.isActive).toBe(false);
        });

        it('should return 404 for non-existent tenant', async () => {
            const response = await request(app)
                .put('/tenants/non-existent-id')
                .send({ name: 'New Name' })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /tenants/:id', () => {
        it('should delete a tenant', async () => {
            const tenant = await prisma.tenant.create({
                data: { name: 'Deletable', subdomain: 'delete-' + Date.now() },
            });

            await request(app)
                .delete(`/tenants/${tenant.id}`)
                .expect(204);

            // Verify tenant is deleted
            const deletedTenant = await prisma.tenant.findUnique({
                where: { id: tenant.id },
            });
            expect(deletedTenant).toBeNull();
        });

        it('should return 404 for non-existent tenant', async () => {
            await request(app)
                .delete('/tenants/non-existent-id')
                .expect(404);
        });
    });
});

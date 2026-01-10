import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { setupTests, cleanDatabase, prisma } from './setup';

describe('Role E2E Tests', () => {
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

    describe('GET /roles', () => {
        it('should list all roles', async () => {
            const response = await request(app)
                .get('/roles')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThanOrEqual(5); // Default seeded roles
        });

        it('should include seeded roles', async () => {
            const response = await request(app)
                .get('/roles')
                .expect(200);

            const roleNames = response.body.data.map((r: any) => r.name);
            expect(roleNames).toContain('admin');
            expect(roleNames).toContain('user');
        });
    });

    describe('POST /roles', () => {
        it('should create a new role', async () => {
            const roleData = {
                name: 'test-role-' + Date.now(),
                description: 'A test role for E2E tests',
            };

            const response = await request(app)
                .post('/roles')
                .send(roleData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(roleData.name);
            expect(response.body.data.description).toBe(roleData.description);
            expect(response.body.data).toHaveProperty('id');
        });

        it('should create role without description', async () => {
            const roleData = {
                name: 'minimal-role-' + Date.now(),
            };

            const response = await request(app)
                .post('/roles')
                .send(roleData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(roleData.name);
        });

        it('should fail with duplicate role name', async () => {
            const existingRole = await prisma.role.findFirst({ where: { name: 'admin' } });
            expect(existingRole).not.toBeNull();

            const response = await request(app)
                .post('/roles')
                .send({ name: 'admin' })
                .expect(409); // Conflict for duplicate

            expect(response.body.success).toBe(false);
        });

        it('should fail without name', async () => {
            const response = await request(app)
                .post('/roles')
                .send({ description: 'No name provided' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /roles/:id', () => {
        it('should get a role by ID', async () => {
            const role = await prisma.role.findFirst({ where: { name: 'admin' } });

            const response = await request(app)
                .get(`/roles/${role!.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(role!.id);
            expect(response.body.data.name).toBe('admin');
        });

        it('should return 404 for non-existent role', async () => {
            const response = await request(app)
                .get('/roles/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /roles/:id', () => {
        it('should update role name', async () => {
            // Create a test role first
            const role = await prisma.role.create({
                data: { name: 'updateable-role-' + Date.now() },
            });

            const response = await request(app)
                .put(`/roles/${role.id}`)
                .send({ name: 'updated-role-name' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('updated-role-name');
        });

        it('should update role description', async () => {
            const role = await prisma.role.create({
                data: { name: 'role-with-desc-' + Date.now() },
            });

            const response = await request(app)
                .put(`/roles/${role.id}`)
                .send({ description: 'New description' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.description).toBe('New description');
        });

        it('should return 404 for non-existent role', async () => {
            const response = await request(app)
                .put('/roles/non-existent-id')
                .send({ name: 'new-name' })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /roles/:id', () => {
        it('should delete a role', async () => {
            // Create a role to delete
            const role = await prisma.role.create({
                data: { name: 'deletable-role-' + Date.now() },
            });

            await request(app)
                .delete(`/roles/${role.id}`)
                .expect(204);

            // Verify role is deleted
            const deletedRole = await prisma.role.findUnique({
                where: { id: role.id },
            });
            expect(deletedRole).toBeNull();
        });

        it('should return 404 for non-existent role', async () => {
            await request(app)
                .delete('/roles/non-existent-id')
                .expect(404);
        });
    });
});

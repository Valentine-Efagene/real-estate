import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { setupTests, cleanDatabase, prisma } from './setup';

describe('User E2E Tests', () => {
    let testUser: any;
    let testRole: any;

    beforeAll(async () => {
        await setupTests();
    });

    beforeEach(async () => {
        await cleanDatabase();
        await setupTests();

        // Create a test user directly in DB
        testUser = await prisma.user.create({
            data: {
                email: faker.internet.email(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                password: 'hashed_password_placeholder',
                isActive: true,
                isEmailVerified: true,
            },
        });

        // Get a test role (seeded from setup)
        testRole = await prisma.role.findFirst({ where: { name: 'user' } });
    });

    afterAll(async () => {
        await cleanDatabase();
        await prisma.$disconnect();
    });

    describe('GET /users', () => {
        it('should list all users', async () => {
            const response = await request(app)
                .get('/users')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('data');
            expect(Array.isArray(response.body.data.data)).toBe(true);
            expect(response.body.data.data.length).toBeGreaterThanOrEqual(1);
        });

        it('should paginate users', async () => {
            // Create additional users
            await prisma.user.createMany({
                data: [
                    { email: faker.internet.email(), firstName: 'User1', lastName: 'Test', password: 'pass' },
                    { email: faker.internet.email(), firstName: 'User2', lastName: 'Test', password: 'pass' },
                    { email: faker.internet.email(), firstName: 'User3', lastName: 'Test', password: 'pass' },
                ],
            });

            const response = await request(app)
                .get('/users?page=1&limit=2')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.data.length).toBeLessThanOrEqual(2);
            expect(response.body.data).toHaveProperty('meta');
        });

        it('should filter users by firstName', async () => {
            const uniqueName = 'uniquetestname' + Date.now(); // Use lowercase since mode:insensitive may fail on MySQL
            await prisma.user.create({
                data: {
                    email: faker.internet.email(),
                    firstName: uniqueName,
                    lastName: 'Test',
                    password: 'pass',
                },
            });

            const response = await request(app)
                .get(`/users?firstName=${uniqueName}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.data.length).toBeGreaterThanOrEqual(1);
            expect(response.body.data.data.some((u: any) => u.firstName === uniqueName)).toBe(true);
        });
    });

    describe('GET /users/:id', () => {
        it('should get a single user by ID', async () => {
            const response = await request(app)
                .get(`/users/${testUser.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(testUser.id);
            expect(response.body.data.email).toBe(testUser.email);
        });

        it('should return 404 for non-existent user', async () => {
            const response = await request(app)
                .get('/users/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /users/:id', () => {
        it('should update user details', async () => {
            const updateData = {
                firstName: 'UpdatedFirst',
                lastName: 'UpdatedLast',
                phone: '+1234567890',
            };

            const response = await request(app)
                .put(`/users/${testUser.id}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.firstName).toBe('UpdatedFirst');
            expect(response.body.data.lastName).toBe('UpdatedLast');
            expect(response.body.data.phone).toBe('+1234567890');
        });

        it('should update isActive status', async () => {
            const response = await request(app)
                .put(`/users/${testUser.id}`)
                .send({ isActive: false })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.isActive).toBe(false);
        });
    });

    describe('PUT /users/:id/avatar', () => {
        it('should update user avatar', async () => {
            const avatarUrl = 'https://example.com/avatar.jpg';

            const response = await request(app)
                .put(`/users/${testUser.id}/avatar`)
                .send({ avatarUrl })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.avatar).toBe(avatarUrl);
        });

        it('should reject invalid avatar URL', async () => {
            const response = await request(app)
                .put(`/users/${testUser.id}/avatar`)
                .send({ avatarUrl: 'not-a-url' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /users/:id/suspend', () => {
        it('should suspend a user', async () => {
            const response = await request(app)
                .post(`/users/${testUser.id}/suspend`)
                .send({ reason: 'Violation of terms' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.isActive).toBe(false);
        });

        it('should suspend user without reason', async () => {
            const response = await request(app)
                .post(`/users/${testUser.id}/suspend`)
                .send({})
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.isActive).toBe(false);
        });
    });

    describe('POST /users/:id/reinstate', () => {
        it('should reinstate a suspended user', async () => {
            // First suspend the user
            await prisma.user.update({
                where: { id: testUser.id },
                data: { isActive: false },
            });

            const response = await request(app)
                .post(`/users/${testUser.id}/reinstate`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.isActive).toBe(true);
        });
    });

    describe('PUT /users/:id/roles', () => {
        it('should assign roles to a user', async () => {
            const response = await request(app)
                .put(`/users/${testUser.id}/roles`)
                .send({ roleIds: [testRole.id] })
                .expect(200);

            expect(response.body.success).toBe(true);
            // tenantMemberships is an array of { role: { id, name, description } }
            expect(response.body.data.tenantMemberships).toContainEqual(
                expect.objectContaining({
                    role: expect.objectContaining({ id: testRole.id })
                })
            );
        });

        it('should replace existing roles', async () => {
            // First assign a role
            await request(app)
                .put(`/users/${testUser.id}/roles`)
                .send({ roleIds: [testRole.id] })
                .expect(200);

            // Get admin role
            const adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });

            // Replace with admin role
            const response = await request(app)
                .put(`/users/${testUser.id}/roles`)
                .send({ roleIds: [adminRole!.id] })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.tenantMemberships).toHaveLength(1);
            expect(response.body.data.tenantMemberships[0].role.id).toBe(adminRole!.id);
        });
    });

    describe('DELETE /users/:id', () => {
        it('should delete a user', async () => {
            await request(app)
                .delete(`/users/${testUser.id}`)
                .expect(204);

            // Verify user is deleted
            const deletedUser = await prisma.user.findUnique({
                where: { id: testUser.id },
            });
            expect(deletedUser).toBeNull();
        });

        it('should return 404 for non-existent user', async () => {
            await request(app)
                .delete('/users/non-existent-id')
                .expect(404);
        });
    });
});

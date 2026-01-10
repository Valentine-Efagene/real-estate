import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { setupTests, cleanDatabase, prisma } from './setup';

describe('Social E2E Tests', () => {
    let testUser: any;

    beforeAll(async () => {
        await setupTests();
    });

    beforeEach(async () => {
        await cleanDatabase();
        await setupTests();
        
        // Create a test user
        testUser = await prisma.user.create({
            data: {
                email: faker.internet.email(),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                password: 'test_password',
                isActive: true,
            },
        });
    });

    afterAll(async () => {
        await cleanDatabase();
        await prisma.$disconnect();
    });

    describe('GET /socials/user/:userId', () => {
        it('should list all social profiles for a user', async () => {
            // Create social profiles for the user
            await prisma.social.createMany({
                data: [
                    { userId: testUser.id, provider: 'google', socialId: 'google-123' },
                    { userId: testUser.id, provider: 'facebook', socialId: 'fb-456' },
                ],
            });

            const response = await request(app)
                .get(`/socials/user/${testUser.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBe(2);
        });

        it('should return empty array for user with no social profiles', async () => {
            const response = await request(app)
                .get(`/socials/user/${testUser.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
        });
    });

    describe('POST /socials', () => {
        it('should create a new social profile', async () => {
            const socialData = {
                userId: testUser.id,
                provider: 'google',
                socialId: 'google-unique-id',
            };

            const response = await request(app)
                .post('/socials')
                .send(socialData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.provider).toBe('google');
            expect(response.body.data.socialId).toBe('google-unique-id');
            expect(response.body.data.userId).toBe(testUser.id);
        });

        it('should fail without required fields', async () => {
            const response = await request(app)
                .post('/socials')
                .send({ provider: 'google' }) // Missing userId and socialId
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /socials/:id', () => {
        it('should get a social profile by ID', async () => {
            const social = await prisma.social.create({
                data: { userId: testUser.id, provider: 'twitter', socialId: 'twitter-123' },
            });

            const response = await request(app)
                .get(`/socials/${social.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(social.id);
            expect(response.body.data.provider).toBe('twitter');
        });

        it('should return 404 for non-existent social profile', async () => {
            const response = await request(app)
                .get('/socials/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /socials/:id', () => {
        it('should update social profile provider', async () => {
            const social = await prisma.social.create({
                data: { userId: testUser.id, provider: 'old-provider', socialId: 'social-123' },
            });

            const response = await request(app)
                .put(`/socials/${social.id}`)
                .send({ provider: 'new-provider' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.provider).toBe('new-provider');
        });

        it('should update social ID', async () => {
            const social = await prisma.social.create({
                data: { userId: testUser.id, provider: 'google', socialId: 'old-id' },
            });

            const response = await request(app)
                .put(`/socials/${social.id}`)
                .send({ socialId: 'new-id' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.socialId).toBe('new-id');
        });

        it('should return 404 for non-existent social profile', async () => {
            const response = await request(app)
                .put('/socials/non-existent-id')
                .send({ provider: 'updated' })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /socials/:id', () => {
        it('should delete a social profile', async () => {
            const social = await prisma.social.create({
                data: { userId: testUser.id, provider: 'deletable', socialId: 'delete-123' },
            });

            await request(app)
                .delete(`/socials/${social.id}`)
                .expect(204);

            // Verify deletion
            const deleted = await prisma.social.findUnique({
                where: { id: social.id },
            });
            expect(deleted).toBeNull();
        });

        it('should return 404 for non-existent social profile', async () => {
            await request(app)
                .delete('/socials/non-existent-id')
                .expect(404);
        });
    });
});

import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { setupTests, cleanDatabase, prisma } from './setup';

describe('Social Profile E2E Tests', () => {
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
                password: 'hashed_password',
                isActive: true,
            },
        });
    });

    afterAll(async () => {
        await cleanDatabase();
        await prisma.$disconnect();
    });

    describe('GET /socials/user/:userId', () => {
        it('should return empty array for user with no social profiles', async () => {
            const response = await request(app)
                .get(`/socials/user/${testUser.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
        });

        it('should list all social profiles for a user', async () => {
            // Create social profiles
            await prisma.socialProfile.createMany({
                data: [
                    { userId: testUser.id, provider: 'google', socialId: 'google-123' },
                    { userId: testUser.id, provider: 'facebook', socialId: 'fb-456' },
                ],
            });

            const response = await request(app)
                .get(`/socials/user/${testUser.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data.map((s: any) => s.provider)).toContain('google');
            expect(response.body.data.map((s: any) => s.provider)).toContain('facebook');
        });
    });

    describe('POST /socials', () => {
        it('should create a social profile', async () => {
            const socialData = {
                userId: testUser.id,
                provider: 'google',
                socialId: 'google-unique-id-' + Date.now(),
            };

            const response = await request(app)
                .post('/socials')
                .send(socialData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.provider).toBe('google');
            expect(response.body.data.socialId).toBe(socialData.socialId);
            expect(response.body.data.userId).toBe(testUser.id);
            expect(response.body.data).toHaveProperty('id');
        });

        it('should fail with duplicate provider for same user', async () => {
            const socialData = {
                userId: testUser.id,
                provider: 'google',
                socialId: 'google-id-1',
            };

            // Create first
            await request(app)
                .post('/socials')
                .send(socialData)
                .expect(201);

            // Try to create duplicate
            const response = await request(app)
                .post('/socials')
                .send({ ...socialData, socialId: 'google-id-2' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should fail without required fields', async () => {
            const response = await request(app)
                .post('/socials')
                .send({ provider: 'google' }) // Missing userId and socialId
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should fail with non-existent user', async () => {
            const response = await request(app)
                .post('/socials')
                .send({
                    userId: 'non-existent-user-id',
                    provider: 'google',
                    socialId: 'some-id',
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /socials/:id', () => {
        it('should get a social profile by ID', async () => {
            const socialProfile = await prisma.socialProfile.create({
                data: {
                    userId: testUser.id,
                    provider: 'github',
                    socialId: 'github-123',
                },
            });

            const response = await request(app)
                .get(`/socials/${socialProfile.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(socialProfile.id);
            expect(response.body.data.provider).toBe('github');
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
            const socialProfile = await prisma.socialProfile.create({
                data: {
                    userId: testUser.id,
                    provider: 'twitter',
                    socialId: 'twitter-123',
                },
            });

            const response = await request(app)
                .put(`/socials/${socialProfile.id}`)
                .send({ provider: 'x' }) // Twitter rebranded to X
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.provider).toBe('x');
        });

        it('should update socialId', async () => {
            const socialProfile = await prisma.socialProfile.create({
                data: {
                    userId: testUser.id,
                    provider: 'linkedin',
                    socialId: 'linkedin-old',
                },
            });

            const response = await request(app)
                .put(`/socials/${socialProfile.id}`)
                .send({ socialId: 'linkedin-new' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.socialId).toBe('linkedin-new');
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
            const socialProfile = await prisma.socialProfile.create({
                data: {
                    userId: testUser.id,
                    provider: 'instagram',
                    socialId: 'insta-123',
                },
            });

            await request(app)
                .delete(`/socials/${socialProfile.id}`)
                .expect(204);

            // Verify it's deleted
            const deleted = await prisma.socialProfile.findUnique({
                where: { id: socialProfile.id },
            });
            expect(deleted).toBeNull();
        });

        it('should return 404 for non-existent social profile', async () => {
            await request(app)
                .delete('/socials/non-existent-id')
                .expect(404);
        });
    });

    describe('User Journey: Managing Social Profiles', () => {
        it('should complete full social profile management flow', async () => {
            // 1. Create Google social profile
            const createResponse = await request(app)
                .post('/socials')
                .send({
                    userId: testUser.id,
                    provider: 'google',
                    socialId: 'google-oauth-id-123',
                })
                .expect(201);

            const socialProfileId = createResponse.body.data.id;

            // 2. List user's social profiles
            const listResponse = await request(app)
                .get(`/socials/user/${testUser.id}`)
                .expect(200);

            expect(listResponse.body.data).toHaveLength(1);

            // 3. Update the social profile
            await request(app)
                .put(`/socials/${socialProfileId}`)
                .send({ socialId: 'google-oauth-id-456' })
                .expect(200);

            // 4. Get updated profile
            const getResponse = await request(app)
                .get(`/socials/${socialProfileId}`)
                .expect(200);

            expect(getResponse.body.data.socialId).toBe('google-oauth-id-456');

            // 5. Delete the profile
            await request(app)
                .delete(`/socials/${socialProfileId}`)
                .expect(204);

            // 6. Verify deletion
            const finalList = await request(app)
                .get(`/socials/user/${testUser.id}`)
                .expect(200);

            expect(finalList.body.data).toHaveLength(0);
        });
    });
});

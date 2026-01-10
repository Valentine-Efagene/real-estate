import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { setupTests, cleanDatabase, prisma, testTenant, testUser } from './setup';

describe('Property Service E2E Tests', () => {
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

    describe('POST /property/properties', () => {
        it('should successfully create a new property', async () => {
            const propertyData = {
                title: faker.lorem.words(3),
                description: faker.lorem.paragraph(),
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: 'USA',
                currency: 'USD',
                city: faker.location.city(),
                district: faker.location.state(),
                zipCode: faker.location.zipCode(),
                streetAddress: faker.location.streetAddress(),
            };

            const response = await request(app)
                .post('/property/properties')
                .set('x-authorizer-tenant-id', testTenant.id)
                .set('x-authorizer-user-id', testUser.id)
                .send(propertyData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.title).toBe(propertyData.title);
            expect(response.body.data.category).toBe(propertyData.category);

            // Verify property was created in database
            const property = await prisma.property.findFirst({
                where: { title: propertyData.title },
            });

            expect(property).toBeTruthy();
            expect(property?.title).toBe(propertyData.title);
        });

        it('should fail with missing required fields', async () => {
            const incompleteData = {
                title: faker.lorem.words(3),
                // Missing required fields: category, propertyType, country, currency, city
            };

            const response = await request(app)
                .post('/property/properties')
                .set('x-authorizer-tenant-id', testTenant.id)
                .set('x-authorizer-user-id', testUser.id)
                .send(incompleteData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should fail without tenant context', async () => {
            const propertyData = {
                title: faker.lorem.words(3),
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: 'USA',
                currency: 'USD',
                city: faker.location.city(),
            };

            const response = await request(app)
                .post('/property/properties')
                .send(propertyData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /property/properties', () => {
        it('should return all properties', async () => {
            // Create test properties
            await prisma.property.createMany({
                data: [
                    {
                        title: 'Property 1',
                        category: 'SALE',
                        propertyType: 'APARTMENT',
                        country: 'USA',
                        currency: 'USD',
                        city: 'New York',
                        tenantId: testTenant.id,
                        userId: testUser.id,
                    },
                    {
                        title: 'Property 2',
                        category: 'RENT',
                        propertyType: 'HOUSE',
                        country: 'USA',
                        currency: 'USD',
                        city: 'Los Angeles',
                        tenantId: testTenant.id,
                        userId: testUser.id,
                    },
                ],
            });

            const response = await request(app)
                .get('/property/properties')
                .set('x-authorizer-tenant-id', testTenant.id)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBe(2);
        });

        it('should return empty array when no properties exist', async () => {
            const response = await request(app)
                .get('/property/properties')
                .set('x-authorizer-tenant-id', testTenant.id)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
        });
    });

    describe('GET /property/properties/:id', () => {
        it('should return a property by ID', async () => {
            const property = await prisma.property.create({
                data: {
                    title: 'Test Property',
                    category: 'SALE',
                    propertyType: 'APARTMENT',
                    country: 'USA',
                    currency: 'USD',
                    city: 'Chicago',
                    tenantId: testTenant.id,
                    userId: testUser.id,
                },
            });

            const response = await request(app)
                .get(`/property/properties/${property.id}`)
                .set('x-authorizer-tenant-id', testTenant.id)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(property.id);
            expect(response.body.data.title).toBe('Test Property');
        });

        it('should return 404 for non-existent property', async () => {
            const response = await request(app)
                .get('/property/properties/non-existent-id')
                .set('x-authorizer-tenant-id', testTenant.id)
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /property/properties/:id', () => {
        it('should update a property', async () => {
            const property = await prisma.property.create({
                data: {
                    title: 'Original Title',
                    category: 'SALE',
                    propertyType: 'APARTMENT',
                    country: 'USA',
                    currency: 'USD',
                    city: 'Boston',
                    tenantId: testTenant.id,
                    userId: testUser.id,
                },
            });

            const response = await request(app)
                .put(`/property/properties/${property.id}`)
                .set('x-authorizer-tenant-id', testTenant.id)
                .set('x-authorizer-user-id', testUser.id)
                .send({ title: 'Updated Title' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe('Updated Title');
        });

        it('should return 404 for non-existent property', async () => {
            const response = await request(app)
                .put('/property/properties/non-existent-id')
                .set('x-authorizer-tenant-id', testTenant.id)
                .set('x-authorizer-user-id', testUser.id)
                .send({ title: 'New Title' })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /property/properties/:id', () => {
        it('should delete a property', async () => {
            const property = await prisma.property.create({
                data: {
                    title: 'Deletable Property',
                    category: 'SALE',
                    propertyType: 'HOUSE',
                    country: 'USA',
                    currency: 'USD',
                    city: 'Seattle',
                    tenantId: testTenant.id,
                    userId: testUser.id,
                },
            });

            const response = await request(app)
                .delete(`/property/properties/${property.id}`)
                .set('x-authorizer-tenant-id', testTenant.id)
                .set('x-authorizer-user-id', testUser.id)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify deletion
            const deleted = await prisma.property.findUnique({
                where: { id: property.id },
            });
            expect(deleted).toBeNull();
        });

        it('should return 404 for non-existent property', async () => {
            const response = await request(app)
                .delete('/property/properties/non-existent-id')
                .set('x-authorizer-tenant-id', testTenant.id)
                .set('x-authorizer-user-id', testUser.id)
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });
});

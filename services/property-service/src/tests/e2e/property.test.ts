import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { cleanDatabase } from './setup';
import { prisma } from '../../lib/prisma';

describe('Property Service E2E Tests', () => {
    beforeAll(async () => {
        await cleanDatabase();
    });

    beforeEach(async () => {
        await cleanDatabase();
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
                price: faker.number.int({ min: 50000, max: 1000000 }),
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: 'USA',
                currency: 'USD',
                city: faker.location.city(),
                district: faker.location.state(),
                zipCode: faker.location.zipCode(),
                streetAddress: faker.location.streetAddress(),
                nBedrooms: '3',
                nBathrooms: '2',
                nParkingSpots: '1',
                area: faker.number.int({ min: 500, max: 5000 }),
            };

            const response = await request(app)
                .post('/property/properties')
                .send(propertyData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.title).toBe(propertyData.title);
            expect(response.body.data.price).toBe(propertyData.price);
            expect(response.body.data.category).toBe(propertyData.category);

            // Verify property was created in database
            const property = await prisma.property.findFirst({
                where: { title: propertyData.title },
            });

            expect(property).toBeTruthy();
            expect(property?.title).toBe(propertyData.title);
            expect(property?.price).toBe(propertyData.price);
        });

        it('should fail with missing required fields', async () => {
            const incompleteData = {
                title: faker.lorem.words(3),
                price: faker.number.int({ min: 50000, max: 1000000 }),
            };

            const response = await request(app)
                .post('/property/properties')
                .send(incompleteData)
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
                        userId: 'test-user-1',
                        title: 'Property 1',
                        category: 'SALE',
                        propertyType: 'APARTMENT',
                        country: 'USA',
                        currency: 'USD',
                        city: 'New York',
                        nBedrooms: '3',
                        nBathrooms: '2',
                        nParkingSpots: '1',
                        price: 250000,
                    },
                    {
                        userId: 'test-user-2',
                        title: 'Property 2',
                        category: 'RENT',
                        propertyType: 'HOUSE',
                        country: 'USA',
                        currency: 'USD',
                        city: 'Los Angeles',
                        nBedrooms: '4',
                        nBathrooms: '3',
                        nParkingSpots: '2',
                        price: 500000,
                    },
                ],
            });

            const response = await request(app)
                .get('/property/properties')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0]).toHaveProperty('id');
            expect(response.body.data[0]).toHaveProperty('title');
        });

        it('should return empty array when no properties exist', async () => {
            const response = await request(app)
                .get('/property/properties')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(0);
        });
    });

    describe('GET /property/properties/:id', () => {
        it('should return a specific property by id', async () => {
            const property = await prisma.property.create({
                data: {
                    userId: 'test-user-1',
                    title: 'Test Property',
                    category: 'SALE',
                    propertyType: 'APARTMENT',
                    country: 'USA',
                    currency: 'USD',
                    city: 'New York',
                    nBedrooms: '3',
                    nBathrooms: '2',
                    nParkingSpots: '1',
                    price: 250000,
                },
            });

            const response = await request(app)
                .get(`/property/properties/${property.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(property.id);
            expect(response.body.data.title).toBe('Test Property');
        });

        it('should return 404 for non-existent property', async () => {
            const response = await request(app)
                .get('/property/properties/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /property/properties/:id', () => {
        it('should update a property', async () => {
            const property = await prisma.property.create({
                data: {
                    userId: 'test-user-1',
                    title: 'Original Title',
                    category: 'SALE',
                    propertyType: 'APARTMENT',
                    country: 'USA',
                    currency: 'USD',
                    city: 'New York',
                    nBedrooms: '3',
                    nBathrooms: '2',
                    nParkingSpots: '1',
                    price: 250000,
                },
            });

            const updateData = {
                title: 'Updated Title',
                price: 300000,
            };

            const response = await request(app)
                .put(`/property/properties/${property.id}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe('Updated Title');
            expect(response.body.data.price).toBe(300000);
        });

        it('should return 404 when updating non-existent property', async () => {
            const response = await request(app)
                .put('/property/properties/non-existent-id')
                .send({ title: 'Updated' })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /property/properties/:id', () => {
        it('should delete a property', async () => {
            const property = await prisma.property.create({
                data: {
                    userId: 'test-user-1',
                    title: 'To Be Deleted',
                    category: 'SALE',
                    propertyType: 'APARTMENT',
                    country: 'USA',
                    currency: 'USD',
                    city: 'New York',
                    nBedrooms: '3',
                    nBathrooms: '2',
                    nParkingSpots: '1',
                    price: 250000,
                },
            });

            const response = await request(app)
                .delete(`/property/properties/${property.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify property was deleted
            const deletedProperty = await prisma.property.findUnique({
                where: { id: property.id },
            });

            expect(deletedProperty).toBeNull();
        });

        it('should return 404 when deleting non-existent property', async () => {
            const response = await request(app)
                .delete('/property/properties/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });
});

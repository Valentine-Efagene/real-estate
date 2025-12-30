import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { cleanDatabase } from './setup';
import { prisma } from '../../lib/prisma';

describe('Amenity Service E2E Tests', () => {
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

    describe('POST /property/amenities', () => {
        it('should successfully create a new amenity', async () => {
            const amenityData = {
                name: faker.lorem.words(2),
            };

            const response = await request(app)
                .post('/property/amenities')
                .send(amenityData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.name).toBe(amenityData.name);

            // Verify amenity was created in database
            const amenity = await prisma.amenity.findFirst({
                where: { name: amenityData.name },
            });

            expect(amenity).toBeTruthy();
            expect(amenity?.name).toBe(amenityData.name);
        });

        it('should create amenity with only required fields', async () => {
            const amenityData = {
                name: 'Parking',
            };

            const response = await request(app)
                .post('/property/amenities')
                .send(amenityData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(amenityData.name);
        });
    });

    describe('GET /property/amenities', () => {
        it('should return all amenities sorted by name', async () => {
            // Create test amenities
            await prisma.amenity.createMany({
                data: [
                    { name: 'Parking' },
                    { name: 'Gym' },
                    { name: 'Pool' },
                ],
            });

            const response = await request(app)
                .get('/property/amenities')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(3);
            // Should be sorted alphabetically
            expect(response.body.data[0].name).toBe('Gym');
            expect(response.body.data[1].name).toBe('Parking');
            expect(response.body.data[2].name).toBe('Pool');
        });

        it('should return empty array when no amenities exist', async () => {
            const response = await request(app)
                .get('/property/amenities')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(0);
        });
    });

    describe('GET /property/amenities/:id', () => {
        it('should return a specific amenity by id', async () => {
            const amenity = await prisma.amenity.create({
                data: {
                    name: 'Swimming Pool',
                },
            });

            const response = await request(app)
                .get(`/property/amenities/${amenity.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(amenity.id);
            expect(response.body.data.name).toBe('Swimming Pool');
        });

        it('should return 404 for non-existent amenity', async () => {
            const response = await request(app)
                .get('/property/amenities/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /property/amenities/:id', () => {
        it('should update an amenity', async () => {
            const amenity = await prisma.amenity.create({
                data: {
                    name: 'Original Name',
                },
            });

            const updateData = {
                name: 'Updated Name',
            };

            const response = await request(app)
                .put(`/property/amenities/${amenity.id}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Updated Name');
        });

        it('should return 404 when updating non-existent amenity', async () => {
            const response = await request(app)
                .put('/property/amenities/non-existent-id')
                .send({ name: 'Updated' })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /property/amenities/:id', () => {
        it('should delete an amenity', async () => {
            const amenity = await prisma.amenity.create({
                data: {
                    name: 'To Be Deleted',
                },
            });

            const response = await request(app)
                .delete(`/property/amenities/${amenity.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify amenity was deleted
            const deletedAmenity = await prisma.amenity.findUnique({
                where: { id: amenity.id },
            });

            expect(deletedAmenity).toBeNull();
        });

        it('should return 404 when deleting non-existent amenity', async () => {
            const response = await request(app)
                .delete('/property/amenities/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });
});

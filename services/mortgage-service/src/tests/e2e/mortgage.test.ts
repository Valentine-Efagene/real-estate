import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { cleanDatabase } from './setup';
import { prisma } from '../../lib/prisma';

describe('Mortgage Service E2E Tests', () => {
    let testProperty: any;

    beforeAll(async () => {
        await cleanDatabase();
        // Create a test property for mortgage tests
        testProperty = await prisma.property.create({
            data: {
                userId: 'test-user-1',
                title: 'Test Property for Mortgage',
                category: 'SALE',
                propertyType: 'APARTMENT',
                country: 'USA',
                currency: 'USD',
                city: 'New York',
                nBedrooms: '3',
                nBathrooms: '2',
                nParkingSpots: '1',
                price: 500000,
            },
        });
    });

    beforeEach(async () => {
        // Clean mortgage-related data but keep the property
        await prisma.payment.deleteMany();
        await prisma.mortgageDownpaymentPayment.deleteMany();
        await prisma.mortgage.deleteMany();
    });

    afterAll(async () => {
        await cleanDatabase();
        await prisma.$disconnect();
    });

    describe('POST /mortgage/mortgages', () => {
        it('should successfully create a new mortgage', async () => {
            const mortgageData = {
                propertyId: testProperty.id,
                borrowerId: 'test-borrower-1',
                principal: 400000,
                downPayment: 100000,
                interestRate: 3.5,
                termMonths: 360,
                monthlyPayment: 1796.18,
            };

            const response = await request(app)
                .post('/mortgage/mortgages')
                .send(mortgageData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data.principal).toBe(mortgageData.principal);
            expect(response.body.data.downPayment).toBe(mortgageData.downPayment);

            // Verify mortgage was created in database
            const mortgage = await prisma.mortgage.findFirst({
                where: { propertyId: testProperty.id },
            });

            expect(mortgage).toBeTruthy();
            expect(mortgage?.principal).toBe(mortgageData.principal);
        });

        it('should fail with missing required fields', async () => {
            const incompleteData = {
                propertyId: testProperty.id,
                principal: 400000,
            };

            const response = await request(app)
                .post('/mortgage/mortgages')
                .send(incompleteData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /mortgage/mortgages', () => {
        it('should return all mortgages', async () => {
            // Create test mortgages
            await prisma.mortgage.createMany({
                data: [
                    {
                        propertyId: testProperty.id,
                        borrowerId: 'test-borrower-1',
                        principal: 400000,
                        downPayment: 100000,
                        interestRate: 3.5,
                        termMonths: 360,
                        monthlyPayment: 1796.18,
                    },
                    {
                        propertyId: testProperty.id,
                        borrowerId: 'test-borrower-2',
                        principal: 300000,
                        downPayment: 50000,
                        interestRate: 4.0,
                        termMonths: 240,
                        monthlyPayment: 1818.35,
                    },
                ],
            });

            const response = await request(app)
                .get('/mortgage/mortgages')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0]).toHaveProperty('id');
            expect(response.body.data[0]).toHaveProperty('principal');
        });

        it('should return empty array when no mortgages exist', async () => {
            const response = await request(app)
                .get('/mortgage/mortgages')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(0);
        });
    });

    describe('GET /mortgage/mortgages/:id', () => {
        it('should return a specific mortgage by id', async () => {
            const mortgage = await prisma.mortgage.create({
                data: {
                    propertyId: testProperty.id,
                    borrowerId: 'test-borrower-1',
                    principal: 400000,
                    downPayment: 100000,
                    interestRate: 3.5,
                    termMonths: 360,
                    monthlyPayment: 1796.18,
                },
            });

            const response = await request(app)
                .get(`/mortgage/mortgages/${mortgage.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(mortgage.id);
            expect(response.body.data.principal).toBe(400000);
        });

        it('should return 404 for non-existent mortgage', async () => {
            const response = await request(app)
                .get('/mortgage/mortgages/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /mortgage/mortgages/:id', () => {
        it('should update a mortgage', async () => {
            const mortgage = await prisma.mortgage.create({
                data: {
                    propertyId: testProperty.id,
                    borrowerId: 'test-borrower-1',
                    principal: 400000,
                    downPayment: 100000,
                    interestRate: 3.5,
                    termMonths: 360,
                    monthlyPayment: 1796.18,
                },
            });

            const updateData = {
                interestRate: 4.0,
            };

            const response = await request(app)
                .put(`/mortgage/mortgages/${mortgage.id}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.interestRate).toBe(4.0);
        });

        it('should return 404 when updating non-existent mortgage', async () => {
            const response = await request(app)
                .put('/mortgage/mortgages/non-existent-id')
                .send({ interestRate: 4.0 })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /mortgage/mortgages/:id', () => {
        it('should delete a mortgage', async () => {
            const mortgage = await prisma.mortgage.create({
                data: {
                    propertyId: testProperty.id,
                    borrowerId: 'test-borrower-1',
                    principal: 400000,
                    downPayment: 100000,
                    interestRate: 3.5,
                    termMonths: 360,
                    monthlyPayment: 1796.18,
                },
            });

            const response = await request(app)
                .delete(`/mortgage/mortgages/${mortgage.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify mortgage was deleted
            const deletedMortgage = await prisma.mortgage.findUnique({
                where: { id: mortgage.id },
            });

            expect(deletedMortgage).toBeNull();
        });

        it('should return 404 when deleting non-existent mortgage', async () => {
            const response = await request(app)
                .delete('/mortgage/mortgages/non-existent-id')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /mortgage/mortgage-types', () => {
        it('should create a mortgage type', async () => {
            const typeData = {
                name: 'Fixed 30-Year',
                description: 'Traditional 30-year fixed rate mortgage',
            };

            const response = await request(app)
                .post('/mortgage/mortgage-types')
                .send(typeData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(typeData.name);
        });
    });

    describe('GET /mortgage/mortgage-types', () => {
        it('should return all mortgage types', async () => {
            await prisma.mortgageType.createMany({
                data: [
                    { name: 'Fixed 15-Year' },
                    { name: 'Fixed 30-Year' },
                    { name: 'ARM 5/1' },
                ],
            });

            const response = await request(app)
                .get('/mortgage/mortgage-types')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBeGreaterThanOrEqual(3);
        });
    });
});

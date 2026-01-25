// Set environment BEFORE any imports
process.env.NODE_ENV = 'test';

import { config } from 'dotenv';
config({ path: '.env.test' });

import supertest from 'supertest';
import { app } from '../src/app.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient, authHeaders, ROLES } from '@valentine-efagene/qshelter-common';

const api = supertest(app);

const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3307'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_NAME || 'qshelter_test',
    connectionLimit: 10,
    allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

async function cleanupTestData() {
    // Skip cleanup - let the test framework handle it
}

async function debug() {
    try {
        // Create test tenant
        await cleanupTestData();
        const tenant = await prisma.tenant.create({
            data: {
                id: 'test-tenant-id',
                name: 'Test Tenant',
                subdomain: 'test',
                isActive: true,
            },
        });
        console.log('Created tenant:', tenant.id);

        // Create user
        const user = await prisma.user.create({
            data: {
                id: 'test-user-id',
                email: 'test@test.com',
                tenantId: tenant.id,
            },
        });
        console.log('Created user:', user.id);

        // Create property and unit
        const property = await prisma.property.create({
            data: {
                tenantId: tenant.id,
                userId: user.id,
                title: 'Test Property',
                category: 'RESIDENTIAL',
                propertyType: 'APARTMENT',
                country: 'Nigeria',
                city: 'Lagos',
                currency: 'NGN',
                status: 'PUBLISHED',
                publishedAt: new Date(),
            },
        });

        const variant = await prisma.propertyVariant.create({
            data: {
                tenantId: tenant.id,
                propertyId: property.id,
                name: 'Test Variant',
                nBedrooms: 2,
                price: 1000000,
                totalUnits: 1,
                availableUnits: 1,
                status: 'AVAILABLE',
            },
        });

        const unit = await prisma.propertyUnit.create({
            data: {
                tenantId: tenant.id,
                variantId: variant.id,
                unitNumber: 'A1',
                status: 'AVAILABLE',
            },
        });
        console.log('Created unit:', unit.id);

        // Create payment plan
        const headers = authHeaders(user.id, tenant.id, { roles: [ROLES.TENANT_ADMIN] });
        console.log('Headers:', headers);

        const planResponse = await api
            .post('/payment-plans')
            .set(headers)
            .set('x-idempotency-key', 'test-key-1')
            .send({
                name: 'Test Plan',
                frequency: 'ONE_TIME',
                numberOfInstallments: 1,
            });
        console.log('Plan creation response:', planResponse.status, planResponse.body);

        if (planResponse.status === 201) {
            // Create payment method
            const methodResponse = await api
                .post('/payment-methods')
                .set(headers)
                .set('x-idempotency-key', 'test-key-2')
                .send({
                    name: 'Test Method',
                    paymentType: 'MORTGAGE',
                    phases: [
                        {
                            name: 'Payment Phase',
                            phaseType: 'DOWNPAYMENT',
                            order: 1,
                            paymentPlanId: planResponse.body.data.id,
                            percentageOfTotal: 100,
                        },
                    ],
                });
            console.log('Method creation response:', methodResponse.status, methodResponse.body);

            if (methodResponse.status === 201) {
                // Now try to create application
                const appHeaders = authHeaders(user.id, tenant.id, { roles: [ROLES.CUSTOMER] });
                console.log('\nSending request body:', JSON.stringify({
                    propertyUnitId: unit.id,
                    paymentMethodId: methodResponse.body.data.id,
                    title: 'Test Application',
                    applicationType: 'MORTGAGE',
                    totalAmount: 1000000,
                }, null, 2));

                const appResponse = await api
                    .post('/applications')
                    .set(appHeaders)
                    .set('x-idempotency-key', 'test-key-3')
                    .send({
                        propertyUnitId: unit.id,
                        paymentMethodId: methodResponse.body.data.id,
                        title: 'Test Application',
                        applicationType: 'MORTGAGE',
                        totalAmount: 1000000,
                    });
                console.log('Application creation response:', appResponse.status, JSON.stringify(appResponse.body, null, 2));
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

debug();

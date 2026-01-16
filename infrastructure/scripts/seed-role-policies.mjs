#!/usr/bin/env node

/**
 * Migration script to seed DynamoDB with initial role policies
 * 
 * Usage:
 *   node scripts/seed-role-policies.mjs
 * 
 * Environment variables:
 *   - AWS_REGION_NAME (default: us-east-1)
 *   - ROLE_POLICIES_TABLE_NAME (required)
 *   - AWS_ENDPOINT_URL (optional, for LocalStack)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const clientConfig = {
    region: process.env.AWS_REGION_NAME || 'us-east-1'
};

// Support LocalStack endpoint
if (process.env.AWS_ENDPOINT_URL) {
    clientConfig.endpoint = process.env.AWS_ENDPOINT_URL;
    clientConfig.credentials = {
        accessKeyId: 'test',
        secretAccessKey: 'test',
    };
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.ROLE_POLICIES_TABLE_NAME || 'role-policies';

// Define initial role policies
const rolePolicies = [
    {
        roleName: 'admin',
        policy: {
            version: '1',
            statements: [
                {
                    effect: 'Allow',
                    resources: [
                        { path: '/users', methods: ['GET', 'POST'] },
                        { path: '/users/:id', methods: ['GET', 'PATCH', 'DELETE'] },
                        { path: '/roles', methods: ['GET', 'POST'] },
                        { path: '/roles/:id', methods: ['GET', 'PATCH', 'DELETE'] },
                        { path: '/permissions', methods: ['GET', 'POST'] },
                        { path: '/permissions/:id', methods: ['GET', 'PATCH', 'DELETE'] },
                        { path: '/tenants', methods: ['GET', 'POST'] },
                        { path: '/tenants/:id', methods: ['GET', 'PATCH', 'DELETE'] },
                        { path: '/properties', methods: ['GET', 'POST'] },
                        { path: '/properties/:id', methods: ['GET', 'PATCH', 'DELETE'] },
                        { path: '/amenities', methods: ['GET', 'POST'] },
                        { path: '/amenities/:id', methods: ['GET', 'PATCH', 'DELETE'] },
                        { path: '/mortgages', methods: ['GET', 'POST'] },
                        { path: '/mortgages/:id', methods: ['GET', 'PATCH', 'DELETE'] },
                        { path: '/payments', methods: ['GET', 'POST'] },
                        { path: '/wallets', methods: ['GET', 'POST'] },
                    ],
                },
            ],
        },
        isActive: true,
    },
    {
        roleName: 'user',
        policy: {
            version: '1',
            statements: [
                {
                    effect: 'Allow',
                    resources: [
                        { path: '/users/:id', methods: ['GET', 'PATCH'] }, // Own profile only
                        { path: '/properties', methods: ['GET'] },
                        { path: '/properties/:id', methods: ['GET'] },
                        { path: '/amenities', methods: ['GET'] },
                        { path: '/mortgages', methods: ['GET', 'POST'] },
                        { path: '/mortgages/:id', methods: ['GET'] },
                        { path: '/payments', methods: ['GET', 'POST'] },
                        { path: '/wallets', methods: ['GET'] },
                    ],
                },
            ],
        },
        isActive: true,
    },
    {
        roleName: 'property-manager',
        policy: {
            version: '1',
            statements: [
                {
                    effect: 'Allow',
                    resources: [
                        { path: '/users/:id', methods: ['GET', 'PATCH'] },
                        { path: '/properties', methods: ['GET', 'POST'] },
                        { path: '/properties/:id', methods: ['GET', 'PATCH', 'DELETE'] },
                        { path: '/amenities', methods: ['GET', 'POST'] },
                        { path: '/amenities/:id', methods: ['GET', 'PATCH', 'DELETE'] },
                        { path: '/qr-code', methods: ['GET', 'POST'] },
                        { path: '/tenants', methods: ['GET'] },
                        { path: '/users', methods: ['GET'] },
                    ],
                },
            ],
        },
        isActive: true,
    },
    {
        roleName: 'mortgage-officer',
        policy: {
            version: '1',
            statements: [
                {
                    effect: 'Allow',
                    resources: [
                        { path: '/users/:id', methods: ['GET', 'PATCH'] },
                        { path: '/mortgages', methods: ['GET', 'POST'] },
                        { path: '/mortgages/:id', methods: ['GET', 'PATCH'] },
                        { path: '/mortgage-types', methods: ['GET'] },
                        { path: '/payments', methods: ['GET', 'POST'] },
                        { path: '/payments/:id', methods: ['GET', 'PATCH'] },
                        { path: '/wallets', methods: ['GET'] },
                        { path: '/users', methods: ['GET'] },
                    ],
                },
            ],
        },
        isActive: true,
    },
    {
        roleName: 'developer',
        policy: {
            version: '1',
            statements: [
                {
                    effect: 'Allow',
                    resources: [
                        { path: '/users/:id', methods: ['GET', 'PATCH'] },
                        { path: '/properties', methods: ['GET', 'POST'] },
                        { path: '/properties/:id', methods: ['GET', 'PATCH'] },
                        { path: '/applications', methods: ['GET'] },
                        { path: '/applications/:id', methods: ['GET'] },
                        { path: '/applications/:id/phases/:phaseId/documents', methods: ['GET', 'POST'] }, // Upload sales offer
                        { path: '/documents', methods: ['GET', 'POST'] },
                        { path: '/documents/:id', methods: ['GET'] },
                    ],
                },
            ],
        },
        isActive: true,
    },
    {
        roleName: 'lender',
        policy: {
            version: '1',
            statements: [
                {
                    effect: 'Allow',
                    resources: [
                        { path: '/users/:id', methods: ['GET', 'PATCH'] },
                        { path: '/applications', methods: ['GET'] },
                        { path: '/applications/:id', methods: ['GET'] },
                        { path: '/applications/:id/phases', methods: ['GET'] },
                        { path: '/applications/:id/phases/:phaseId', methods: ['GET'] },
                        { path: '/applications/:id/phases/:phaseId/documents', methods: ['GET', 'POST'] }, // Upload preapproval/mortgage offer
                        { path: '/applications/:id/documents/:docId/review', methods: ['POST'] },
                        { path: '/documents', methods: ['GET', 'POST'] },
                        { path: '/documents/:id', methods: ['GET'] },
                        { path: '/mortgages', methods: ['GET'] },
                        { path: '/mortgages/:id', methods: ['GET'] },
                    ],
                },
            ],
        },
        isActive: true,
    },
];

async function seedPolicies() {
    console.log(`Seeding policies to table: ${tableName}`);
    console.log(`Region: ${process.env.AWS_REGION_NAME || 'us-east-1'}`);

    const items = rolePolicies.map(rolePolicy => ({
        PutRequest: {
            Item: {
                PK: `ROLE#${rolePolicy.roleName}`,
                SK: 'POLICY',
                roleName: rolePolicy.roleName,
                policy: rolePolicy.policy,
                isActive: rolePolicy.isActive,
                updatedAt: new Date().toISOString(),
            },
        },
    }));

    try {
        // DynamoDB BatchWrite has a limit of 25 items
        const batchSize = 25;
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);

            const command = new BatchWriteCommand({
                RequestItems: {
                    [tableName]: batch,
                },
            });

            await docClient.send(command);
            console.log(`✓ Seeded ${batch.length} policies (batch ${Math.floor(i / batchSize) + 1})`);
        }

        console.log('\n✅ Successfully seeded all role policies!');
        console.log(`\nSeeded roles: ${rolePolicies.map(p => p.roleName).join(', ')}`);
    } catch (error) {
        console.error('❌ Error seeding policies:', error);
        process.exit(1);
    }
}

// Run the seed function
seedPolicies();

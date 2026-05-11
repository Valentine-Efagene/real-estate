import request from 'supertest';
import { app } from '../app';
import { RoleName, type CreatePermissionInput, type Permission } from '../validators/permission.validator';

const allowedRoleNames = [
    RoleName.User,
    RoleName.Admin,
    RoleName.Sales,
    RoleName.Support,
    RoleName.Finance,
    RoleName.Legal,
    RoleName.ProjectManager,
    RoleName.MortgageOperator,
] as const;

describe('permissions true e2e CRUD', () => {
    let createdRoleName: string | undefined;
    let createdId: number | undefined;
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    afterAll(async () => {
        if (!createdRoleName) {
            return;
        }

        await request(app).delete(`/permissions/${encodeURIComponent(createdRoleName)}`);
    }, 30000);

    it(
        'creates, lists, gets, updates, patches, and deletes a permission with no mocks',
        async () => {
            const existingResponse = await request(app)
                .get('/permissions')
                .set('accept', 'application/json');

            expect(existingResponse.status).toBe(200);
            expect(existingResponse.body.success).toBe(true);

            const existingRoleNames = new Set(
                (existingResponse.body.data as Permission[]).map((item) => item.roleName)
            );
            const availableRoleNames = allowedRoleNames.filter(
                (roleName) => !existingRoleNames.has(roleName)
            );

            expect(availableRoleNames.length).toBeGreaterThanOrEqual(1);

            const [initialRoleName] = availableRoleNames;

            const createPayload: CreatePermissionInput = {
                roleName: initialRoleName,
                isActive: true,
                policy: {
                    version: '1.0',
                    statements: [
                        {
                            effect: 'Allow',
                            resources: [
                                {
                                    path: `/e2e/${uniqueSuffix}`,
                                    methods: ['GET', 'POST'],
                                },
                            ],
                        },
                    ],
                },
            };

            const createResponse = await request(app)
                .post('/permissions')
                .set('accept', 'application/json')
                .send(createPayload);

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.success).toBe(true);
            expect(createResponse.body.data.roleName).toBe(createPayload.roleName);
            expect(createResponse.body.data.isActive).toBe(true);

            createdId = createResponse.body.data.id;
            createdRoleName = createResponse.body.data.roleName;

            expect(typeof createdId).toBe('number');
            expect(createdRoleName).toBe(createPayload.roleName);

            const listResponse = await request(app)
                .get('/permissions')
                .query({ roleName: createPayload.roleName })
                .set('accept', 'application/json');

            expect(listResponse.status).toBe(200);
            expect(listResponse.body.success).toBe(true);
            expect(
                listResponse.body.data.some(
                    (item: { id: number; roleName: string }) =>
                        item.id === createdId && item.roleName === createPayload.roleName
                )
            ).toBe(true);

            const getResponse = await request(app)
                .get(`/permissions/${encodeURIComponent(createdRoleName!)}`)
                .set('accept', 'application/json');

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.success).toBe(true);
            expect(getResponse.body.data.id).toBe(createdId);
            expect(getResponse.body.data.roleName).toBe(createPayload.roleName);

            const putPayload = {
                isActive: false,
                policy: {
                    version: '1.0',
                    statements: [
                        {
                            effect: 'Deny',
                            resources: [
                                {
                                    path: `/e2e/${uniqueSuffix}`,
                                    methods: ['DELETE'],
                                },
                            ],
                        },
                    ],
                },
            } as const;

            const putResponse = await request(app)
                .put(`/permissions/${encodeURIComponent(createdRoleName!)}`)
                .set('accept', 'application/json')
                .send(putPayload);

            expect(putResponse.status).toBe(200);
            expect(putResponse.body.success).toBe(true);
            expect(putResponse.body.data.roleName).toBe(createdRoleName);
            expect(putResponse.body.data.isActive).toBe(false);
            expect(putResponse.body.data.policy.statements[0].effect).toBe('Deny');

            const patchResponse = await request(app)
                .patch(`/permissions/${encodeURIComponent(createdRoleName!)}`)
                .set('accept', 'application/json')
                .send({ isActive: true });

            expect(patchResponse.status).toBe(200);
            expect(patchResponse.body.success).toBe(true);
            expect(patchResponse.body.data.id).toBe(createdId);
            expect(patchResponse.body.data.isActive).toBe(true);

            const deleteResponse = await request(app)
                .delete(`/permissions/${encodeURIComponent(createdRoleName!)}`)
                .set('accept', 'application/json');

            expect(deleteResponse.status).toBe(200);
            expect(deleteResponse.body.success).toBe(true);
            expect(deleteResponse.body.data.roleName).toBe(createdRoleName);

            const deletedRoleName = createdRoleName;
            createdRoleName = undefined;

            const notFoundResponse = await request(app)
                .get(`/permissions/${encodeURIComponent(deletedRoleName!)}`)
                .set('accept', 'application/json');

            expect(notFoundResponse.status).toBe(404);
            expect(notFoundResponse.body.success).toBe(false);
            expect(notFoundResponse.body.error.message).toBe('Permission not found');
        },
        30000
    );
});

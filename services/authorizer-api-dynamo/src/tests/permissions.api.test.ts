import { jest } from '@jest/globals';
import request from 'supertest';
import { AppError } from '../middleware/error-handler';
import { app } from '../app';
import { permissionService } from '../services/permission.service';
import { RoleName, type CreatePermissionInput, type Permission } from '../validators/permission.validator';

const basePermission: Permission = {
    id: 101,
    roleName: RoleName.Admin,
    isActive: true,
    policy: {
        version: '1.0',
        statements: [
            {
                effect: 'Allow',
                resources: [
                    {
                        path: '/permissions',
                        methods: ['GET', 'POST'],
                    },
                ],
            },
        ],
    },
    createdAt: '2026-04-16T00:00:00.000Z',
    updatedAt: '2026-04-16T00:00:00.000Z',
};

describe('permissions api CRUD', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('lists permissions', async () => {
        const findAllSpy = jest
            .spyOn(permissionService, 'findAll')
            .mockResolvedValue([basePermission]);

        const response = await request(app)
            .get('/permissions')
            .query({ roleName: 'admin', isActive: 'true' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: [basePermission],
        });
        expect(findAllSpy).toHaveBeenCalledWith({ roleName: 'admin', isActive: true });
    });

    it('creates a permission', async () => {
        const createPayload: CreatePermissionInput = {
            roleName: RoleName.Support,
            isActive: true,
            policy: {
                version: '1.0' as const,
                statements: [
                    {
                        effect: 'Allow' as const,
                        resources: [
                            {
                                path: '/articles',
                                methods: ['GET', 'POST'],
                            },
                        ],
                    },
                ],
            },
        };

        jest.spyOn(permissionService, 'create').mockResolvedValue({
            ...basePermission,
            id: 102,
            roleName: RoleName.Support,
            policy: createPayload.policy,
        });

        const response = await request(app)
            .post('/permissions')
            .set('accept', 'application/json')
            .send(createPayload);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.roleName).toBe(RoleName.Support);
        expect(response.body.data.policy.statements[0].resources[0].path).toBe('/articles');
    });

    it('gets a permission by roleName', async () => {
        jest.spyOn(permissionService, 'findByRoleName').mockResolvedValue(basePermission);

        const response = await request(app).get('/permissions/admin');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: basePermission,
        });
    });

    it('updates a permission with put', async () => {
        const updatedPermission: Permission = {
            ...basePermission,
            isActive: false,
            updatedAt: '2026-04-16T01:00:00.000Z',
        };

        jest.spyOn(permissionService, 'updateByRoleName').mockResolvedValue(updatedPermission);

        const response = await request(app)
            .put('/permissions/admin')
            .send({ isActive: false, policy: basePermission.policy });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: updatedPermission,
        });
    });

    it('updates a permission with patch', async () => {
        const updatedPermission: Permission = {
            ...basePermission,
            isActive: false,
            updatedAt: '2026-04-16T02:00:00.000Z',
        };

        jest.spyOn(permissionService, 'updateByRoleName').mockResolvedValue(updatedPermission);

        const response = await request(app)
            .patch('/permissions/admin')
            .send({ isActive: false });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: updatedPermission,
        });
    });

    it('deletes a permission', async () => {
        jest.spyOn(permissionService, 'deleteByRoleName').mockResolvedValue({ roleName: RoleName.Admin });

        const response = await request(app).delete('/permissions/admin');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: { roleName: 'admin' },
        });
    });

    it('returns a not found error for a missing permission', async () => {
        jest
            .spyOn(permissionService, 'findByRoleName')
            .mockRejectedValue(new AppError(404, 'Permission not found'));

        const response = await request(app).get('/permissions/legal');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            success: false,
            error: {
                message: 'Permission not found',
            },
        });
    });
    it('rejects an invalid roleName payload', async () => {
        const response = await request(app)
            .post('/permissions')
            .send({
                roleName: 'editor',
                isActive: true,
                policy: {
                    version: '1.0',
                    statements: [
                        {
                            effect: 'Allow',
                            resources: [{ path: '/articles', methods: ['GET'] }],
                        },
                    ],
                },
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('Validation Error');
    });

    it('rejects roleName in update payloads', async () => {
        const response = await request(app)
            .patch('/permissions/admin')
            .send({ roleName: RoleName.Support });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('Validation Error');
    });
});

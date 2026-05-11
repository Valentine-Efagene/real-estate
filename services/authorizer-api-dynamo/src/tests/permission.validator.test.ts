import { RoleName, createPermissionSchema, updatePermissionSchema } from '../validators/permission.validator';

describe('permission policy validation', () => {
    const validPayload = {
        roleName: RoleName.Admin,
        isActive: true,
        policy: {
            version: '1.0',
            statements: [
                {
                    effect: 'Allow',
                    resources: [
                        {
                            path: '/hello',
                            methods: ['GET'],
                        },
                        {
                            path: '/users/:id',
                            methods: ['GET', 'PUT'],
                        },
                    ],
                },
                {
                    effect: 'Deny',
                    resources: [
                        {
                            path: '/admin/*',
                            methods: ['DELETE'],
                        },
                    ],
                },
            ],
        },
    };

    it('accepts a valid permissions payload', () => {
        const parsed = createPermissionSchema.parse(validPayload);

        expect(parsed.roleName).toBe('admin');
        expect(parsed.policy.statements).toHaveLength(2);
    });

    it('rejects an invalid statement effect', () => {
        expect(() =>
            createPermissionSchema.parse({
                ...validPayload,
                policy: {
                    ...validPayload.policy,
                    statements: [
                        {
                            effect: 'Maybe',
                            resources: [{ path: '/oops', methods: ['GET'] }],
                        },
                    ],
                },
            })
        ).toThrow();
    });

    it('rejects an invalid roleName', () => {
        expect(() =>
            createPermissionSchema.parse({
                ...validPayload,
                roleName: 'editor',
            })
        ).toThrow();
    });

    it('allows partial updates', () => {
        const parsed = updatePermissionSchema.parse({ isActive: false });
        expect(parsed.isActive).toBe(false);
    });
});
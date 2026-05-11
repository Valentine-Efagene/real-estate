import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export enum RoleName {
    User = 'user',
    Admin = 'admin',
    Sales = 'sales',
    Support = 'support',
    Finance = 'finance',
    Legal = 'legal',
    ProjectManager = 'project_manager',
    MortgageOperator = 'mortgage_operator',
}

export const roleNameSchema = z.nativeEnum(RoleName);

export const httpMethodSchema = z.enum([
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'HEAD',
    '*',
]);

export const policyResourceSchema = z.object({
    path: z.string().trim().min(1).startsWith('/'),
    methods: z.array(httpMethodSchema).min(1),
});

export const policyStatementSchema = z.object({
    effect: z.enum(['Allow', 'Deny']),
    resources: z.array(policyResourceSchema).min(1),
});

export const policySchema = z.object({
    version: z.literal('1.0'),
    statements: z.array(policyStatementSchema).min(1),
});

export const permissionSchema = z.object({
    id: z.number().int().positive(),
    roleName: roleNameSchema,
    isActive: z.boolean(),
    policy: policySchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const createPermissionSchema = z.object({
    roleName: roleNameSchema,
    isActive: z.boolean().default(true),
    policy: policySchema,
});

export const updatePermissionSchema = z
    .object({
        isActive: z.boolean().optional(),
        policy: policySchema.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field must be provided',
    });

export type Permission = z.infer<typeof permissionSchema>;
export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;

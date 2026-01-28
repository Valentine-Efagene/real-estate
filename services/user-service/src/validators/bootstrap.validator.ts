import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Permission schema for bootstrap
const BootstrapPermissionSchema = z.object({
    name: z.string().min(1),
    path: z.string().min(1),
    methods: z.array(z.string()).min(1),
    effect: z.enum(['ALLOW', 'DENY']).default('ALLOW'),
});

// Role schema for bootstrap
const BootstrapRoleSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    isSystem: z.boolean().default(false),
    permissions: z.array(BootstrapPermissionSchema).optional(),
});

// Admin user schema
const BootstrapAdminSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).optional(), // Optional - will generate if not provided
    firstName: z.string().min(1),
    lastName: z.string().min(1),
});

// Tenant schema
const BootstrapTenantSchema = z.object({
    name: z.string().min(1),
    subdomain: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with hyphens'),
});

/**
 * Bootstrap Tenant Request Schema
 * 
 * Creates a complete tenant setup with roles, permissions, and first admin user.
 * Idempotent - safe to call multiple times with same subdomain.
 */
export const bootstrapTenantSchema = z.object({
    tenant: BootstrapTenantSchema.openapi({
        description: 'Tenant configuration',
        example: { name: 'Acme Real Estate', subdomain: 'acme' },
    }),
    admin: BootstrapAdminSchema.openapi({
        description: 'First admin user for this tenant',
        example: { email: 'admin@acme.com', firstName: 'Admin', lastName: 'User' },
    }),
    roles: z.array(BootstrapRoleSchema).optional().openapi({
        description: 'Roles to create. If omitted, creates default roles: admin, user, mortgage_ops, finance, legal, agent, lender_ops',
    }),
    idempotencyKey: z.string().optional().openapi({
        description: 'Optional idempotency key. If provided, duplicate requests with same key are ignored.',
    }),
}).openapi('BootstrapTenantRequest');

// Response schema
export const bootstrapTenantResponseSchema = z.object({
    tenant: z.object({
        id: z.string(),
        name: z.string(),
        subdomain: z.string(),
        isNew: z.boolean(),
    }),
    admin: z.object({
        id: z.string(),
        email: z.string(),
        isNew: z.boolean(),
        temporaryPassword: z.string().optional(),
    }),
    roles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        isNew: z.boolean(),
        permissionsCount: z.number(),
    })),
    syncTriggered: z.boolean(),
}).openapi('BootstrapTenantResponse');

export type BootstrapTenantInput = z.infer<typeof bootstrapTenantSchema>;
export type BootstrapTenantResponse = z.infer<typeof bootstrapTenantResponseSchema>;
export type BootstrapRole = z.infer<typeof BootstrapRoleSchema>;
export type BootstrapPermission = z.infer<typeof BootstrapPermissionSchema>;

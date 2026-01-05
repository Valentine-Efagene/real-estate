import { PrismaClient, Prisma } from "../../generated/client/client";

/**
 * INVERTED APPROACH: All models are tenant-scoped by default.
 * Only list models that are explicitly GLOBAL (no tenant scoping).
 * 
 * This reduces the risk of accidentally omitting a new model from tenant scoping.
 */

/**
 * Models that are intentionally GLOBAL and should NOT be tenant-scoped.
 * These models either:
 * - Don't have a tenantId field (system tables)
 * - Have optional tenantId but are designed to work across tenants (User)
 */
const GLOBAL_MODELS = [
    // User can exist across tenants or without a tenant
    "user",
    // System/infrastructure tables without tenantId
    "tenant",
    "role",
    "permission",
    "rolePermission",
    "userRole",
    "refreshToken",
    "passwordReset",
    "wallet",
    "domainEvent",
] as const;

type GlobalModel = (typeof GLOBAL_MODELS)[number];

/**
 * Models that have OPTIONAL tenant scoping (nullable tenantId).
 * These can be global templates (tenantId = null) or tenant-specific.
 * Queries will return both global AND tenant-specific records.
 */
const OPTIONAL_TENANT_MODELS = ["paymentPlan"] as const;

type OptionalTenantModel = (typeof OPTIONAL_TENANT_MODELS)[number];

function isGlobalModel(model: string): model is GlobalModel {
    return GLOBAL_MODELS.includes(model as GlobalModel);
}

function isOptionalTenantModel(model: string): model is OptionalTenantModel {
    return OPTIONAL_TENANT_MODELS.includes(model as OptionalTenantModel);
}

/**
 * A model is tenant-scoped by default unless explicitly listed as global.
 */
function isTenantScopedModel(model: string): boolean {
    return !isGlobalModel(model);
}

/**
 * Tenant context for request-scoped operations
 */
export interface TenantContext {
    tenantId: string;
    userId?: string;
}

/**
 * Creates a tenant-scoped Prisma client that automatically:
 * 1. Filters all queries on tenant-scoped models by tenantId
 * 2. Injects tenantId into all create operations on tenant-scoped models
 *
 * Usage:
 * ```ts
 * const tenantPrisma = createTenantPrisma(prisma, { tenantId: 'tenant-123' });
 * const properties = await tenantPrisma.property.findMany(); // Auto-filtered by tenant
 * ```
 */
export function createTenantPrisma(
    prisma: PrismaClient,
    context: TenantContext
) {
    const { tenantId } = context;

    return prisma.$extends({
        name: "tenant-scoping",
        query: {
            $allModels: {
                async findMany({ model, args, query }) {
                    if (isTenantScopedModel(model)) {
                        const tenantFilter = isOptionalTenantModel(model)
                            ? { OR: [{ tenantId }, { tenantId: null }] }
                            : { tenantId };

                        (args as any).where = {
                            ...(args as any).where,
                            ...tenantFilter,
                        };
                    }
                    return query(args);
                },

                async findFirst({ model, args, query }) {
                    if (isTenantScopedModel(model)) {
                        const tenantFilter = isOptionalTenantModel(model)
                            ? { OR: [{ tenantId }, { tenantId: null }] }
                            : { tenantId };

                        (args as any).where = {
                            ...(args as any).where,
                            ...tenantFilter,
                        };
                    }
                    return query(args);
                },

                async findUnique({ model, args, query }) {
                    // findUnique can only filter by unique fields, so we verify after fetch
                    const result = await query(args);
                    if (result && isTenantScopedModel(model)) {
                        const record = result as { tenantId?: string | null };
                        if (isOptionalTenantModel(model)) {
                            // Allow null tenantId (global) or matching tenantId
                            if (record.tenantId !== null && record.tenantId !== tenantId) {
                                return null;
                            }
                        } else {
                            if (record.tenantId !== tenantId) {
                                return null;
                            }
                        }
                    }
                    return result;
                },

                async create({ model, args, query }) {
                    if (isTenantScopedModel(model) && !isOptionalTenantModel(model)) {
                        // Inject tenantId for required tenant models
                        (args.data as any).tenantId = tenantId;
                    } else if (isOptionalTenantModel(model)) {
                        // For optional models, inject if not explicitly set to null
                        if ((args.data as any).tenantId === undefined) {
                            (args.data as any).tenantId = tenantId;
                        }
                    }
                    return query(args);
                },

                async createMany({ model, args, query }) {
                    if (isTenantScopedModel(model)) {
                        const data = Array.isArray(args.data) ? args.data : [args.data];
                        args.data = data.map((item: any) => {
                            if (!isOptionalTenantModel(model)) {
                                return { ...item, tenantId };
                            }
                            // For optional models, inject if not explicitly set
                            if (item.tenantId === undefined) {
                                return { ...item, tenantId };
                            }
                            return item;
                        });
                    }
                    return query(args);
                },

                async update({ model, args, query }) {
                    if (isTenantScopedModel(model)) {
                        // Verify tenant ownership before update
                        const tenantFilter = isOptionalTenantModel(model)
                            ? { OR: [{ tenantId }, { tenantId: null }] }
                            : { tenantId };

                        (args as any).where = {
                            ...(args as any).where,
                            ...tenantFilter,
                        };
                    }
                    return query(args);
                },

                async updateMany({ model, args, query }) {
                    if (isTenantScopedModel(model)) {
                        const tenantFilter = isOptionalTenantModel(model)
                            ? { OR: [{ tenantId }, { tenantId: null }] }
                            : { tenantId };

                        (args as any).where = {
                            ...(args as any).where,
                            ...tenantFilter,
                        };
                    }
                    return query(args);
                },

                async delete({ model, args, query }) {
                    if (isTenantScopedModel(model)) {
                        const tenantFilter = isOptionalTenantModel(model)
                            ? { OR: [{ tenantId }, { tenantId: null }] }
                            : { tenantId };

                        (args as any).where = {
                            ...(args as any).where,
                            ...tenantFilter,
                        };
                    }
                    return query(args);
                },

                async deleteMany({ model, args, query }) {
                    if (isTenantScopedModel(model)) {
                        const tenantFilter = isOptionalTenantModel(model)
                            ? { OR: [{ tenantId }, { tenantId: null }] }
                            : { tenantId };

                        (args as any).where = {
                            ...(args as any).where,
                            ...tenantFilter,
                        };
                    }
                    return query(args);
                },

                async count({ model, args, query }) {
                    if (isTenantScopedModel(model)) {
                        const tenantFilter = isOptionalTenantModel(model)
                            ? { OR: [{ tenantId }, { tenantId: null }] }
                            : { tenantId };

                        (args as any).where = {
                            ...(args as any).where,
                            ...tenantFilter,
                        };
                    }
                    return query(args);
                },

                async aggregate({ model, args, query }) {
                    if (isTenantScopedModel(model)) {
                        const tenantFilter = isOptionalTenantModel(model)
                            ? { OR: [{ tenantId }, { tenantId: null }] }
                            : { tenantId };

                        (args as any).where = {
                            ...(args as any).where,
                            ...tenantFilter,
                        };
                    }
                    return query(args);
                },
            },
        },
    });
}

/**
 * Type helper for the tenant-scoped Prisma client
 */
export type TenantPrismaClient = ReturnType<typeof createTenantPrisma>;

/**
 * Helper to verify a record belongs to the current tenant
 * Use this for operations that can't be filtered at query time
 */
export function assertTenantOwnership<T extends { tenantId?: string | null }>(
    record: T | null,
    tenantId: string,
    options?: { allowGlobal?: boolean }
): asserts record is T {
    if (!record) {
        throw new Error("Record not found");
    }

    if (options?.allowGlobal && record.tenantId === null) {
        return; // Global records are accessible to all tenants
    }

    if (record.tenantId !== tenantId) {
        throw new Error("Access denied: resource belongs to another tenant");
    }
}

/**
 * Utility to check if a record is accessible by a tenant
 */
export function canAccessRecord(
    record: { tenantId?: string | null } | null,
    tenantId: string,
    options?: { allowGlobal?: boolean }
): boolean {
    if (!record) return false;
    if (options?.allowGlobal && record.tenantId === null) return true;
    return record.tenantId === tenantId;
}

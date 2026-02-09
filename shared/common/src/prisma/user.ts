import { PrismaClient } from "../../generated/client/client";

/**
 * Fetch a user and return a copy with a flattened `roles` array for quick access.
 * Uses tenantMemberships to resolve roles (tenant-scoped).
 */
export async function getUserWithRoles(prisma: PrismaClient, userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            tenantMemberships: {
                where: { isActive: true },
                include: { role: true },
            },
        },
    });

    if (!user) return null;

    const roles = user.tenantMemberships?.map((m) => m.role) ?? [];

    // Return a shallow copy of the user with `roles` fused in for quick access.
    const { tenantMemberships, ...rest } = user as any;
    return { ...rest, roles };
}

export type { PrismaClient };

import { PrismaClient } from "../../generated/client/client";

/**
 * Fetch a user and return a copy with a flattened `roles` array for quick access.
 * Keeps `userRoles` intact on the returned object under the hood, but returns
 * a top-level `roles` array of Role objects for convenience.
 */
export async function getUserWithRoles(prisma: PrismaClient, userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } },
    });

    if (!user) return null;

    const roles = (user as any).userRoles?.map((ur: any) => ur.role) ?? [];

    // Return a shallow copy of the user with `roles` fused in for quick access.
    const { userRoles, ...rest } = user as any;
    return { ...rest, roles };
}

export type { PrismaClient };

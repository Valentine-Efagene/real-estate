import { RoleCreateManyInput, RoleModel, TenantCreateManyInput } from '@valentine-efagene/qshelter-common';
import { prisma } from '../prisma';

/**
 * Seed data for development and testing
 */
export const seedData: { roles: RoleCreateManyInput[], tenants: TenantCreateManyInput[] } = {
    roles: [
        { name: 'admin', description: 'Administrator role with full access' },
        { name: 'user', description: 'Regular user role' },
        { name: 'agent', description: 'Real estate agent role' },
        { name: 'landlord', description: 'Property landlord role' },
        { name: 'tenant', description: 'Property tenant role' },
        { name: 'developer', description: 'Property developer who lists properties and uploads sales offer letters' },
        { name: 'lender', description: 'Bank/financial institution representative who uploads preapproval and mortgage offer letters' },
    ],
    tenants: [
        { name: 'Default Tenant', isActive: true, subdomain: 'default' },
    ],
};

/**
 * Seed roles into the database
 */
export async function seedRoles() {
    console.log('Seeding roles...');
    const roles = await prisma.role.createMany({
        data: seedData.roles,
        skipDuplicates: true,
    });
    console.log(`✓ Seeded ${roles.count} roles`);
    return roles;
}

/**
 * Seed tenants into the database
 */
export async function seedTenants() {
    console.log('Seeding tenants...');
    const tenants = await prisma.tenant.createMany({
        data: seedData.tenants,
        skipDuplicates: true,
    });
    console.log(`✓ Seeded ${tenants.count} tenants`);
    return tenants;
}

/**
 * Main seed function - seeds all data
 */
export async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');

        await seedTenants();
        await seedRoles();

        console.log('✅ Database seeding completed successfully');
    } catch (error) {
        console.error('❌ Database seeding failed:', error);
        throw error;
    }
}

/**
 * Clean the database (for testing)
 */
export async function cleanDatabase() {
    console.log('🧹 Cleaning database...');

    // Delete in order to respect foreign key constraints
    await prisma.refreshToken.deleteMany();
    await prisma.passwordReset.deleteMany();
    await prisma.oAuthState.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.tenant.deleteMany();

    console.log('✓ Database cleaned');
}

/**
 * Reset and seed database (for testing)
 */
export async function resetDatabase() {
    await cleanDatabase();
    await seedDatabase();
}

// If running directly, execute seed
if (import.meta.url === `file://${process.argv[1]}`) {
    seedDatabase()
        .then(() => {
            console.log('Seed script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Seed script failed:', error);
            process.exit(1);
        })
        .finally(() => {
            prisma.$disconnect();
        });
}

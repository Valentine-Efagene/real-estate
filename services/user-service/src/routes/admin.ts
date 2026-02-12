import { Router, Request, Response, NextFunction } from 'express';
import { bootstrapService } from '../services/bootstrap.service';
import { bootstrapTenantSchema } from '../validators/bootstrap.validator';
import { AppError, ConfigService } from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import { runDemoBootstrap } from '../services/demo-bootstrap.service';

const router = Router();

// =============================================================================
// BOOTSTRAP ROUTES
// =============================================================================
// Admin-only endpoints for tenant bootstrapping. Protected by bootstrap secret.
// These endpoints are idempotent and safe to call multiple times.
// =============================================================================

/**
 * Middleware to verify bootstrap secret
 * Requires x-bootstrap-secret header matching SSM-stored secret
 */
const verifyBootstrapSecret = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const providedSecret = req.headers['x-bootstrap-secret'] as string;

        if (!providedSecret) {
            throw new AppError(401, 'Bootstrap secret required');
        }

        // Get expected secret from environment or SSM
        let expectedSecret = process.env.BOOTSTRAP_SECRET;

        // In production, fetch from SSM if not in env
        if (!expectedSecret && process.env.NODE_ENV !== 'local' && process.env.NODE_ENV !== 'test') {
            try {
                const configService = ConfigService.getInstance();
                const stage = process.env.STAGE || process.env.NODE_ENV || 'dev';
                // Fetch bootstrap secret from SSM (you'll need to add this method or use a direct call)
                // For now, fall back to environment variable
                expectedSecret = process.env.BOOTSTRAP_SECRET;
            } catch (error) {
                console.error('[Bootstrap] Failed to fetch secret from SSM:', error);
            }
        }

        // For local development, use a default if not set
        if (!expectedSecret && (process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'localstack')) {
            expectedSecret = 'local-bootstrap-secret';
        }

        if (!expectedSecret) {
            throw new AppError(500, 'Bootstrap secret not configured');
        }

        if (providedSecret !== expectedSecret) {
            throw new AppError(403, 'Invalid bootstrap secret');
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * GET /admin/public/bootstrap-status
 * 
 * Check if any tenant has been bootstrapped on the platform.
 * This endpoint is PUBLIC (no auth required) to allow the frontend
 * to detect bootstrap state across browsers.
 * 
 * Returns minimal info - just whether bootstrapped and the tenant ID if so.
 */
router.get(
    '/public/bootstrap-status',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Find the first active tenant (platform typically has one main tenant)
            const tenant = await prisma.tenant.findFirst({
                where: { isActive: true },
                select: {
                    id: true,
                    name: true,
                    subdomain: true,
                },
                orderBy: { createdAt: 'asc' },
            });

            if (!tenant) {
                res.json({
                    bootstrapped: false,
                    message: 'No tenant bootstrapped yet',
                });
                return;
            }

            res.json({
                bootstrapped: true,
                tenantId: tenant.id,
                tenantName: tenant.name,
                subdomain: tenant.subdomain,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /admin/bootstrap-tenant
 * 
 * Bootstrap a new tenant with roles, permissions, and first admin user.
 * Idempotent - safe to call multiple times with same subdomain.
 * 
 * Security: Requires x-bootstrap-secret header
 * 
 * Request Body:
 * {
 *   "tenant": { "name": "Acme Real Estate", "subdomain": "acme" },
 *   "admin": { "email": "admin@acme.com", "firstName": "Admin", "lastName": "User" },
 *   "roles": [...] // Optional - uses defaults if omitted
 * }
 * 
 * Response:
 * {
 *   "tenant": { "id": "...", "name": "...", "subdomain": "...", "isNew": true },
 *   "admin": { "id": "...", "email": "...", "isNew": true, "temporaryPassword": "..." },
 *   "roles": [{ "id": "...", "name": "admin", "isNew": true, "permissionsCount": 1 }, ...],
 *   "syncTriggered": true
 * }
 */
router.post(
    '/bootstrap-tenant',
    verifyBootstrapSecret,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = bootstrapTenantSchema.safeParse(req.body);

            if (!parsed.success) {
                throw new AppError(400, 'Validation failed');
            }

            const result = await bootstrapService.bootstrapTenant(parsed.data);

            // Log for audit
            console.log(`[Bootstrap] Tenant bootstrapped: ${result.tenant.subdomain}`, {
                tenantId: result.tenant.id,
                isNewTenant: result.tenant.isNew,
                adminEmail: result.admin.email,
                isNewAdmin: result.admin.isNew,
                rolesCreated: result.roles.filter((r) => r.isNew).length,
                syncTriggered: result.syncTriggered,
            });

            res.status(result.tenant.isNew ? 201 : 200).json(result);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /admin/bootstrap-status/:subdomain
 * 
 * Check if a tenant has been bootstrapped.
 * Useful for CI/CD scripts to verify bootstrap success.
 * 
 * Security: Requires x-bootstrap-secret header
 */
router.get(
    '/bootstrap-status/:subdomain',
    verifyBootstrapSecret,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const subdomain = req.params.subdomain as string;

            const tenant = await prisma.tenant.findUnique({
                where: { subdomain },
                include: {
                    roles: {
                        include: {
                            permissions: true,
                        },
                    },
                    memberships: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                            role: true,
                        },
                    },
                },
            });

            if (!tenant) {
                res.status(404).json({
                    bootstrapped: false,
                    subdomain,
                    message: 'Tenant not found',
                });
                return;
            }

            res.json({
                bootstrapped: true,
                tenant: {
                    id: tenant.id,
                    name: tenant.name,
                    subdomain: tenant.subdomain,
                    isActive: tenant.isActive,
                },
                roles: tenant.roles.map((r) => ({
                    id: r.id,
                    name: r.name,
                    isSystem: r.isSystem,
                    permissionsCount: r.permissions.length,
                })),
                admins: tenant.memberships
                    .filter((m) => m.role.name === 'admin')
                    .map((m) => ({
                        id: m.user.id,
                        email: m.user.email,
                        name: `${m.user.firstName} ${m.user.lastName}`,
                    })),
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /admin/users/:userId
 * 
 * Get user details by ID (for E2E testing).
 * Returns user info including verification token for testing email verification flow.
 * 
 * Security: Requires x-bootstrap-secret header
 */
router.get(
    '/users/:userId',
    verifyBootstrapSecret,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.params.userId as string;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    emailVerificationToken: true,
                    emailVerifiedAt: true,
                    isActive: true,
                    tenantMemberships: {
                        select: {
                            tenantId: true,
                            role: {
                                select: { name: true },
                            },
                        },
                    },
                },
            });

            if (!user) {
                res.status(404).json({
                    success: false,
                    error: { message: 'User not found' },
                });
                return;
            }

            res.json({
                success: true,
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /admin/reset
 * 
 * Reset the database by deleting all data.
 * Call this before bootstrap to start fresh.
 * 
 * Security: Requires x-bootstrap-secret header
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Database reset complete",
 *   "deleted": { "tenants": 1, "users": 5, ... }
 * }
 */
router.post(
    '/reset',
    verifyBootstrapSecret,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const stage = process.env.STAGE || process.env.NODE_ENV || 'dev';

            console.log(`[Admin Reset] Starting database reset for stage: ${stage}`);

            // Delete in order respecting foreign key constraints
            // Child tables first, then parent tables
            const deleted: Record<string, number> = {};

            // Level 1: Deepest children (no dependencies on them)
            const level1Tables = [
                'documentReview',
                'documentApproval',
                'approvalStageProgress',
                'questionnairePhaseReview',
                'questionnaireField',
                'applicationEvent',
                'paymentInstallment',
                'applicationPayment',
                'applicationDocument',
                'phaseEventAttachment',
                'stepEventAttachment',
                'offerLetter',
                'applicationTermination',
                'applicationRefund',
                'approvalRequest',
                'workflowBlocker',
                'domainEvent',
            ];

            for (const table of level1Tables) {
                try {
                    const result = await (prisma as any)[table].deleteMany({});
                    deleted[table] = result.count;
                } catch (e) {
                    console.log(`[Admin Reset] Skipping ${table}: ${(e as Error).message}`);
                }
            }

            // Level 2: Phase-related tables
            const level2Tables = [
                'questionnairePhase',
                'documentationPhase',
                'paymentPhase',
                'applicationPhase',
                'applicationOrganization',
            ];

            for (const table of level2Tables) {
                try {
                    const result = await (prisma as any)[table].deleteMany({});
                    deleted[table] = result.count;
                } catch (e) {
                    console.log(`[Admin Reset] Skipping ${table}: ${(e as Error).message}`);
                }
            }

            // Level 3: Applications and related
            const level3Tables = [
                'application',
                'paymentMethodChangeRequest',
                'propertyTransferRequest',
            ];

            for (const table of level3Tables) {
                try {
                    const result = await (prisma as any)[table].deleteMany({});
                    deleted[table] = result.count;
                } catch (e) {
                    console.log(`[Admin Reset] Skipping ${table}: ${(e as Error).message}`);
                }
            }

            // Level 4: Property and payment method config
            const level4Tables = [
                'paymentMethodPhaseStep',
                'paymentMethodPhaseDocument',
                'paymentMethodPhaseField',
                'propertyPaymentMethodPhase',
                'propertyPaymentMethodLink',
                'documentRequirementRule',
                'propertyUnit',
                'propertyVariantAmenity',
                'propertyVariantMedia',
                'propertyVariant',
                'propertyAmenity',
                'propertyMedia',
                'propertyDocument',
            ];

            for (const table of level4Tables) {
                try {
                    const result = await (prisma as any)[table].deleteMany({});
                    deleted[table] = result.count;
                } catch (e) {
                    console.log(`[Admin Reset] Skipping ${table}: ${(e as Error).message}`);
                }
            }

            // Level 5: Property and payment methods
            const level5Tables = [
                'property',
                'propertyPaymentMethod',
                'paymentPlan',
                'documentDefinition',
                'approvalStage',
                'documentationPlan',
                'questionnairePlanQuestion',
                'questionnairePlan',
                'documentTemplate',
                'amenity',
            ];

            for (const table of level5Tables) {
                try {
                    const result = await (prisma as any)[table].deleteMany({});
                    deleted[table] = result.count;
                } catch (e) {
                    console.log(`[Admin Reset] Skipping ${table}: ${(e as Error).message}`);
                }
            }

            // Level 6: Organizations
            const level6Tables = [
                'bankDocumentRequirement',
                'organizationMember',
                'organization',
            ];

            for (const table of level6Tables) {
                try {
                    const result = await (prisma as any)[table].deleteMany({});
                    deleted[table] = result.count;
                } catch (e) {
                    console.log(`[Admin Reset] Skipping ${table}: ${(e as Error).message}`);
                }
            }

            // Level 7: Events and handlers
            const level7Tables = [
                'eventHandler',
                'eventType',
                'eventChannel',
                'apiKey',
            ];

            for (const table of level7Tables) {
                try {
                    const result = await (prisma as any)[table].deleteMany({});
                    deleted[table] = result.count;
                } catch (e) {
                    console.log(`[Admin Reset] Skipping ${table}: ${(e as Error).message}`);
                }
            }

            // Level 8: User-related
            const level8Tables = [
                'refreshToken',
                'passwordReset',
                'userSuspension',
                'emailPreference',
                'deviceEndpoint',
                'social',
                'rolePermission',
                'tenantMembership',
                'transaction',
                'wallet',
            ];

            for (const table of level8Tables) {
                try {
                    const result = await (prisma as any)[table].deleteMany({});
                    deleted[table] = result.count;
                } catch (e) {
                    console.log(`[Admin Reset] Skipping ${table}: ${(e as Error).message}`);
                }
            }

            // Level 9: Core entities
            const level9Tables = [
                'user',
                'permission',
                'role',
                'settings',
                'oAuthState',
            ];

            for (const table of level9Tables) {
                try {
                    const result = await (prisma as any)[table].deleteMany({});
                    deleted[table] = result.count;
                } catch (e) {
                    console.log(`[Admin Reset] Skipping ${table}: ${(e as Error).message}`);
                }
            }

            // Level 10: Tenants (last)
            try {
                const result = await prisma.tenant.deleteMany({});
                deleted['tenant'] = result.count;
            } catch (e) {
                console.log(`[Admin Reset] Skipping tenant: ${(e as Error).message}`);
            }

            // Calculate totals
            const totalDeleted = Object.values(deleted).reduce((sum, count) => sum + count, 0);

            console.log(`[Admin Reset] Database reset complete. Total records deleted: ${totalDeleted}`);

            res.json({
                success: true,
                message: 'Database reset complete',
                stage,
                totalDeleted,
                deleted,
            });
        } catch (error) {
            next(error);
        }
    }
);

// =============================================================================
// DEMO BOOTSTRAP
// =============================================================================
// Creates a complete demo environment in one call:
// - Resets DB, bootstraps tenant, creates orgs, invites actors
// - Creates property with variant/unit, publishes it
// - Creates MREIF 10/90 payment method with 5 phases, links to property
//
// External service URLs are read from env vars (set via SSM in serverless.yml).
// The caller can also pass them in the request body to override.
// =============================================================================

router.post(
    '/demo-bootstrap',
    verifyBootstrapSecret,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const propertyServiceUrl =
                req.body.propertyServiceUrl || process.env.PROPERTY_SERVICE_URL;
            const mortgageServiceUrl =
                req.body.mortgageServiceUrl || process.env.MORTGAGE_SERVICE_URL;
            const paymentServiceUrl =
                req.body.paymentServiceUrl || process.env.PAYMENT_SERVICE_URL;

            if (!propertyServiceUrl || !mortgageServiceUrl || !paymentServiceUrl) {
                throw new AppError(
                    400,
                    'Missing service URLs. Provide propertyServiceUrl, mortgageServiceUrl, and paymentServiceUrl ' +
                    'in the request body or configure PROPERTY_SERVICE_URL, MORTGAGE_SERVICE_URL, PAYMENT_SERVICE_URL env vars.',
                );
            }

            console.log('[Demo Bootstrap] Starting full demo environment setup...');
            console.log('[Demo Bootstrap] External URLs:', { propertyServiceUrl, mortgageServiceUrl, paymentServiceUrl });

            const result = await runDemoBootstrap({
                propertyServiceUrl,
                mortgageServiceUrl,
                paymentServiceUrl,
            });

            console.log(`[Demo Bootstrap] Complete. ${result.steps.length} steps executed.`);

            res.status(201).json(result);
        } catch (error) {
            console.error('[Demo Bootstrap] Failed:', error);
            next(error);
        }
    }
);

export const adminRouter = router;

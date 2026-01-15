import { AppError, createTenantPrisma, ApplicationStatus } from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma';
import { PropertyUnit } from '@valentine-efagene/qshelter-common/dist/generated/client/client';
import { sendApplicationSupersededNotification } from '../lib/notifications';

/**
 * Unit Locking Service
 * 
 * Handles the business logic for locking property units when a configured phase completes.
 * When a unit is locked for a buyer, competing applications are superseded.
 */
class UnitLockingService {
    /**
     * Lock a unit for an application when the lock phase completes.
     * 
     * This method:
     * 1. Verifies the application exists and is active
     * 2. Updates the PropertyUnit with reservation details
     * 3. Finds and supersedes all competing applications for the same unit
     * 4. Logs the event for audit
     * 
     * @param tenantId - Tenant context
     * @param applicationId - The application that is locking the unit
     * @param actorId - User who triggered this (for audit)
     */
    async lockUnitForApplication(
        tenantId: string,
        applicationId: string,
        actorId?: string
    ): Promise<{
        lockedUnit: PropertyUnit;
        supersededCount: number;
        supersededApplicationIds: string[];
    }> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Get the application with its unit
        const application = await tenantPrisma.application.findUnique({
            where: { id: applicationId },
            include: {
                propertyUnit: true,
                buyer: true,
            },
        });

        if (!application) {
            throw new AppError(404, 'Application not found');
        }

        if (application.status !== 'ACTIVE') {
            throw new AppError(400, `Cannot lock unit for application in ${application.status} status`);
        }

        const unit = application.propertyUnit;

        // Check if unit is already locked by another application
        if (unit.reservedById && unit.reservedById !== application.buyerId) {
            throw new AppError(
                409,
                `Unit is already locked by another buyer (reservedById: ${unit.reservedById})`
            );
        }

        // If already locked by this buyer, just return success
        if (unit.reservedById === application.buyerId) {
            return {
                lockedUnit: unit,
                supersededCount: 0,
                supersededApplicationIds: [],
            };
        }

        // Execute the lock in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Lock the unit
            const lockedUnit = await tx.propertyUnit.update({
                where: { id: unit.id },
                data: {
                    status: 'RESERVED',
                    reservedById: application.buyerId,
                    reservedAt: new Date(),
                },
            });

            // 2. Find all competing applications (same unit, active status, different application)
            const competingApplications = await tx.application.findMany({
                where: {
                    tenantId,
                    propertyUnitId: unit.id,
                    status: 'ACTIVE' as ApplicationStatus,
                    id: { not: applicationId },
                },
                include: {
                    buyer: true,
                    propertyUnit: {
                        include: {
                            variant: {
                                include: {
                                    property: true,
                                },
                            },
                        },
                    },
                },
            });

            const supersededApplicationIds: string[] = [];
            const supersededNotifications: Array<{
                email: string;
                userName: string;
                applicationNumber: string;
                propertyName: string;
                unitNumber: string;
            }> = [];

            // 3. Supersede all competing applications
            for (const competing of competingApplications) {
                await tx.application.update({
                    where: { id: competing.id },
                    data: {
                        status: 'SUPERSEDED' as ApplicationStatus,
                        supersededById: applicationId,
                        supersededAt: new Date(),
                    },
                });
                supersededApplicationIds.push(competing.id);

                // Collect notification data
                if (competing.buyer?.email) {
                    supersededNotifications.push({
                        email: competing.buyer.email,
                        userName: `${competing.buyer.firstName || ''} ${competing.buyer.lastName || ''}`.trim() || 'Valued Customer',
                        applicationNumber: competing.applicationNumber,
                        propertyName: competing.propertyUnit?.variant?.property?.title || 'Property',
                        unitNumber: competing.propertyUnit?.unitNumber || 'Unknown',
                    });
                }

                // Log the supersede event
                await tx.applicationEvent.create({
                    data: {
                        tenantId,
                        applicationId: competing.id,
                        eventType: 'APPLICATION_STATE_CHANGED',
                        eventGroup: 'STATE_CHANGE',
                        fromState: 'ACTIVE',
                        toState: 'SUPERSEDED',
                        trigger: 'UNIT_LOCKED_BY_COMPETITOR',
                        data: {
                            supersededByApplicationId: applicationId,
                            supersededByBuyerId: application.buyerId,
                            unitId: unit.id,
                            unitNumber: unit.unitNumber,
                        },
                        actorId,
                        actorType: actorId ? 'USER' : 'SYSTEM',
                    },
                });
            }

            // 4. Log the lock event on the winning application
            await tx.applicationEvent.create({
                data: {
                    tenantId,
                    applicationId,
                    eventType: 'APPLICATION_STATE_CHANGED',
                    eventGroup: 'STATE_CHANGE',
                    trigger: 'UNIT_LOCKED',
                    data: {
                        unitId: unit.id,
                        unitNumber: unit.unitNumber,
                        supersededCount: supersededApplicationIds.length,
                        supersededApplicationIds,
                    },
                    actorId,
                    actorType: actorId ? 'USER' : 'SYSTEM',
                },
            });

            return {
                lockedUnit,
                supersededCount: supersededApplicationIds.length,
                supersededApplicationIds,
                supersededNotifications,
            };
        });

        // Send notifications to superseded buyers (outside transaction for resilience)
        const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.contribuild.com';
        for (const notification of result.supersededNotifications) {
            try {
                await sendApplicationSupersededNotification({
                    ...notification,
                    dashboardUrl,
                });
            } catch (error) {
                console.error(`Failed to send supersede notification to ${notification.email}:`, error);
            }
        }

        return {
            lockedUnit: result.lockedUnit,
            supersededCount: result.supersededCount,
            supersededApplicationIds: result.supersededApplicationIds,
        };
    }

    /**
     * Release a unit lock when an application is terminated or cancelled.
     * 
     * @param tenantId - Tenant context
     * @param applicationId - The application releasing the lock
     * @param actorId - User who triggered this (for audit)
     */
    async releaseUnitLock(
        tenantId: string,
        applicationId: string,
        actorId?: string
    ): Promise<{ releasedUnit: any | null }> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        // Get the application with its unit
        const application = await tenantPrisma.application.findUnique({
            where: { id: applicationId },
            include: {
                propertyUnit: true,
            },
        });

        if (!application) {
            throw new AppError(404, 'Application not found');
        }

        const unit = application.propertyUnit;

        // Only release if this application holds the lock
        if (unit.reservedById !== application.buyerId) {
            return { releasedUnit: null };
        }

        // Release the lock
        const releasedUnit = await prisma.propertyUnit.update({
            where: { id: unit.id },
            data: {
                status: 'AVAILABLE',
                reservedById: null,
                reservedAt: null,
                reservedUntil: null,
            },
        });

        // Log the release event
        await prisma.applicationEvent.create({
            data: {
                tenantId,
                applicationId,
                eventType: 'APPLICATION_STATE_CHANGED',
                eventGroup: 'STATE_CHANGE',
                trigger: 'UNIT_RELEASED',
                data: {
                    unitId: unit.id,
                    unitNumber: unit.unitNumber,
                    reason: `Application ${application.status}`,
                },
                actorId,
                actorType: actorId ? 'USER' : 'SYSTEM',
            },
        });

        return { releasedUnit };
    }

    /**
     * Check if a phase is configured to lock the unit on completion.
     * 
     * @param phaseTemplateId - The PropertyPaymentMethodPhase ID
     */
    async isLockPhase(phaseTemplateId: string): Promise<boolean> {
        const phase = await prisma.propertyPaymentMethodPhase.findUnique({
            where: { id: phaseTemplateId },
            select: { lockUnitOnComplete: true },
        });

        return phase?.lockUnitOnComplete ?? false;
    }

    /**
     * Get all superseded applications for a unit.
     * 
     * @param tenantId - Tenant context
     * @param unitId - The property unit ID
     */
    async getSupersededApplications(
        tenantId: string,
        unitId: string
    ): Promise<any[]> {
        const tenantPrisma = createTenantPrisma(prisma, { tenantId });

        return tenantPrisma.application.findMany({
            where: {
                propertyUnitId: unitId,
                status: 'SUPERSEDED' as ApplicationStatus,
            },
            include: {
                buyer: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                supersededBy: {
                    select: {
                        id: true,
                        applicationNumber: true,
                        buyer: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });
    }
}

export const unitLockingService = new UnitLockingService();

import type { ScheduledEvent } from 'aws-lambda';
import { prisma } from '../lib/prisma';
import { sendSlaWarningNotification, sendSlaBreachedNotification } from '../lib/notifications';

// How many hours before breach to send a warning
const SLA_WARNING_HOURS = 6;

// Ops email for internal alerts — override via env var
const OPS_EMAIL = process.env.OPS_EMAIL ?? 'ops@qshelter.com';
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? '';

/**
 * Scheduled Lambda: SLA Breach Checker
 *
 * Runs every hour. Finds ApplicationOrganization records where:
 * - slaHours is set (SLA tracking is enabled)
 * - slaStartedAt is set (clock has started)
 * - slaBreachedAt is NULL (not yet marked breached)
 *
 * For records within SLA_WARNING_HOURS of the deadline, sends a warning.
 * For records past the deadline, marks them breached and sends an alert.
 */
export const handler = async (_event: ScheduledEvent): Promise<void> => {
    console.log('[SLA Checker] Starting SLA breach check', { time: new Date().toISOString() });

    const now = new Date();

    try {
        const tracked = await (prisma as any).applicationOrganization.findMany({
            where: {
                slaHours: { not: null },
                slaStartedAt: { not: null },
                slaBreachedAt: null,
            },
            include: {
                application: {
                    select: {
                        id: true,
                        applicationNumber: true,
                        propertyUnit: {
                            select: {
                                variant: {
                                    select: {
                                        property: { select: { title: true } },
                                    },
                                },
                            },
                        },
                    },
                },
                assignedAsType: { select: { code: true, name: true } },
            },
        });

        console.log('[SLA Checker] Records to check:', tracked.length);

        let breachedCount = 0;
        let warnedCount = 0;

        for (const record of tracked) {
            const slaDeadline = new Date(record.slaStartedAt);
            slaDeadline.setHours(slaDeadline.getHours() + record.slaHours);

            const hoursUntilBreach = (slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
            const propertyName =
                record.application?.propertyUnit?.variant?.property?.title ?? 'Unknown Property';
            const applicationNumber = record.application?.applicationNumber ?? record.applicationId;
            const stageName = record.assignedAsType?.name ?? record.assignedAsType?.code ?? 'Review Stage';
            const applicationId = record.applicationId;

            if (hoursUntilBreach <= 0) {
                // SLA has been breached — mark and notify
                const hoursOverdue = Math.round(Math.abs(hoursUntilBreach));

                await (prisma as any).applicationOrganization.update({
                    where: { id: record.id },
                    data: { slaBreachedAt: now, slaBreachNotified: true },
                });

                try {
                    await sendSlaBreachedNotification({
                        email: OPS_EMAIL,
                        recipientName: 'QShelter Ops Team',
                        applicationNumber,
                        propertyName,
                        stageName,
                        slaDeadline: slaDeadline.toISOString(),
                        breachedAt: now.toISOString(),
                        hoursOverdue,
                        dashboardUrl: `${DASHBOARD_URL}/applications/${applicationId}`,
                    });
                } catch (notifyErr) {
                    console.error('[SLA Checker] Failed to send breach notification', {
                        applicationOrganizationId: record.id,
                        error: notifyErr instanceof Error ? notifyErr.message : notifyErr,
                    });
                }

                breachedCount++;
                console.log('[SLA Checker] Marked as breached', { applicationOrganizationId: record.id, applicationNumber, hoursOverdue });
            } else if (hoursUntilBreach <= SLA_WARNING_HOURS && !record.slaBreachNotified) {
                // Within warning window — send warning once
                const hoursRemaining = Math.round(hoursUntilBreach);

                try {
                    await sendSlaWarningNotification({
                        email: OPS_EMAIL,
                        recipientName: 'QShelter Ops Team',
                        applicationNumber,
                        propertyName,
                        stageName,
                        slaDeadline: slaDeadline.toISOString(),
                        hoursRemaining,
                        dashboardUrl: `${DASHBOARD_URL}/applications/${applicationId}`,
                    });
                } catch (notifyErr) {
                    console.error('[SLA Checker] Failed to send warning notification', {
                        applicationOrganizationId: record.id,
                        error: notifyErr instanceof Error ? notifyErr.message : notifyErr,
                    });
                }

                warnedCount++;
                console.log('[SLA Checker] Sent SLA warning', { applicationOrganizationId: record.id, applicationNumber, hoursRemaining });
            }
        }

        console.log('[SLA Checker] Completed', {
            total: tracked.length,
            breached: breachedCount,
            warned: warnedCount,
        });
    } catch (error) {
        console.error('[SLA Checker] Fatal error', {
            error: error instanceof Error ? error.message : error,
        });
        throw error;
    }
};

/**
 * Scheduled Lambda: SLA Breach Checker
 *
 * Runs every hour. Finds ApplicationOrganization records where:
 * - slaHours is set
 * - slaStartedAt is set
 * - slaBreachedAt is NULL (not yet marked breached)
 * - The SLA deadline has passed (slaStartedAt + slaHours < NOW)
 *
 * For records approaching the SLA deadline (within 6 hours), sends a warning.
 * For records that have passed the deadline, marks them as breached and notifies.
 */
export const handler = async (event: ScheduledEvent): Promise<void> => {
    console.log('[SLA Checker] Starting SLA breach check', { time: new Date().toISOString() });

    const now = new Date();
    const SLA_WARNING_HOURS = 6; // Warn when within 6 hours of breach

    try {
        // Find all ApplicationOrganization records with SLA tracking enabled and not yet breached
        const tracked = await (prisma as any).applicationOrganization.findMany({
            where: {
                slaHours: { not: null },
                slaStartedAt: { not: null },
                slaBreachedAt: null,
            },
            include: {
                application: {
                    select: {
                        id: true,
                        tenantId: true,
                        applicationNumber: true,
                        buyer: {
                            select: { id: true, email: true, firstName: true, lastName: true },
                        },
                        propertyUnit: {
                            select: {
                                variant: {
                                    select: {
                                        property: { select: { title: true } },
                                    },
                                },
                            },
                        },
                    },
                },
                organization: { select: { id: true, name: true } },
                assignedAsType: { select: { code: true, name: true } },
            },
        });

        console.log('[SLA Checker] Found records to check:', tracked.length);

        let breachedCount = 0;
        let warningCount = 0;

        for (const record of tracked) {
            const slaDeadline = new Date(record.slaStartedAt);
            slaDeadline.setHours(slaDeadline.getHours() + record.slaHours);

            const hoursUntilBreach = (slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
            const propertyName =
                record.application?.propertyUnit?.variant?.property?.title ?? 'Unknown Property';
            const applicationNumber = record.application?.applicationNumber ?? record.applicationId;

            if (hoursUntilBreach <= 0) {
                // SLA has been breached
                const hoursOverdue = Math.abs(hoursUntilBreach);

                await (prisma as any).applicationOrganization.update({
                    where: { id: record.id },
                    data: {
                        slaBreachedAt: now,
                        slaBreachNotified: true,
                    },
                });

                // Notify ops team
                await publishNotification(record.application.tenantId, {
                    type: NotificationType.SLA_BREACHED,
                    channel: NotificationChannel.EMAIL,
                    payload: {
                        to_email: 'ops@qshelter.com', // Platform ops email - configurable via env
                        recipientName: 'QShelter Ops Team',
                        applicationNumber,
                        propertyName,
                        stageName: record.assignedAsType?.name ?? record.assignedAsType?.code ?? 'Review Stage',
                        slaDeadline: slaDeadline.toISOString(),
                        breachedAt: now.toISOString(),
                        hoursOverdue: Math.round(hoursOverdue),
                        dashboardLink: `${process.env.DASHBOARD_URL ?? ''}/applications/${record.applicationId}`,
                    },
                });

                breachedCount++;
                console.log('[SLA Checker] Marked as breached', {
                    applicationOrganizationId: record.id,
                    applicationNumber,
                    hoursOverdue: Math.round(hoursOverdue),
                });
            } else if (hoursUntilBreach <= SLA_WARNING_HOURS && !record.slaBreachNotified) {
                // Within warning window — send warning if not already notified
                await publishNotification(record.application.tenantId, {
                    type: NotificationType.SLA_WARNING,
                    channel: NotificationChannel.EMAIL,
                    payload: {
                        to_email: 'ops@qshelter.com',
                        recipientName: 'QShelter Ops Team',
                        applicationNumber,
                        propertyName,
                        stageName: record.assignedAsType?.name ?? record.assignedAsType?.code ?? 'Review Stage',
                        slaDeadline: slaDeadline.toISOString(),
                        hoursRemaining: Math.round(hoursUntilBreach),
                        dashboardLink: `${process.env.DASHBOARD_URL ?? ''}/applications/${record.applicationId}`,
                    },
                });

                warningCount++;
                console.log('[SLA Checker] Sent SLA warning', {
                    applicationOrganizationId: record.id,
                    applicationNumber,
                    hoursRemaining: Math.round(hoursUntilBreach),
                });
            }
        }

        console.log('[SLA Checker] Completed', {
            total: tracked.length,
            breached: breachedCount,
            warned: warningCount,
        });
    } catch (error) {
        console.error('[SLA Checker] Error during SLA check', {
            error: error instanceof Error ? error.message : error,
        });
        throw error;
    }
};

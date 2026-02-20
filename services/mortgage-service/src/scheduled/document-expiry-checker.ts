import type { ScheduledEvent } from 'aws-lambda';
import { prisma } from '../lib/prisma';

// How many days before expiry to send a warning
const EXPIRY_WARNING_DAYS = 7;

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? '';

/**
 * Scheduled Lambda: Document Expiry Checker
 *
 * Runs daily. Scans ApplicationDocument records where:
 * - expiresAt is set
 * - isExpired = false
 * - Either: expiresAt has passed (mark as expired)
 *   Or: expiresAt is within EXPIRY_WARNING_DAYS (send warning)
 */
export const handler = async (_event: ScheduledEvent): Promise<void> => {
    console.log('[Doc Expiry] Starting document expiry check', { time: new Date().toISOString() });

    const now = new Date();
    const warningThreshold = new Date(now);
    warningThreshold.setDate(warningThreshold.getDate() + EXPIRY_WARNING_DAYS);

    try {
        // Find documents that have expired but aren't marked as such
        const expiredDocs = await (prisma as any).applicationDocument.findMany({
            where: {
                isExpired: false,
                expiresAt: { not: null, lt: now },
            },
            include: {
                application: {
                    select: {
                        id: true,
                        applicationNumber: true,
                        tenantId: true,
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
            },
        });

        // Find documents approaching expiry (warning not yet sent)
        const expiringDocs = await (prisma as any).applicationDocument.findMany({
            where: {
                isExpired: false,
                expiresAt: { gte: now, lte: warningThreshold },
                expiryWarningAt: null,
            },
            include: {
                application: {
                    select: {
                        id: true,
                        applicationNumber: true,
                        tenantId: true,
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
            },
        });

        console.log('[Doc Expiry] Found expired docs:', expiredDocs.length);
        console.log('[Doc Expiry] Found expiring docs (warning):', expiringDocs.length);

        // Mark expired documents
        if (expiredDocs.length > 0) {
            const expiredIds = expiredDocs.map((d: { id: string }) => d.id);
            await (prisma as any).applicationDocument.updateMany({
                where: { id: { in: expiredIds } },
                data: { isExpired: true, expiredAt: now },
            });
            console.log('[Doc Expiry] Marked as expired:', expiredIds.length);
        }

        // Record warning timestamp for docs approaching expiry
        // (actual email is sent by the notification service via document.service when needed)
        if (expiringDocs.length > 0) {
            const expiringIds = expiringDocs.map((d: { id: string }) => d.id);
            await (prisma as any).applicationDocument.updateMany({
                where: { id: { in: expiringIds } },
                data: { expiryWarningAt: now },
            });
            console.log('[Doc Expiry] Marked expiry warnings:', expiringIds.length);
        }

        console.log('[Doc Expiry] Completed', {
            marked_expired: expiredDocs.length,
            warned: expiringDocs.length,
        });
    } catch (error) {
        console.error('[Doc Expiry] Fatal error', {
            error: error instanceof Error ? error.message : error,
        });
        throw error;
    }
};

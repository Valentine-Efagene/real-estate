import type { ScheduledEvent } from 'aws-lambda';
import { prisma } from '../lib/prisma';
import { sendPaymentReminderNotification } from '../lib/notifications';

// Send reminders this many days before the due date
const REMINDER_DAYS_BEFORE = [7, 3, 1];

const PAYMENT_URL = process.env.PAYMENT_URL ?? process.env.DASHBOARD_URL ?? '';

/**
 * Scheduled Lambda: Payment Reminder Sender
 *
 * Runs daily. Finds Applications where:
 * - status is ACTIVE
 * - nextPaymentDueDate is set
 * - dueDate is within REMINDER_DAYS_BEFORE threshold
 * - No reminder sent today (lastReminderSentAt < today)
 *
 * Sends a payment reminder email to the buyer.
 */
export const handler = async (_event: ScheduledEvent): Promise<void> => {
    console.log('[Payment Reminder] Starting', { time: new Date().toISOString() });

    const now = new Date();

    // Calculate the outermost reminder threshold
    const maxDaysAhead = Math.max(...REMINDER_DAYS_BEFORE);
    const reminderWindowEnd = new Date(now);
    reminderWindowEnd.setDate(reminderWindowEnd.getDate() + maxDaysAhead + 1);

    // Don't re-send if already reminded today
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    try {
        const applications = await (prisma as any).application.findMany({
            where: {
                status: 'ACTIVE',
                nextPaymentDueDate: {
                    gte: now,                // Due in the future
                    lte: reminderWindowEnd,  // Within the reminder window
                },
                OR: [
                    { lastReminderSentAt: null },
                    { lastReminderSentAt: { lt: startOfToday } },
                ],
            },
            include: {
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
        });

        console.log('[Payment Reminder] Applications to process:', applications.length);

        let sentCount = 0;

        for (const app of applications) {
            const dueDate = new Date(app.nextPaymentDueDate);
            const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            // Only send on the configured threshold days
            if (!REMINDER_DAYS_BEFORE.includes(daysUntilDue)) {
                continue;
            }

            const buyerEmail = app.buyer?.email;
            if (!buyerEmail) {
                console.warn('[Payment Reminder] No buyer email for application', { applicationId: app.id });
                continue;
            }

            const propertyName =
                app.propertyUnit?.variant?.property?.title ?? 'Unknown Property';

            try {
                await sendPaymentReminderNotification({
                    email: buyerEmail,
                    userName: `${app.buyer.firstName ?? ''} ${app.buyer.lastName ?? ''}`.trim() || 'Customer',
                    applicationNumber: app.applicationNumber ?? app.id,
                    propertyName,
                    amount: 0, // Amount is determined by the active payment phase
                    dueDate,
                    daysUntilDue,
                    paymentUrl: `${PAYMENT_URL}/applications/${app.id}/payments`,
                });

                await (prisma as any).application.update({
                    where: { id: app.id },
                    data: { lastReminderSentAt: now },
                });

                sentCount++;
                console.log('[Payment Reminder] Sent reminder', {
                    applicationId: app.id,
                    daysUntilDue,
                    buyerEmail,
                });
            } catch (sendErr) {
                console.error('[Payment Reminder] Failed to send reminder', {
                    applicationId: app.id,
                    error: sendErr instanceof Error ? sendErr.message : sendErr,
                });
            }
        }

        console.log('[Payment Reminder] Completed', {
            total: applications.length,
            sent: sentCount,
        });
    } catch (error) {
        console.error('[Payment Reminder] Fatal error', {
            error: error instanceof Error ? error.message : error,
        });
        throw error;
    }
};

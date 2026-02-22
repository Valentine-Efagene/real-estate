import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import { randomUUID } from 'crypto';
import {
    InviteCoApplicantInput,
    UpdateCoApplicantInput,
    RemoveCoApplicantInput,
} from '../validators/co-applicant.validator';
import {
    sendCoApplicantInvitedNotification,
    formatDate,
} from '../lib/notifications';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://app.qshelter.com';
const TOKEN_EXPIRY_DAYS = 7;

export function createCoApplicantService(prisma: PrismaClient) {
    return {
        /**
         * List all co-applicants on an application.
         */
        async list(applicationId: string) {
            return prisma.coApplicant.findMany({
                where: { applicationId },
                orderBy: { invitedAt: 'asc' },
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, lastName: true },
                    },
                },
            });
        },

        /**
         * Invite a co-applicant to an application.
         * If the email already has an INVITED record, regenerates their token instead of throwing 409.
         */
        async invite(
            applicationId: string,
            data: InviteCoApplicantInput,
            tenantId: string,
        ) {
            // Check application exists and is active-ish
            const application = await prisma.application.findUnique({
                where: { id: applicationId },
                include: {
                    buyer: { select: { id: true, email: true, firstName: true, lastName: true } },
                    propertyUnit: {
                        include: { variant: { include: { property: true } } },
                    },
                },
            });
            if (!application) {
                throw new AppError(404, 'Application not found');
            }

            // Check buyer doesn't invite themselves
            if (application.buyer?.email === data.email) {
                throw new AppError(400, 'The primary applicant cannot be added as a co-applicant');
            }

            // Check for existing invite — if re-inviting, regenerate token rather than 409
            const existing = await prisma.coApplicant.findUnique({
                where: { applicationId_email: { applicationId, email: data.email } },
            });

            const inviteToken = randomUUID();
            const inviteTokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

            if (existing) {
                if (existing.status === 'ACTIVE') {
                    throw new AppError(409, 'This person has already accepted the invitation');
                }
                if (existing.status === 'REMOVED') {
                    throw new AppError(409, 'This co-applicant was removed from the application');
                }
                // Re-invite: update record with fresh token and provided data
                const updated = await prisma.coApplicant.update({
                    where: { id: existing.id },
                    data: {
                        firstName: data.firstName,
                        lastName: data.lastName,
                        relationship: data.relationship,
                        monthlyIncome: data.monthlyIncome,
                        employmentType: data.employmentType,
                        status: 'INVITED',
                        inviteToken,
                        inviteTokenExpiresAt,
                        invitedAt: new Date(),
                    },
                    include: {
                        user: {
                            select: { id: true, email: true, firstName: true, lastName: true },
                        },
                    },
                });
                await this._sendInviteNotification(updated, application, inviteToken, inviteTokenExpiresAt);
                return updated;
            }

            // Find user account if they already exist
            const invitedUser = await prisma.user.findFirst({
                where: { email: data.email },
                select: { id: true },
            });

            const created = await prisma.coApplicant.create({
                data: {
                    tenantId,
                    applicationId,
                    email: data.email,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    relationship: data.relationship,
                    monthlyIncome: data.monthlyIncome,
                    employmentType: data.employmentType,
                    userId: invitedUser?.id ?? null,
                    status: 'INVITED',
                    inviteToken,
                    inviteTokenExpiresAt,
                },
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, lastName: true },
                    },
                },
            });

            await this._sendInviteNotification(created, application, inviteToken, inviteTokenExpiresAt);
            return created;
        },

        /**
         * Internal: send invite notification email
         */
        async _sendInviteNotification(
            coApplicant: any,
            application: any,
            inviteToken: string,
            expiresAt: Date,
        ) {
            try {
                const inviterName = application.buyer
                    ? `${application.buyer.firstName} ${application.buyer.lastName}`
                    : 'Your co-applicant';
                const propertyName = application.propertyUnit?.variant?.property?.name || application.title;
                const acceptLink = `${DASHBOARD_URL}/co-applicant-invite?token=${inviteToken}`;

                await sendCoApplicantInvitedNotification({
                    email: coApplicant.email,
                    inviteeName: `${coApplicant.firstName} ${coApplicant.lastName}`,
                    inviterName,
                    applicationTitle: application.title,
                    propertyName,
                    acceptLink,
                    expiresAt: formatDate(expiresAt),
                });
            } catch (err) {
                // Notification failure should not block invite creation
                console.error('Failed to send co-applicant invite notification:', err);
            }
        },

        /**
         * Accept a co-applicant invitation via invite token (for new or returning users).
         */
        async acceptByToken(token: string, userId: string) {
            const coApplicant = await prisma.coApplicant.findUnique({
                where: { inviteToken: token },
            });

            if (!coApplicant) {
                throw new AppError(404, 'Invalid or expired invitation token');
            }

            if (coApplicant.status !== 'INVITED') {
                throw new AppError(
                    400,
                    `Cannot accept an invitation with status: ${coApplicant.status}`,
                );
            }

            if (coApplicant.inviteTokenExpiresAt && coApplicant.inviteTokenExpiresAt < new Date()) {
                throw new AppError(400, 'This invitation has expired. Please ask the primary applicant to resend it.');
            }

            return prisma.coApplicant.update({
                where: { id: coApplicant.id },
                data: {
                    status: 'ACTIVE',
                    userId,
                    acceptedAt: new Date(),
                    // Clear token after use
                    inviteToken: null,
                    inviteTokenExpiresAt: null,
                },
                include: {
                    application: { select: { id: true, title: true } },
                    user: {
                        select: { id: true, email: true, firstName: true, lastName: true },
                    },
                },
            });
        },

        /**
         * Update co-applicant details (before they accept).
         */
        async update(
            applicationId: string,
            coApplicantId: string,
            data: UpdateCoApplicantInput,
        ) {
            const coApplicant = await prisma.coApplicant.findFirst({
                where: { id: coApplicantId, applicationId },
            });
            if (!coApplicant) {
                throw new AppError(404, 'Co-applicant not found');
            }

            return prisma.coApplicant.update({
                where: { id: coApplicantId },
                data,
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, lastName: true },
                    },
                },
            });
        },

        /**
         * Co-applicant accepts their invitation (self-service by ID — for existing users).
         * Called when the invited user logs in and accepts.
         */
        async accept(applicationId: string, coApplicantId: string, userId: string) {
            const coApplicant = await prisma.coApplicant.findFirst({
                where: { id: coApplicantId, applicationId },
            });
            if (!coApplicant) {
                throw new AppError(404, 'Co-applicant not found');
            }
            if (coApplicant.status !== 'INVITED') {
                throw new AppError(
                    400,
                    `Cannot accept an invitation with status: ${coApplicant.status}`,
                );
            }

            return prisma.coApplicant.update({
                where: { id: coApplicantId },
                data: {
                    status: 'ACTIVE',
                    userId,
                    acceptedAt: new Date(),
                    inviteToken: null,
                    inviteTokenExpiresAt: null,
                },
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, lastName: true },
                    },
                },
            });
        },

        /**
         * Co-applicant declines their invitation.
         */
        async decline(applicationId: string, coApplicantId: string) {
            const coApplicant = await prisma.coApplicant.findFirst({
                where: { id: coApplicantId, applicationId },
            });
            if (!coApplicant) {
                throw new AppError(404, 'Co-applicant not found');
            }
            if (coApplicant.status !== 'INVITED') {
                throw new AppError(
                    400,
                    `Cannot decline an invitation with status: ${coApplicant.status}`,
                );
            }

            return prisma.coApplicant.update({
                where: { id: coApplicantId },
                data: { status: 'DECLINED', inviteToken: null, inviteTokenExpiresAt: null },
            });
        },

        /**
         * Remove a co-applicant (admin or primary buyer).
         */
        async remove(
            applicationId: string,
            coApplicantId: string,
            removedById: string,
            data: RemoveCoApplicantInput,
        ) {
            const coApplicant = await prisma.coApplicant.findFirst({
                where: { id: coApplicantId, applicationId },
            });
            if (!coApplicant) {
                throw new AppError(404, 'Co-applicant not found');
            }
            if (coApplicant.status === 'REMOVED') {
                throw new AppError(400, 'Co-applicant has already been removed');
            }

            return prisma.coApplicant.update({
                where: { id: coApplicantId },
                data: {
                    status: 'REMOVED',
                    removedAt: new Date(),
                    removedById,
                    removalReason: data.reason,
                    inviteToken: null,
                    inviteTokenExpiresAt: null,
                },
            });
        },
    };
}

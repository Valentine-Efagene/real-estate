import { AppError, PrismaClient } from '@valentine-efagene/qshelter-common';
import {
    InviteCoApplicantInput,
    UpdateCoApplicantInput,
    RemoveCoApplicantInput,
} from '../validators/co-applicant.validator';

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
         * The primary buyer or an admin can invite.
         */
        async invite(
            applicationId: string,
            data: InviteCoApplicantInput,
            tenantId: string,
        ) {
            // Check application exists and is active-ish
            const application = await prisma.application.findUnique({
                where: { id: applicationId },
            });
            if (!application) {
                throw new AppError('Application not found', 404);
            }

            // Check for duplicate invite
            const existing = await prisma.coApplicant.findUnique({
                where: { applicationId_email: { applicationId, email: data.email } },
            });
            if (existing) {
                throw new AppError(
                    'A co-applicant with this email already exists on this application',
                    409,
                );
            }

            // Check buyer doesn't invite themselves
            const buyer = await prisma.user.findUnique({
                where: { id: application.buyerId },
                select: { email: true },
            });
            if (buyer?.email === data.email) {
                throw new AppError('The primary applicant cannot be added as a co-applicant', 400);
            }

            // Find user account if they already exist
            const invitedUser = await prisma.user.findFirst({
                where: { email: data.email },
                select: { id: true },
            });

            return prisma.coApplicant.create({
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
                },
                include: {
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
                throw new AppError('Co-applicant not found', 404);
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
         * Co-applicant accepts their invitation (self-service).
         * Called when the invited user logs in and accepts.
         */
        async accept(applicationId: string, coApplicantId: string, userId: string) {
            const coApplicant = await prisma.coApplicant.findFirst({
                where: { id: coApplicantId, applicationId },
            });
            if (!coApplicant) {
                throw new AppError('Co-applicant not found', 404);
            }
            if (coApplicant.status !== 'INVITED') {
                throw new AppError(
                    `Cannot accept an invitation with status: ${coApplicant.status}`,
                    400,
                );
            }

            return prisma.coApplicant.update({
                where: { id: coApplicantId },
                data: {
                    status: 'ACTIVE',
                    userId,
                    acceptedAt: new Date(),
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
                throw new AppError('Co-applicant not found', 404);
            }
            if (coApplicant.status !== 'INVITED') {
                throw new AppError(
                    `Cannot decline an invitation with status: ${coApplicant.status}`,
                    400,
                );
            }

            return prisma.coApplicant.update({
                where: { id: coApplicantId },
                data: { status: 'DECLINED' },
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
                throw new AppError('Co-applicant not found', 404);
            }
            if (coApplicant.status === 'REMOVED') {
                throw new AppError('Co-applicant has already been removed', 400);
            }

            return prisma.coApplicant.update({
                where: { id: coApplicantId },
                data: {
                    status: 'REMOVED',
                    removedAt: new Date(),
                    removedById,
                    removalReason: data.reason,
                },
            });
        },
    };
}

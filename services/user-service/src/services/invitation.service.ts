import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import {
    NotFoundError,
    ConflictError,
    ValidationError,
    ForbiddenError,
    getEventPublisher,
    NotificationType,
    OrganizationInvitationPayload,
    OrganizationInvitationAcceptedPayload,
} from '@valentine-efagene/qshelter-common';
import { authService } from './auth.service';

// Initialize event publisher for notifications
const eventPublisher = getEventPublisher('user-service', {
    topicArn: process.env.NOTIFICATIONS_TOPIC_ARN,
});

// =============================================================================
// TYPES
// =============================================================================

export interface CreateInvitationInput {
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
    /** Role to assign to the invited user. Required. */
    roleId: string;
    title?: string;
    department?: string;
    /** Days until invitation expires (default: 7) */
    expiresInDays?: number;
}

export interface ListInvitationsParams {
    page?: number;
    limit?: number;
    status?: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
}

// =============================================================================
// INVITATION SERVICE
// =============================================================================

class InvitationService {
    /**
     * Create and send an invitation to join an organization.
     */
    async createInvitation(
        tenantId: string,
        invitedById: string,
        data: CreateInvitationInput
    ) {
        // Validate organization exists and belongs to tenant
        const organization = await prisma.organization.findFirst({
            where: { id: data.organizationId, tenantId },
            include: {
                types: {
                    include: { orgType: { select: { code: true } } },
                },
            },
        });

        if (!organization) {
            throw new NotFoundError('Organization not found');
        }

        // Check if user already exists with this email
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            // Check if they're already a member of this organization
            const existingMember = await prisma.organizationMember.findFirst({
                where: {
                    organizationId: data.organizationId,
                    userId: existingUser.id,
                },
            });

            if (existingMember) {
                throw new ConflictError('This user is already a member of the organization');
            }
        }

        // Check for existing pending invitation
        const existingInvitation = await prisma.organizationInvitation.findFirst({
            where: {
                tenantId,
                organizationId: data.organizationId,
                email: data.email,
                status: 'PENDING',
            },
        });

        if (existingInvitation) {
            throw new ConflictError('A pending invitation already exists for this email');
        }

        // Validate role exists
        const role = await prisma.role.findFirst({
            where: { id: data.roleId, tenantId },
        });

        if (!role) {
            throw new NotFoundError('Role not found');
        }

        // Get inviter details
        const inviter = await prisma.user.findUnique({
            where: { id: invitedById },
            select: { id: true, firstName: true, lastName: true, email: true },
        });

        if (!inviter) {
            throw new NotFoundError('Inviter not found');
        }

        // Generate invitation token
        const token = randomBytes(32).toString('hex');
        const expiresInDays = data.expiresInDays ?? 7;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        // Create invitation
        const invitation = await prisma.organizationInvitation.create({
            data: {
                tenantId,
                organizationId: data.organizationId,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                roleId: data.roleId,
                title: data.title,
                department: data.department,
                token,
                expiresAt,
                status: 'PENDING',
                invitedById: invitedById,
            },
            include: {
                organization: { select: { id: true, name: true } },
                role: { select: { id: true, name: true } },
                invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });

        // Send invitation email
        const acceptLink = `${process.env.FRONTEND_BASE_URL}/invitations/accept?token=${token}`;
        const inviterName = `${inviter.firstName} ${inviter.lastName}`.trim() || 'A team member';

        try {
            await eventPublisher.publishEmail<OrganizationInvitationPayload>(
                NotificationType.ORGANIZATION_INVITATION,
                {
                    to_email: data.email,
                    subject: `You've been invited to join ${organization.name}`,
                    inviteeName: data.firstName,
                    organizationName: organization.name,
                    inviterName,
                    roleName: role.name,
                    title: data.title,
                    acceptLink,
                    expiresAt: expiresAt.toISOString(),
                },
                { userId: invitedById, tenantId }
            );
        } catch (error) {
            console.error('Failed to send invitation email:', error);
            // Don't fail the invitation creation, just log the error
        }

        return invitation;
    }

    /**
     * Accept an invitation using the token.
     * Creates a user account if one doesn't exist, and adds them to the organization.
     */
    async acceptInvitation(
        token: string,
        password: string,
        additionalData?: { phone?: string }
    ) {
        // Find invitation by token
        const invitation = await prisma.organizationInvitation.findFirst({
            where: { token, status: 'PENDING' },
            include: {
                organization: { select: { id: true, name: true } },
                role: { select: { id: true, name: true } },
                invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
                tenant: { select: { id: true, name: true } },
            },
        });

        if (!invitation) {
            throw new NotFoundError('Invitation not found or has already been processed');
        }

        // Check if invitation has expired
        if (new Date() > invitation.expiresAt) {
            await prisma.organizationInvitation.update({
                where: { id: invitation.id },
                data: { status: 'EXPIRED' },
            });
            throw new ValidationError('This invitation has expired');
        }

        // Import bcrypt here to avoid circular dependencies
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Use a transaction to create user, add to org, and update invitation
        const result = await prisma.$transaction(async (tx) => {
            // Check if user already exists
            let user = await tx.user.findUnique({
                where: { email: invitation.email },
            });

            if (user) {
                // User exists - just add them to the organization
                // Check if they're already a member
                const existingMember = await tx.organizationMember.findFirst({
                    where: {
                        organizationId: invitation.organizationId,
                        userId: user.id,
                    },
                });

                if (existingMember) {
                    throw new ConflictError('You are already a member of this organization');
                }
            } else {
                // Create new user
                user = await tx.user.create({
                    data: {
                        email: invitation.email,
                        password: hashedPassword,
                        firstName: invitation.firstName ?? '',
                        lastName: invitation.lastName ?? '',
                        phone: additionalData?.phone,
                        emailVerifiedAt: new Date(), // Auto-verify since they clicked the invite link
                    },
                });

                // Create tenant membership with the assigned role
                if (!invitation.roleId) {
                    throw new ValidationError('Invitation is missing role assignment');
                }
                await tx.tenantMembership.create({
                    data: {
                        userId: user.id,
                        tenantId: invitation.tenantId,
                        roleId: invitation.roleId,
                        isDefault: true,
                        isActive: true,
                    },
                });
            }

            // Add user to organization
            const member = await tx.organizationMember.create({
                data: {
                    organizationId: invitation.organizationId,
                    userId: user.id,
                    title: invitation.title,
                    department: invitation.department,
                    isActive: true,
                    invitedAt: invitation.createdAt,
                    acceptedAt: new Date(),
                    invitedBy: invitation.invitedById,
                    joinedAt: new Date(),
                },
            });

            // Update invitation status
            await tx.organizationInvitation.update({
                where: { id: invitation.id },
                data: {
                    status: 'ACCEPTED',
                    acceptedAt: new Date(),
                },
            });

            return { user, member };
        });

        // Notify inviter that invitation was accepted
        if (invitation.invitedBy?.email) {
            try {
                await eventPublisher.publishEmail<OrganizationInvitationAcceptedPayload>(
                    NotificationType.ORGANIZATION_INVITATION_ACCEPTED,
                    {
                        to_email: invitation.invitedBy.email,
                        inviterName: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`.trim(),
                        inviteeName: `${invitation.firstName} ${invitation.lastName}`.trim(),
                        organizationName: invitation.organization.name,
                    },
                    { userId: invitation.invitedById!, tenantId: invitation.tenantId }
                );
            } catch (error) {
                console.error('Failed to send invitation accepted notification:', error);
            }
        }

        // Generate auth tokens so user is automatically logged in
        const tokens = await authService.generateTokensForUser(
            result.user.id,
            result.user.email,
            invitation.role?.name ? [invitation.role.name] : ['user'],
            invitation.tenantId
        );

        return {
            user: result.user,
            member: result.member,
            organization: invitation.organization,
            ...tokens,
        };
    }

    /**
     * Get invitation details by token (for the accept invitation page).
     */
    async getInvitationByToken(token: string) {
        const invitation = await prisma.organizationInvitation.findFirst({
            where: { token },
            include: {
                organization: { select: { id: true, name: true } },
                role: { select: { id: true, name: true } },
                invitedBy: { select: { id: true, firstName: true, lastName: true } },
                tenant: { select: { id: true, name: true } },
            },
        });

        if (!invitation) {
            throw new NotFoundError('Invitation not found');
        }

        // Check if expired but not yet marked
        if (invitation.status === 'PENDING' && new Date() > invitation.expiresAt) {
            await prisma.organizationInvitation.update({
                where: { id: invitation.id },
                data: { status: 'EXPIRED' },
            });
            invitation.status = 'EXPIRED';
        }

        // Return limited info for security (don't expose internal IDs)
        return {
            email: invitation.email,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            organizationName: invitation.organization.name,
            roleName: invitation.role?.name ?? 'User',
            title: invitation.title,
            department: invitation.department,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            invitedByName: invitation.invitedBy
                ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`.trim()
                : null,
            tenantName: invitation.tenant.name,
        };
    }

    /**
     * Cancel a pending invitation.
     */
    async cancelInvitation(tenantId: string, invitationId: string, cancelledById: string) {
        const invitation = await prisma.organizationInvitation.findFirst({
            where: { id: invitationId, tenantId },
        });

        if (!invitation) {
            throw new NotFoundError('Invitation not found');
        }

        if (invitation.status !== 'PENDING') {
            throw new ValidationError(`Cannot cancel an invitation with status: ${invitation.status}`);
        }

        return prisma.organizationInvitation.update({
            where: { id: invitationId },
            data: { status: 'CANCELLED' },
        });
    }

    /**
     * Resend an invitation email.
     */
    async resendInvitation(tenantId: string, invitationId: string, resenderId: string) {
        const invitation = await prisma.organizationInvitation.findFirst({
            where: { id: invitationId, tenantId },
            include: {
                organization: { select: { id: true, name: true } },
                role: { select: { id: true, name: true } },
                invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });

        if (!invitation) {
            throw new NotFoundError('Invitation not found');
        }

        if (invitation.status !== 'PENDING') {
            throw new ValidationError(`Cannot resend an invitation with status: ${invitation.status}`);
        }

        // Check if expired
        if (new Date() > invitation.expiresAt) {
            // Generate new token and extend expiry
            const newToken = randomBytes(32).toString('hex');
            const newExpiresAt = new Date();
            newExpiresAt.setDate(newExpiresAt.getDate() + 7);

            await prisma.organizationInvitation.update({
                where: { id: invitationId },
                data: {
                    token: newToken,
                    expiresAt: newExpiresAt,
                },
            });

            invitation.token = newToken;
            invitation.expiresAt = newExpiresAt;
        }

        // Get resender details
        const resender = await prisma.user.findUnique({
            where: { id: resenderId },
            select: { firstName: true, lastName: true },
        });

        const inviterName = resender
            ? `${resender.firstName} ${resender.lastName}`.trim()
            : 'A team member';

        // Send invitation email
        const acceptLink = `${process.env.FRONTEND_BASE_URL}/invitations/accept?token=${invitation.token}`;

        try {
            await eventPublisher.publishEmail<OrganizationInvitationPayload>(
                NotificationType.ORGANIZATION_INVITATION,
                {
                    to_email: invitation.email,
                    subject: `Reminder: You've been invited to join ${invitation.organization.name}`,
                    inviteeName: invitation.firstName ?? 'User',
                    organizationName: invitation.organization.name,
                    inviterName,
                    roleName: invitation.role?.name ?? 'User',
                    title: invitation.title ?? undefined,
                    acceptLink,
                    expiresAt: invitation.expiresAt.toISOString(),
                },
                { userId: resenderId, tenantId }
            );
        } catch (error) {
            console.error('Failed to resend invitation email:', error);
            throw new ValidationError('Failed to send invitation email');
        }

        return invitation;
    }

    /**
     * List invitations for an organization.
     */
    async listInvitations(
        tenantId: string,
        organizationId: string,
        params: ListInvitationsParams = {}
    ) {
        const { page = 1, limit = 20, status } = params;

        const where: any = { tenantId, organizationId };
        if (status) {
            where.status = status;
        }

        const [items, total] = await Promise.all([
            prisma.organizationInvitation.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    role: { select: { id: true, name: true } },
                    invitedBy: { select: { id: true, firstName: true, lastName: true } },
                },
            }),
            prisma.organizationInvitation.count({ where }),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Auto-detect role based on organization type.
     */
    private async detectRoleForOrganization(
        tenantId: string,
        organization: { types: { orgType: { code: string } }[] }
    ): Promise<string> {
        // Get primary type code
        const typeCodes = organization.types.map((t) => t.orgType.code);

        // Role mapping based on organization type
        let roleName = 'user';
        if (typeCodes.includes('BANK')) {
            roleName = 'lender_ops';
        } else if (typeCodes.includes('DEVELOPER')) {
            roleName = 'agent';
        } else if (typeCodes.includes('PLATFORM')) {
            roleName = 'mortgage_ops';
        } else if (typeCodes.includes('LEGAL')) {
            roleName = 'legal';
        }

        const role = await prisma.role.findFirst({
            where: { tenantId, name: roleName },
        });

        if (!role) {
            // Fallback to user role
            const userRole = await prisma.role.findFirst({
                where: { tenantId, name: 'user' },
            });
            if (!userRole) {
                throw new ValidationError('No suitable role found for the organization');
            }
            return userRole.id;
        }

        return role.id;
    }
}

export const invitationService = new InvitationService();

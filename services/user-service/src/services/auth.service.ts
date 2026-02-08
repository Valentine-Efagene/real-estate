import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import {
    UnauthorizedError,
    ConflictError,
    ValidationError,
    getEventPublisher,
    NotificationType,
    VerifyEmailPayload,
    PasswordResetPayload,
    AccountVerifiedPayload,
    ConfigService,
} from '@valentine-efagene/qshelter-common';
import { LoginInput, SignupInput, AuthResponse } from '../validators/auth.validator';

// Google OAuth client (credentials loaded from SSM via serverless.yml environment)
const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
);

// Initialize event publisher for user-service
const eventPublisher = getEventPublisher('user-service', {
    topicArn: process.env.NOTIFICATIONS_TOPIC_ARN,
});

interface JWTPayload {
    userId: string;
    email: string;
    roles?: string[];
    jti?: string;
}

class AuthService {
    async signup(data: SignupInput): Promise<AuthResponse> {
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            throw new ConflictError('Email already registered');
        }

        // Validate tenant exists
        const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId } });
        if (!tenant) {
            throw new ValidationError('Invalid tenant ID');
        }

        // Get the default user role for the tenant
        const userRole = await prisma.role.findFirst({
            where: { tenantId: data.tenantId, name: 'user' },
        });
        if (!userRole) {
            throw new ValidationError('Tenant is not properly configured (missing user role)');
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);
        const emailVerificationToken = randomBytes(32).toString('hex');

        // Create user with tenant membership in a transaction
        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email: data.email,
                    password: hashedPassword,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    avatar: data.avatar,
                    emailVerificationToken,
                    emailVerifiedAt: null,
                },
            });

            // Create tenant membership with user role
            await tx.tenantMembership.create({
                data: {
                    userId: newUser.id,
                    tenantId: data.tenantId,
                    roleId: userRole.id,
                    isDefault: true,
                    isActive: true,
                },
            });

            return newUser;
        });

        // Publish verify email event to SNS
        const verificationLink = `${process.env.FRONTEND_BASE_URL}/auth/verify-email?token=${emailVerificationToken}`;
        try {
            await eventPublisher.publishEmail<VerifyEmailPayload>(
                NotificationType.VERIFY_EMAIL,
                {
                    to_email: user.email,
                    homeBuyerName: `${user.firstName} ${user.lastName}`.trim() || 'User',
                    verificationLink,
                },
                { userId: user.id }
            );
            console.log(`[AuthService] Verification email event published for ${user.email}`);
        } catch (error) {
            // Log but don't fail signup if email event fails
            console.error(`[AuthService] Failed to publish verification email event:`, error);
        }

        return this.generateTokens(user.id, user.email, [userRole.name], data.tenantId);
    }

    async login(data: LoginInput): Promise<AuthResponse> {
        const user = await prisma.user.findUnique({
            where: { email: data.email },
            include: {
                userRoles: {
                    include: {
                        role: true,
                    },
                },
                // Include tenant memberships for federated authentication
                tenantMemberships: {
                    where: { isActive: true },
                    include: {
                        role: true,
                    },
                    orderBy: [
                        { isDefault: 'desc' }, // Default tenant first
                        { createdAt: 'asc' },
                    ],
                },
            },
        });

        if (!user || !user.password) {
            throw new UnauthorizedError('Invalid credentials');
        }

        const isValid = await bcrypt.compare(data.password, user.password);
        if (!isValid) {
            throw new UnauthorizedError('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedError('Account is inactive');
        }

        if (!user.emailVerifiedAt) {
            throw new UnauthorizedError('Please verify your email before logging in');
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        // Get roles from tenant memberships (federated model)
        // Fall back to legacy userRoles if no memberships exist
        const defaultMembership = user.tenantMemberships?.[0];
        let roleNames: string[];
        let tenantId: string | null = null;

        if (defaultMembership) {
            // Federated: Use ALL roles from tenant memberships (not just first)
            roleNames = [...new Set(user.tenantMemberships!.map((m) => m.role.name))];
            tenantId = defaultMembership.tenantId;
        } else {
            // Legacy: Use user-level roles and tenantId
            roleNames = user.userRoles?.map((ur) => ur.role.name) || [];
            tenantId = user.tenantId;
        }

        return this.generateTokens(user.id, user.email, roleNames, tenantId);
    }

    async verifyEmail(token: string) {
        const user = await prisma.user.findFirst({
            where: { emailVerificationToken: token },
        });

        if (!user) {
            throw new ValidationError('Invalid or expired verification token');
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerifiedAt: new Date(),
                emailVerificationToken: null,
                isActive: true,
            },
        });

        // Publish account verified email event
        try {
            await eventPublisher.publishEmail<AccountVerifiedPayload>(
                NotificationType.ACCOUNT_VERIFIED,
                {
                    to_email: user.email,
                    homeBuyerName: `${user.firstName} ${user.lastName}`.trim() || 'User',
                    loginLink: `${process.env.FRONTEND_BASE_URL}/auth/login`,
                },
                { userId: user.id }
            );
            console.log(`[AuthService] Account verified email event published for ${user.email}`);
        } catch (error) {
            console.error(`[AuthService] Failed to publish account verified email event:`, error);
        }

        return { message: 'Email verified successfully' };
    }

    async resendVerificationEmail(email: string): Promise<{ message: string }> {
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                tenantMemberships: {
                    where: { isActive: true },
                    take: 1,
                },
            },
        });

        if (!user) {
            // Don't reveal if user exists
            return { message: 'If an account exists with this email, a verification email has been sent' };
        }

        if (user.emailVerifiedAt) {
            return { message: 'Email is already verified' };
        }

        // Generate new verification token
        const emailVerificationToken = randomBytes(32).toString('hex');

        await prisma.user.update({
            where: { id: user.id },
            data: { emailVerificationToken },
        });

        // Publish verify email event
        const verificationLink = `${process.env.FRONTEND_BASE_URL}/auth/verify-email?token=${emailVerificationToken}`;
        try {
            await eventPublisher.publishEmail<VerifyEmailPayload>(
                NotificationType.VERIFY_EMAIL,
                {
                    to_email: user.email,
                    homeBuyerName: `${user.firstName} ${user.lastName}`.trim() || 'User',
                    verificationLink,
                },
                { userId: user.id }
            );
            console.log(`[AuthService] Resend verification email event published for ${user.email}`);
        } catch (error) {
            console.error(`[AuthService] Failed to publish resend verification email event:`, error);
        }

        return { message: 'If an account exists with this email, a verification email has been sent' };
    }

    async requestPasswordReset(email: string) {
        const user = await prisma.user.findUnique({ where: { email } });

        // Don't reveal if email exists (prevent enumeration)
        if (!user) {
            return { message: 'If the email exists, a password reset link has been sent' };
        }

        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        const existingToken = await prisma.passwordReset.findFirst({
            where: { userId: user.id, usedAt: null },
        });

        if (existingToken) {
            await prisma.passwordReset.update({
                where: { id: existingToken.id },
                data: { token, expiresAt },
            });
        } else {
            await prisma.passwordReset.create({
                data: {
                    userId: user.id,
                    token,
                    expiresAt,
                },
            });
        }

        const resetUrl = `${process.env.FRONTEND_BASE_URL}/auth/reset-password?token=${token}`;

        // Publish password reset email event
        try {
            await eventPublisher.publishEmail<PasswordResetPayload>(
                NotificationType.PASSWORD_RESET,
                {
                    to_email: user.email,
                    homeBuyerName: `${user.firstName} ${user.lastName}`.trim() || 'User',
                    otp: token,
                    ttl: 30, // 30 minutes
                },
                { userId: user.id }
            );
            console.log(`[AuthService] Password reset email event published for ${user.email}`);
        } catch (error) {
            console.error(`[AuthService] Failed to publish password reset email event:`, error);
        }

        return { message: 'If the email exists, a password reset link has been sent' };
    }

    async resetPassword(token: string, newPassword: string) {
        const resetToken = await prisma.passwordReset.findFirst({
            where: {
                token,
                expiresAt: { gt: new Date() },
                usedAt: null,
            },
            include: { user: true },
        });

        if (!resetToken) {
            throw new ValidationError('Invalid or expired password reset token');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.userId },
                data: { password: hashedPassword },
            }),
            prisma.passwordReset.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() },
            }),
        ]);

        return { message: 'Password reset successfully' };
    }

    async refreshToken(token: string): Promise<AuthResponse> {
        // Get JWT refresh secret from ConfigService (Secrets Manager)
        const configService = ConfigService.getInstance();
        const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';
        const refreshSecretResult = await configService.getJwtRefreshSecret(stage);
        const secret = refreshSecretResult.secret;

        try {
            const payload = jwt.verify(token, secret) as JWTPayload;

            if (!payload.jti) {
                throw new UnauthorizedError('Invalid or expired token');
            }

            // Verify token exists in database and hasn't been revoked
            const storedToken = await prisma.refreshToken.findUnique({
                where: { jti: payload.jti },
                include: {
                    user: {
                        include: {
                            userRoles: {
                                include: {
                                    role: true,
                                },
                            },
                            // Include tenant memberships for federated authentication
                            tenantMemberships: {
                                where: { isActive: true },
                                include: {
                                    role: true,
                                },
                                orderBy: [
                                    { isDefault: 'desc' }, // Default tenant first
                                    { createdAt: 'asc' },
                                ],
                            },
                        },
                    },
                },
            });

            if (!storedToken || storedToken.expiresAt < new Date()) {
                throw new UnauthorizedError('Invalid or expired token');
            }

            const user = storedToken.user;

            if (!user || !user.isActive) {
                throw new UnauthorizedError('Invalid token');
            }

            // Delete old refresh token
            await prisma.refreshToken.delete({
                where: { jti: payload.jti },
            });

            // Get roles from tenant memberships (federated model)
            // Fall back to legacy userRoles if no memberships exist
            const defaultMembership = user.tenantMemberships?.[0];
            let roleNames: string[];
            let tenantId: string | null = null;

            if (defaultMembership) {
                // Federated: Use ALL roles from tenant memberships (not just first)
                roleNames = [...new Set(user.tenantMemberships!.map((m) => m.role.name))];
                tenantId = defaultMembership.tenantId;
            } else {
                // Legacy: Use user-level roles and tenantId
                roleNames = user.userRoles?.map((ur) => ur.role.name) || [];
                tenantId = user.tenantId;
            }

            return this.generateTokens(user.id, user.email, roleNames, tenantId);
        } catch (error) {
            throw new UnauthorizedError('Invalid or expired token');
        }
    }

    async googleTokenLogin(idToken: string): Promise<AuthResponse> {
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload?.email) {
                throw new ValidationError('Invalid Google token');
            }

            const { email, given_name, family_name, picture } = payload;

            let user = await prisma.user.findUnique({
                where: { email },
                include: {
                    userRoles: {
                        include: {
                            role: true,
                        },
                    },
                },
            });

            if (user) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastLoginAt: new Date() },
                });

                const roleNames = user.userRoles?.map((ur) => ur.role.name) || [];
                return this.generateTokens(user.id, user.email, roleNames, user.tenantId);
            }

            // Create new user
            const randomPassword = randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = await prisma.user.create({
                data: {
                    email,
                    firstName: given_name || '',
                    lastName: family_name || '',
                    password: hashedPassword,
                    googleId: payload.sub,
                    avatar: picture,
                    emailVerifiedAt: new Date(), // Google accounts are pre-verified
                    isActive: true,
                },
                include: {
                    userRoles: {
                        include: {
                            role: true,
                        },
                    },
                },
            });

            const roleNames = user.userRoles?.map((ur) => ur.role.name) || [];
            return this.generateTokens(user.id, user.email, roleNames, user.tenantId);
        } catch (error) {
            throw new UnauthorizedError('Invalid Google token');
        }
    }

    async generateGoogleAuthUrl(): Promise<string> {
        const state = randomBytes(32).toString('hex');

        // Store state with expiry for CSRF protection
        await prisma.oAuthState.create({
            data: {
                state,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            },
        });

        const authUrl = googleClient.generateAuthUrl({
            access_type: 'offline',
            scope: ['profile', 'email'],
            state,
        });

        return authUrl;
    }

    async handleGoogleCallback(code: string, state: string): Promise<AuthResponse> {
        // Verify state for CSRF protection
        const stateRecord = await prisma.oAuthState.findFirst({
            where: {
                state,
                expiresAt: { gt: new Date() },
            },
        });

        if (!stateRecord) {
            throw new ValidationError('Invalid or expired state parameter');
        }

        // Delete used state
        await prisma.oAuthState.delete({ where: { id: stateRecord.id } });

        try {
            // Exchange authorization code for tokens
            const { tokens } = await googleClient.getToken(code);
            googleClient.setCredentials(tokens);

            // Verify the ID token
            const ticket = await googleClient.verifyIdToken({
                idToken: tokens.id_token!,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload?.email) {
                throw new ValidationError('Invalid Google token');
            }

            const { email, given_name, family_name, picture, sub } = payload;

            let user = await prisma.user.findUnique({
                where: { email },
                include: {
                    userRoles: {
                        include: {
                            role: true,
                        },
                    },
                },
            });

            if (user) {
                // Update last login
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastLoginAt: new Date() },
                });

                const roleNames = user.userRoles?.map((ur) => ur.role.name) || [];
                return this.generateTokens(user.id, user.email, roleNames, user.tenantId);
            }

            // Create new user
            const randomPassword = randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = await prisma.user.create({
                data: {
                    email,
                    firstName: given_name || '',
                    lastName: family_name || '',
                    password: hashedPassword,
                    googleId: sub,
                    avatar: picture,
                    emailVerifiedAt: new Date(), // Google accounts are pre-verified
                    isActive: true,
                },
                include: {
                    userRoles: {
                        include: {
                            role: true,
                        },
                    },
                },
            });

            const roleNames = user.userRoles?.map((ur) => ur.role.name) || [];
            return this.generateTokens(user.id, user.email, roleNames, user.tenantId);
        } catch (error) {
            throw new UnauthorizedError('Failed to authenticate with Google');
        }
    }

    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
                isActive: true,
                emailVerifiedAt: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
                userRoles: {
                    include: {
                        role: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                            },
                        },
                    },
                },
                organizationMemberships: {
                    include: {
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                types: {
                                    include: {
                                        orgType: {
                                            select: {
                                                id: true,
                                                code: true,
                                                name: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new UnauthorizedError('User not found');
        }

        return user;
    }

    /**
     * Generate tokens for a user (public wrapper for invitation acceptance, etc.)
     * Use when you need to log in a user programmatically without password verification.
     */
    async generateTokensForUser(userId: string, email: string, roles: string[], tenantId?: string | null): Promise<AuthResponse> {
        return this.generateTokens(userId, email, roles, tenantId);
    }

    private async generateTokens(userId: string, email: string, roles: string[], tenantId?: string | null): Promise<AuthResponse> {
        // Get JWT secrets from ConfigService (Secrets Manager)
        const configService = ConfigService.getInstance();
        const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';

        const [accessSecretResult, refreshSecretResult] = await Promise.all([
            configService.getJwtAccessSecret(stage),
            configService.getJwtRefreshSecret(stage),
        ]);

        const accessSecret = accessSecretResult.secret;
        const refreshSecret = refreshSecretResult.secret;
        const accessExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
        const refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

        // Calculate exact expiration times to keep JWT and DB in sync
        const refreshExpiryMs = this.parseExpiryToMs(refreshExpiry);
        const accessExpiryMs = this.parseExpiryToMs(accessExpiry);
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        const refreshExpiresAt = new Date((now + Math.floor(refreshExpiryMs / 1000)) * 1000);

        // Add unique jti to ensure each token is unique
        const accessJti = randomUUID();
        const refreshJti = randomUUID();

        // Build payload with optional tenantId
        const payload: { sub: string; email: string; roles: string[]; jti: string; tenantId?: string } = {
            sub: userId,
            email,
            roles,
            jti: accessJti,
        };
        if (tenantId) {
            payload.tenantId = tenantId;
        }

        const refreshPayload = { ...payload, jti: refreshJti };

        const accessToken = jwt.sign(payload, accessSecret, { expiresIn: accessExpiry } as jwt.SignOptions);
        const refreshToken = jwt.sign(refreshPayload, refreshSecret, { expiresIn: refreshExpiry } as jwt.SignOptions);

        // Clean up old refresh tokens for this user
        await prisma.refreshToken.deleteMany({
            where: { userId, expiresAt: { lt: new Date() } },
        });

        // Store refresh token with jti and synchronized expiry
        await prisma.refreshToken.create({
            data: {
                jti: refreshJti,
                userId,
                expiresAt: refreshExpiresAt,
            },
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: Math.floor(accessExpiryMs / 1000), // Convert to seconds
        };
    }

    private parseExpiryToMs(expiry: string): number {
        const match = expiry.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error(`Invalid expiry format: ${expiry}`);
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: throw new Error(`Unknown time unit: ${unit}`);
        }
    }
}

export const authService = new AuthService();

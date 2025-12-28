import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { UnauthorizedError, ConflictError, ValidationError } from '@valentine-efagene/qshelter-common';
import { LoginInput, SignupInput, AuthResponse } from '../validators/auth.validator';

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
);

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

        const hashedPassword = await bcrypt.hash(data.password, 10);
        const emailVerificationToken = randomBytes(32).toString('hex');

        const user = await prisma.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                firstName: data.firstName,
                lastName: data.lastName,
                avatar: data.avatar,
                emailVerificationToken,
            },
        });

        // TODO: Publish event to send verification email
        console.log(`Verification token for ${user.email}: ${emailVerificationToken}`);
        console.log(`Verification link: ${process.env.FRONTEND_BASE_URL}/auth/verify-email?token=${emailVerificationToken}`);

        return this.generateTokens(user.id, user.email, []);
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

        const roleNames = user.userRoles?.map((ur) => ur.role.name) || [];
        return this.generateTokens(user.id, user.email, roleNames);
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

        return { message: 'Email verified successfully' };
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

        // TODO: Publish event to send password reset email
        console.log(`Password reset link for ${user.email}: ${resetUrl}`);

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
        const secret = process.env.JWT_REFRESH_SECRET!;

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

            const roleNames = user.userRoles?.map((ur) => ur.role.name) || [];
            return this.generateTokens(user.id, user.email, roleNames);
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
                return this.generateTokens(user.id, user.email, roleNames);
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
            return this.generateTokens(user.id, user.email, roleNames);
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
                return this.generateTokens(user.id, user.email, roleNames);
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
            return this.generateTokens(user.id, user.email, roleNames);
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
            },
        });

        if (!user) {
            throw new UnauthorizedError('User not found');
        }

        return user;
    }

    private async generateTokens(userId: string, email: string, roles: string[]): Promise<AuthResponse> {
        const accessSecret = process.env.JWT_ACCESS_SECRET!;
        const refreshSecret = process.env.JWT_REFRESH_SECRET!;
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

        const accessToken = jwt.sign({ userId, email, roles, jti: accessJti }, accessSecret, { expiresIn: accessExpiry } as jwt.SignOptions);
        const refreshToken = jwt.sign({ userId, email, roles, jti: refreshJti }, refreshSecret, { expiresIn: refreshExpiry } as jwt.SignOptions);

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

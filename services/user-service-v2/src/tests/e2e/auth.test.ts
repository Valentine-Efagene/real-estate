import request from 'supertest';
import { faker } from '@faker-js/faker';
import { app } from '../../app';
import { cleanDatabase, seedTestRoles } from './setup';
import { prisma } from '../../lib/prisma';

describe('Auth E2E Tests', () => {
    beforeAll(async () => {
        await cleanDatabase();
        await seedTestRoles();
    });

    beforeEach(async () => {
        await cleanDatabase();
        await seedTestRoles();
    });

    afterAll(async () => {
        await cleanDatabase();
        await prisma.$disconnect();
    });

    describe('POST /api/auth/signup', () => {
        it('should successfully create a new user', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            const response = await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data).toHaveProperty('refreshToken');
            expect(response.body.data).toHaveProperty('expiresIn');
            expect(response.body.data.expiresIn).toBe(900);

            // Verify user was created in database
            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            expect(user).toBeTruthy();
            expect(user?.email).toBe(userData.email);
            expect(user?.firstName).toBe(userData.firstName);
            expect(user?.lastName).toBe(userData.lastName);
            expect(user?.password).toBeDefined();
            expect(user?.password).not.toBe(userData.password); // Password should be hashed
            expect(user?.emailVerificationToken).toBeTruthy();
            expect(user?.emailVerifiedAt).toBeNull();
            expect(user?.isActive).toBe(false);
        });

        it('should fail with duplicate email', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create first user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            // Attempt to create duplicate user
            const response = await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Email already registered');
        });

        it('should fail with invalid email format', async () => {
            const userData = {
                email: 'invalid-email',
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            const response = await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should fail with short password', async () => {
            const userData = {
                email: faker.internet.email(),
                password: 'short',
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            const response = await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should fail with missing required fields', async () => {
            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: faker.internet.email(),
                    // Missing password, firstName, lastName
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/login', () => {
        const userData = {
            email: faker.internet.email(),
            password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
        };

        it('should fail to login before email verification', async () => {
            // Create user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            // Attempt to login without verifying email
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password,
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('verify your email');
        });

        it('should successfully login after email verification', async () => {
            // Create user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            // Get verification token from database
            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });
            const verificationToken = user?.emailVerificationToken;

            // Verify email
            await request(app)
                .get(`/api/auth/verify-email?token=${verificationToken}`)
                .expect(200);

            // Login
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data).toHaveProperty('refreshToken');
            expect(response.body.data).toHaveProperty('expiresIn');

            // Verify lastLoginAt was updated
            const updatedUser = await prisma.user.findUnique({
                where: { email: userData.email },
            });
            expect(updatedUser?.lastLoginAt).toBeTruthy();
        });

        it('should fail with incorrect password', async () => {
            // Create and verify user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            await request(app)
                .get(`/api/auth/verify-email?token=${user?.emailVerificationToken}`)
                .expect(200);

            // Attempt login with wrong password
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: 'WrongPassword123!',
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid credentials');
        });

        it('should fail with non-existent email', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: faker.internet.email(),
                    password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid credentials');
        });

        it('should fail for inactive account', async () => {
            // Create and verify user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            await request(app)
                .get(`/api/auth/verify-email?token=${user?.emailVerificationToken}`)
                .expect(200);

            // Deactivate user
            await prisma.user.update({
                where: { email: userData.email },
                data: { isActive: false },
            });

            // Attempt login
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password,
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Account is inactive');
        });
    });

    describe('GET /api/auth/verify-email', () => {
        it('should successfully verify email with valid token', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            // Get verification token
            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });
            const token = user?.emailVerificationToken;

            expect(token).toBeTruthy();

            // Verify email
            const response = await request(app)
                .get(`/api/auth/verify-email?token=${token}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('verified successfully');

            // Check user is verified and active
            const verifiedUser = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            expect(verifiedUser?.emailVerifiedAt).toBeTruthy();
            expect(verifiedUser?.emailVerificationToken).toBeNull();
            expect(verifiedUser?.isActive).toBe(true);
        });

        it('should fail with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/verify-email?token=invalid-token')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid or expired');
        });

        it('should fail when token is already used', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            // Get verification token
            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });
            const token = user?.emailVerificationToken;

            // Verify email first time
            await request(app)
                .get(`/api/auth/verify-email?token=${token}`)
                .expect(200);

            // Attempt to verify again with same token
            const response = await request(app)
                .get(`/api/auth/verify-email?token=${token}`)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/request-password-reset', () => {
        it('should create password reset token for existing user', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            // Request password reset
            const response = await request(app)
                .post('/api/auth/request-password-reset')
                .send({ email: userData.email })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('password reset link');

            // Verify token was created in database
            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            const resetToken = await prisma.passwordReset.findFirst({
                where: { userId: user?.id },
            });

            expect(resetToken).toBeTruthy();
            expect(resetToken?.token).toBeTruthy();
            expect(resetToken?.expiresAt).toBeTruthy();
            expect(resetToken?.usedAt).toBeNull();
        });

        it('should not reveal if email does not exist', async () => {
            const response = await request(app)
                .post('/api/auth/request-password-reset')
                .send({ email: faker.internet.email() })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('password reset link');
        });

        it('should update existing unused token', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            // Request password reset first time
            await request(app)
                .post('/api/auth/request-password-reset')
                .send({ email: userData.email })
                .expect(200);

            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            const firstToken = await prisma.passwordReset.findFirst({
                where: { userId: user?.id },
            });

            // Request password reset second time
            await request(app)
                .post('/api/auth/request-password-reset')
                .send({ email: userData.email })
                .expect(200);

            const secondToken = await prisma.passwordReset.findFirst({
                where: { userId: user?.id },
            });

            // Should update the same record, not create a new one
            expect(secondToken?.id).toBe(firstToken?.id);
            expect(secondToken?.token).not.toBe(firstToken?.token);
        });
    });

    describe('POST /api/auth/reset-password', () => {
        it('should successfully reset password with valid token', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create and verify user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            await request(app)
                .get(`/api/auth/verify-email?token=${user?.emailVerificationToken}`)
                .expect(200);

            // Request password reset
            await request(app)
                .post('/api/auth/request-password-reset')
                .send({ email: userData.email })
                .expect(200);

            // Get reset token
            const resetToken = await prisma.passwordReset.findFirst({
                where: { userId: user?.id },
            });

            const newPassword = faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ });

            // Reset password
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: resetToken?.token,
                    newPassword,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('reset successfully');

            // Verify token is marked as used
            const usedToken = await prisma.passwordReset.findFirst({
                where: { id: resetToken?.id },
            });
            expect(usedToken?.usedAt).toBeTruthy();

            // Verify can login with new password
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: newPassword,
                })
                .expect(200);

            expect(loginResponse.body.success).toBe(true);

            // Verify cannot login with old password
            await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password,
                })
                .expect(401);
        });

        it('should fail with invalid token', async () => {
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: 'invalid-token',
                    newPassword: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid or expired');
        });

        it('should fail with expired token', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            // Create expired reset token
            const expiredToken = await prisma.passwordReset.create({
                data: {
                    userId: user!.id,
                    token: 'expired-token',
                    expiresAt: new Date(Date.now() - 1000), // Already expired
                },
            });

            // Attempt to reset password
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: expiredToken.token,
                    newPassword: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid or expired');
        });

        it('should fail with already used token', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create and verify user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            await request(app)
                .get(`/api/auth/verify-email?token=${user?.emailVerificationToken}`)
                .expect(200);

            // Request password reset
            await request(app)
                .post('/api/auth/request-password-reset')
                .send({ email: userData.email })
                .expect(200);

            const resetToken = await prisma.passwordReset.findFirst({
                where: { userId: user?.id },
            });

            // Reset password first time
            await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: resetToken?.token,
                    newPassword: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                })
                .expect(200);

            // Attempt to use same token again
            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: resetToken?.token,
                    newPassword: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid or expired');
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should successfully refresh tokens with valid refresh token', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create and verify user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            await request(app)
                .get(`/api/auth/verify-email?token=${user?.emailVerificationToken}`)
                .expect(200);

            // Login to get tokens
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password,
                })
                .expect(200);

            const { refreshToken } = loginResponse.body.data;

            // Refresh tokens
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data).toHaveProperty('refreshToken');
            expect(response.body.data.accessToken).not.toBe(loginResponse.body.data.accessToken);
            expect(response.body.data.refreshToken).not.toBe(refreshToken);
        });

        it('should fail with invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'invalid-token' })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid or expired');
        });

        it('should fail for inactive user', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // Create and verify user
            await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            await request(app)
                .get(`/api/auth/verify-email?token=${user?.emailVerificationToken}`)
                .expect(200);

            // Login to get tokens
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password,
                })
                .expect(200);

            const { refreshToken } = loginResponse.body.data;

            // Deactivate user
            await prisma.user.update({
                where: { email: userData.email },
                data: { isActive: false },
            });

            // Attempt to refresh tokens
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid token');
        });
    });

    describe('Complete User Journey', () => {
        it('should complete full signup, verify, login, reset password, and refresh flow', async () => {
            const userData = {
                email: faker.internet.email(),
                password: faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ }),
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
            };

            // 1. Signup
            const signupResponse = await request(app)
                .post('/api/auth/signup')
                .send(userData)
                .expect(201);

            expect(signupResponse.body.success).toBe(true);
            expect(signupResponse.body.data).toHaveProperty('accessToken');

            // 2. Verify login fails before email verification
            await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password,
                })
                .expect(401);

            // 3. Verify email
            const user = await prisma.user.findUnique({
                where: { email: userData.email },
            });

            await request(app)
                .get(`/api/auth/verify-email?token=${user?.emailVerificationToken}`)
                .expect(200);

            // 4. Login successfully
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password,
                })
                .expect(200);

            const { accessToken, refreshToken } = loginResponse.body.data;
            expect(accessToken).toBeTruthy();
            expect(refreshToken).toBeTruthy();

            // 5. Request password reset
            await request(app)
                .post('/api/auth/request-password-reset')
                .send({ email: userData.email })
                .expect(200);

            // 6. Reset password
            const resetToken = await prisma.passwordReset.findFirst({
                where: { userId: user?.id },
            });

            const newPassword = faker.internet.password({ length: 16, memorable: true, pattern: /[A-Za-z0-9!@#$%]/ });
            await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: resetToken?.token,
                    newPassword,
                })
                .expect(200);

            // 7. Login with new password
            const newLoginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: userData.email,
                    password: newPassword,
                })
                .expect(200);

            expect(newLoginResponse.body.success).toBe(true);

            // 8. Refresh tokens
            const refreshResponse = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: newLoginResponse.body.data.refreshToken })
                .expect(200);

            expect(refreshResponse.body.success).toBe(true);
            expect(refreshResponse.body.data).toHaveProperty('accessToken');
            expect(refreshResponse.body.data).toHaveProperty('refreshToken');
        });
    });
});

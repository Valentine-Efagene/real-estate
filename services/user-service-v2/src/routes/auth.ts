import { Router } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { loginSchema, signupSchema, refreshTokenSchema } from '../validators/auth.validator.js';
import { authService } from '../services/auth.service.js';
import { z } from 'zod';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await authService.login(data);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

authRouter.post('/signup', async (req, res, next) => {
    try {
        const data = signupSchema.parse(req.body);
        const result = await authService.signup(data);
        res.status(201).json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

authRouter.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = refreshTokenSchema.parse(req.body);
        const result = await authService.refreshToken(refreshToken);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

authRouter.get('/verify-email', async (req, res, next) => {
    try {
        const token = z.string().parse(req.query.token);
        const result = await authService.verifyEmail(token);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

authRouter.post('/request-password-reset', async (req, res, next) => {
    try {
        const { email } = z.object({ email: z.string().email() }).parse(req.body);
        const result = await authService.requestPasswordReset(email);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

authRouter.post('/reset-password', async (req, res, next) => {
    try {
        const { token, newPassword } = z.object({
            token: z.string(),
            newPassword: z.string().min(8),
        }).parse(req.body);
        const result = await authService.resetPassword(token, newPassword);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

authRouter.post('/google-token-login', async (req, res, next) => {
    try {
        const { token } = z.object({ token: z.string() }).parse(req.body);
        const result = await authService.googleTokenLogin(token);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

authRouter.get('/google', async (req, res, next) => {
    try {
        const authUrl = await authService.generateGoogleAuthUrl();
        res.redirect(authUrl);
    } catch (error) {
        next(error);
    }
});

authRouter.get('/google/callback', async (req, res, next) => {
    try {
        const { code, state } = z.object({
            code: z.string(),
            state: z.string(),
        }).parse(req.query);

        const result = await authService.handleGoogleCallback(code, state);

        // Redirect to frontend with tokens
        const frontendUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;

        res.redirect(redirectUrl);
    } catch (error) {
        next(error);
    }
});

authRouter.get('/me', async (req, res, next) => {
    try {
        // TODO: Extract userId from auth context/JWT
        const userId = (req as any).userId; // Will be set by auth middleware
        const result = await authService.getProfile(userId);
        res.json(successResponse(result));
    } catch (error) {
        next(error);
    }
});

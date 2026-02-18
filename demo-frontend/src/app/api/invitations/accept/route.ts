import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { decodeJwt } from 'jose';
import type { JwtPayload } from '@/lib/auth/types';

const COOKIE_NAME = 'qshelter_access_token';
const REFRESH_COOKIE_NAME = 'qshelter_refresh_token';

/**
 * Get invitation details by token
 */
export async function GET(request: NextRequest) {
    try {
        const token = request.nextUrl.searchParams.get('token');

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Invitation token is required' },
                { status: 400 }
            );
        }

        // Call backend to get invitation details
        const response = await fetch(`${env.userServiceUrl}/invitations/accept?token=${token}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            return NextResponse.json(
                { success: false, message: data.error?.message || 'Failed to fetch invitation' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Fetch invitation error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * Accept invitation and create account
 * Sets auth cookies so the user is automatically logged in
 */
export async function POST(request: NextRequest) {
    try {
        const token = request.nextUrl.searchParams.get('token');
        const body = await request.json();
        const { password, phone } = body;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'Invitation token is required' },
                { status: 400 }
            );
        }

        if (!password) {
            return NextResponse.json(
                { success: false, message: 'Password is required' },
                { status: 400 }
            );
        }

        // Call backend to accept invitation
        const response = await fetch(`${env.userServiceUrl}/invitations/accept?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, phone }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            return NextResponse.json(
                { success: false, message: data.error?.message || 'Failed to accept invitation' },
                { status: response.status }
            );
        }

        const { accessToken, refreshToken, expiresIn, user, organization } = data.data;

        // Decode JWT to get user info with roles
        const payload = decodeJwt(accessToken) as unknown as JwtPayload;

        // Create response with user session
        const res = NextResponse.json({
            success: true,
            message: 'Invitation accepted successfully',
            user: {
                userId: payload.sub,
                email: payload.email,
                roles: payload.roles,
                tenantId: payload.tenantId,
                expiresAt: payload.exp * 1000,
                ...user,
            },
            organization,
        });

        // Set httpOnly cookies for auto-login
        res.cookies.set(COOKIE_NAME, accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: expiresIn, // ~15 minutes
        });

        res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return res;
    } catch (error) {
        console.error('Accept invitation error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

const COOKIE_NAME = 'qshelter_access_token';
const REFRESH_COOKIE_NAME = 'qshelter_refresh_token';

export async function POST(request: NextRequest) {
    try {
        const { code, state } = await request.json();

        if (!code || !state) {
            return NextResponse.json(
                { error: 'Missing code or state parameter' },
                { status: 400 }
            );
        }

        // Call the backend to handle the Google callback
        const response = await fetch(
            `${env.userServiceUrl}/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
        );

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.error?.message || 'Google authentication failed' },
                { status: response.status }
            );
        }

        const { accessToken, refreshToken, expiresIn } = data.data;

        // Create response
        const res = NextResponse.json({ success: true });

        // Set httpOnly cookies — same pattern as login route
        res.cookies.set(COOKIE_NAME, accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: expiresIn || 900, // 15 minutes
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
        console.error('Google callback error:', error);
        return NextResponse.json(
            { error: 'Failed to complete Google authentication' },
            { status: 500 }
        );
    }
}

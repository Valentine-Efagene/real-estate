import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

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

        // Set the session cookie with the tokens
        const cookieStore = await cookies();
        const sessionData = {
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
            expiresAt: Date.now() + (data.data.expiresIn || 900) * 1000,
        };

        cookieStore.set(env.cookieName, JSON.stringify(sessionData), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: env.cookieMaxAge,
            path: '/',
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Google callback error:', error);
        return NextResponse.json(
            { error: 'Failed to complete Google authentication' },
            { status: 500 }
        );
    }
}

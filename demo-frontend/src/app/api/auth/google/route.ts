import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function GET() {
    try {
        const response = await fetch(`${env.userServiceUrl}/auth/google`);
        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { error: data.error || 'Failed to get Google auth URL' },
                { status: response.status }
            );
        }

        return NextResponse.json({ authUrl: data.data });
    } catch (error) {
        console.error('Google auth error:', error);
        return NextResponse.json(
            { error: 'Failed to initiate Google authentication' },
            { status: 500 }
        );
    }
}

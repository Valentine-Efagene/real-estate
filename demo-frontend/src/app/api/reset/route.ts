import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
    try {
        const bootstrapSecret = request.headers.get('X-Bootstrap-Secret');

        if (!bootstrapSecret) {
            return NextResponse.json(
                { success: false, error: 'Bootstrap secret is required' },
                { status: 400 }
            );
        }

        const backendUrl = `${env.userServiceUrl}/admin/reset`;
        console.log('[Reset Proxy] Calling:', backendUrl);

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Bootstrap-Secret': bootstrapSecret,
            },
        });

        const text = await response.text();
        console.log('[Reset Proxy] Response status:', response.status);
        console.log('[Reset Proxy] Response body:', text.substring(0, 500));

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return NextResponse.json(
                { success: false, error: `Backend returned non-JSON: ${text.substring(0, 200)}` },
                { status: response.status || 500 }
            );
        }

        // Clear auth cookies on successful reset
        const res = NextResponse.json(data, { status: response.status });
        if (response.ok && data.success) {
            res.cookies.set('qshelter_access_token', '', { maxAge: 0, path: '/' });
            res.cookies.set('qshelter_refresh_token', '', { maxAge: 0, path: '/' });
        }

        return res;
    } catch (error) {
        console.error('Reset proxy error:', error);
        return NextResponse.json(
            { success: false, error: `Failed to connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}

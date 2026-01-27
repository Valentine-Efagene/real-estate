import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const bootstrapSecret = request.headers.get('X-Bootstrap-Secret');

        if (!bootstrapSecret) {
            return NextResponse.json(
                { success: false, error: 'Bootstrap secret is required' },
                { status: 400 }
            );
        }

        const backendUrl = `${env.userServiceUrl}/admin/bootstrap-tenant`;
        console.log('[Bootstrap Proxy] Calling:', backendUrl);

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Bootstrap-Secret': bootstrapSecret,
            },
            body: JSON.stringify(body),
        });

        const text = await response.text();
        console.log('[Bootstrap Proxy] Response status:', response.status);
        console.log('[Bootstrap Proxy] Response body:', text.substring(0, 500));

        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            // If not JSON, return the raw text as error
            return NextResponse.json(
                { success: false, error: `Backend returned non-JSON: ${text.substring(0, 200)}` },
                { status: response.status || 500 }
            );
        }

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Bootstrap proxy error:', error);
        return NextResponse.json(
            { success: false, error: `Failed to connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Demo Bootstrap — thin proxy to the user-service backend endpoint.
 *
 * The actual orchestration logic (tenant setup, org creation, property creation,
 * payment method creation) lives in the user-service at POST /admin/demo-bootstrap.
 *
 * This frontend route simply forwards the request, passing along the bootstrap
 * secret and the external service URLs that the backend needs.
 */

export async function POST(request: NextRequest) {
    const bootstrapSecret = request.headers.get('X-Bootstrap-Secret');
    if (!bootstrapSecret) {
        return NextResponse.json(
            { success: false, error: 'Bootstrap secret is required' },
            { status: 400 },
        );
    }

    try {
        const res = await fetch(`${env.userServiceUrl}/admin/demo-bootstrap`, {
            method: 'POST',
            headers: {
                'x-bootstrap-secret': bootstrapSecret,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                propertyServiceUrl: env.propertyServiceUrl,
                mortgageServiceUrl: env.mortgageServiceUrl,
                paymentServiceUrl: env.paymentServiceUrl,
            }),
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Demo Bootstrap] Proxy error:', message);
        return NextResponse.json(
            { success: false, error: `Failed to reach user-service: ${message}` },
            { status: 502 },
        );
    }
}

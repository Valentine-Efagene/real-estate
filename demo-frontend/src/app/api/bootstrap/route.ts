import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { pollAsyncJob, AsyncJobDispatchError } from '@/lib/async-job';

export const maxDuration = 300; // 5 min (Vercel limit; no-op locally)

export async function POST(request: NextRequest) {
    const bootstrapSecret = request.headers.get('X-Bootstrap-Secret');
    if (!bootstrapSecret) {
        return NextResponse.json(
            { success: false, error: 'Bootstrap secret is required' },
            { status: 400 },
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        body = {};
    }

    try {
        const pollResult = await pollAsyncJob({
            dispatchUrl: `${env.userServiceUrl}/admin/bootstrap-tenant`,
            dispatchInit: {
                method: 'POST',
                headers: {
                    'x-bootstrap-secret': bootstrapSecret,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            },
            pollUrlFromJobId: (jobId) =>
                `${env.userServiceUrl}/admin/bootstrap-tenant/${jobId}`,
            pollHeaders: { 'x-bootstrap-secret': bootstrapSecret },
        });

        if (pollResult.status === 'COMPLETED' && pollResult.result) {
            return NextResponse.json(pollResult.result);
        }

        if (pollResult.status === 'FAILED') {
            return NextResponse.json(
                { success: false, error: pollResult.error || 'Bootstrap job failed' },
                { status: 500 },
            );
        }

        // TIMEOUT
        return NextResponse.json(
            { success: false, error: pollResult.error },
            { status: 504 },
        );
    } catch (error) {
        if (error instanceof AsyncJobDispatchError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: error.statusCode },
            );
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Bootstrap Proxy] Error:', message);
        return NextResponse.json(
            { success: false, error: `Failed to reach user-service: ${message}` },
            { status: 502 },
        );
    }
}

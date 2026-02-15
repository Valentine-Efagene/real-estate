import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { pollAsyncJob, AsyncJobDispatchError } from '@/lib/async-job';

/**
 * Demo Bootstrap — orchestration proxy with async polling.
 *
 * The backend (user-service) dispatches the bootstrap job to a worker Lambda
 * asynchronously (returns 202 with a jobId). This proxy uses the shared
 * pollAsyncJob helper to poll until COMPLETED or FAILED, then transforms
 * the result for the frontend component.
 */

export const maxDuration = 300; // 5 min (Vercel limit; no-op locally)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformResult(result: any) {
    return {
        success: true,
        steps: result.steps ?? [],
        summary: {
            tenantId: result.tenantId,
            actors: Object.values(result.actors ?? {}).map((a: any) => ({
                name: a.name,
                email: a.email,
                role: a.role,
                id: a.id,
            })),
            organizations: Object.values(result.organizations ?? {}).map((o: any) => ({
                name: o.name,
                type: o.type,
                status: 'Active',
                id: o.id,
            })),
            property: {
                title: result.property?.title ?? '',
                id: result.property?.id ?? '',
                variant: result.property?.variantName ?? '',
                unit: result.property?.unitNumber ?? '',
            },
            paymentMethod: {
                name: result.paymentMethod?.name ?? '',
                id: result.paymentMethod?.id ?? '',
                phases: result.paymentMethod?.phases ?? 0,
            },
        },
    };
}

export async function POST(request: NextRequest) {
    const bootstrapSecret = request.headers.get('X-Bootstrap-Secret');
    if (!bootstrapSecret) {
        return NextResponse.json(
            { success: false, error: 'Bootstrap secret is required' },
            { status: 400 },
        );
    }

    try {
        const pollResult = await pollAsyncJob({
            dispatchUrl: `${env.userServiceUrl}/admin/demo-bootstrap`,
            dispatchInit: {
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
            },
            pollUrlFromJobId: (jobId) =>
                `${env.userServiceUrl}/admin/demo-bootstrap/${jobId}`,
            pollHeaders: { 'x-bootstrap-secret': bootstrapSecret },
        });

        if (pollResult.status === 'COMPLETED' && pollResult.result) {
            return NextResponse.json(transformResult(pollResult.result));
        }

        if (pollResult.status === 'FAILED') {
            return NextResponse.json(
                { success: false, error: pollResult.error || 'Bootstrap job failed on the server' },
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
        console.error('[Demo Bootstrap] Proxy error:', message);
        return NextResponse.json(
            { success: false, error: `Failed to reach user-service: ${message}` },
            { status: 502 },
        );
    }
}

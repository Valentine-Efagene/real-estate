import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Demo Bootstrap — orchestration proxy with async polling.
 *
 * The backend (user-service) dispatches the bootstrap job to a worker Lambda
 * asynchronously (returns 202 with a jobId). This proxy:
 *   1. Dispatches the job via POST /admin/demo-bootstrap
 *   2. Polls GET /admin/demo-bootstrap/:jobId until COMPLETED or FAILED
 *   3. Transforms the backend result to match the frontend component's interface
 *
 * This keeps the DemoBootstrapButton component simple (single await).
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
        // ── Step 1: Dispatch async bootstrap job ────────────────────────
        const dispatchRes = await fetch(`${env.userServiceUrl}/admin/demo-bootstrap`, {
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

        const dispatchData = await dispatchRes.json();

        if (dispatchRes.status !== 202 || !dispatchData.jobId) {
            return NextResponse.json(
                {
                    success: false,
                    error: dispatchData.message || dispatchData.error || 'Failed to dispatch bootstrap job',
                },
                { status: dispatchRes.status },
            );
        }

        const { jobId } = dispatchData;
        console.log(`[Demo Bootstrap] Job dispatched: ${jobId}`);

        // ── Step 2: Poll until COMPLETED / FAILED (max ~4.5 min) ────────
        const MAX_POLL_MS = 270_000;
        const POLL_INTERVAL_MS = 2_000;
        const start = Date.now();

        while (Date.now() - start < MAX_POLL_MS) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

            let pollData: any;
            try {
                const pollRes = await fetch(
                    `${env.userServiceUrl}/admin/demo-bootstrap/${jobId}`,
                    { headers: { 'x-bootstrap-secret': bootstrapSecret } },
                );
                if (!pollRes.ok) {
                    console.warn(`[Demo Bootstrap] Poll returned ${pollRes.status}`);
                    continue;
                }
                pollData = await pollRes.json();
            } catch (e) {
                console.warn('[Demo Bootstrap] Poll fetch error, retrying…', e);
                continue;
            }

            console.log(`[Demo Bootstrap] Job ${jobId} → ${pollData.status}`);

            if (pollData.status === 'COMPLETED' && pollData.result) {
                return NextResponse.json(transformResult(pollData.result));
            }

            if (pollData.status === 'FAILED') {
                return NextResponse.json(
                    {
                        success: false,
                        error: pollData.error || 'Bootstrap job failed on the server',
                        steps: pollData.result?.steps ?? [],
                    },
                    { status: 500 },
                );
            }
            // PENDING / RUNNING → keep polling
        }

        return NextResponse.json(
            { success: false, error: `Bootstrap job ${jobId} timed out after ${Math.round(MAX_POLL_MS / 1000)}s` },
            { status: 504 },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Demo Bootstrap] Proxy error:', message);
        return NextResponse.json(
            { success: false, error: `Failed to reach user-service: ${message}` },
            { status: 502 },
        );
    }
}

/**
 * Server-side async job polling helper.
 *
 * Dispatches a request to a backend that returns 202 + { jobId },
 * then polls a status URL until the job reaches a terminal state.
 *
 * Designed for Next.js API routes that proxy long-running backend jobs
 * (e.g. demo-bootstrap). The browser makes a single POST and blocks
 * until the server-side polling completes.
 *
 * Usage in a route handler:
 *
 *   const result = await pollAsyncJob({
 *       dispatchUrl: `${env.userServiceUrl}/admin/demo-bootstrap`,
 *       dispatchInit: { method: 'POST', headers: {...}, body: JSON.stringify({...}) },
 *       pollUrlFromJobId: (jobId) => `${env.userServiceUrl}/admin/demo-bootstrap/${jobId}`,
 *       pollHeaders: { 'x-bootstrap-secret': secret },
 *   });
 */

export interface PollAsyncJobOptions {
    /** Full URL to POST (or fetch) that returns 202 + { jobId }. */
    dispatchUrl: string;
    /** fetch() init for the dispatch request. */
    dispatchInit: RequestInit;
    /** Given a jobId, return the full URL to poll for status. */
    pollUrlFromJobId: (jobId: string) => string;
    /** Headers to send with each poll request (e.g. auth secret). */
    pollHeaders?: Record<string, string>;
    /** Max time to poll before giving up (ms). Default 270_000 (4.5 min). */
    maxPollMs?: number;
    /** Interval between polls (ms). Default 2_000. */
    pollIntervalMs?: number;
    /** Optional logger. Default: console. */
    logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}

export interface AsyncJobPollResult<T = unknown> {
    status: 'COMPLETED' | 'FAILED' | 'TIMEOUT';
    jobId: string;
    result?: T;
    error?: string;
}

export async function pollAsyncJob<T = unknown>(
    opts: PollAsyncJobOptions,
): Promise<AsyncJobPollResult<T>> {
    const {
        dispatchUrl,
        dispatchInit,
        pollUrlFromJobId,
        pollHeaders = {},
        maxPollMs = 270_000,
        pollIntervalMs = 2_000,
        logger = console,
    } = opts;

    // ── Step 1: Dispatch ────────────────────────────────────────────────
    const dispatchRes = await fetch(dispatchUrl, dispatchInit);
    const dispatchData = await dispatchRes.json();

    if (dispatchRes.status !== 202 || !dispatchData.jobId) {
        throw new AsyncJobDispatchError(
            dispatchData.message || dispatchData.error || 'Failed to dispatch async job',
            dispatchRes.status,
            dispatchData,
        );
    }

    const { jobId } = dispatchData as { jobId: string };
    logger.log(`[AsyncJob] Job dispatched: ${jobId}`);

    // ── Step 2: Poll ────────────────────────────────────────────────────
    const start = Date.now();

    while (Date.now() - start < maxPollMs) {
        await sleep(pollIntervalMs);

        let pollData: any;
        try {
            const pollRes = await fetch(pollUrlFromJobId(jobId), {
                headers: pollHeaders,
            });
            if (!pollRes.ok) {
                logger.warn(`[AsyncJob] Poll returned ${pollRes.status}`);
                continue;
            }
            pollData = await pollRes.json();
        } catch (e) {
            logger.warn('[AsyncJob] Poll fetch error, retrying…', e);
            continue;
        }

        logger.log(`[AsyncJob] Job ${jobId} → ${pollData.status}`);

        if (pollData.status === 'COMPLETED') {
            return { status: 'COMPLETED', jobId, result: pollData.result as T };
        }

        if (pollData.status === 'FAILED') {
            return { status: 'FAILED', jobId, error: pollData.error };
        }

        // PENDING / RUNNING → keep polling
    }

    return {
        status: 'TIMEOUT',
        jobId,
        error: `Job ${jobId} timed out after ${Math.round(maxPollMs / 1000)}s`,
    };
}

// ─── Error class ────────────────────────────────────────────────────────────

export class AsyncJobDispatchError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly responseData: unknown,
    ) {
        super(message);
        this.name = 'AsyncJobDispatchError';
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

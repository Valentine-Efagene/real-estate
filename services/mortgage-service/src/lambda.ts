import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { PaymentEventType, PaymentPhaseCompletedPayload } from '@valentine-efagene/qshelter-common';
import { app } from './app';
import { phaseOrchestratorService } from './services/phase-orchestrator.service';

let serverlessExpressInstance: any;

async function initialize() {
    serverlessExpressInstance = serverlessExpress({ app });
    return serverlessExpressInstance;
}

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context,
): Promise<APIGatewayProxyResult> => {
    injectAuthorizerHeaders(event);
    if (!serverlessExpressInstance) {
        await initialize();
    }
    return serverlessExpressInstance(event, context);
};

function injectAuthorizerHeaders(event: APIGatewayProxyEvent): void {
    const authorizer = (event.requestContext as any)?.authorizer;
    const ctx = authorizer?.lambda ?? authorizer;
    if (!ctx || typeof ctx !== 'object') return;

    event.headers = event.headers ?? {};
    if (ctx.userId) event.headers['x-authorizer-user-id'] = String(ctx.userId);
    if (ctx.tenantId) event.headers['x-authorizer-tenant-id'] = String(ctx.tenantId);
    if (ctx.email) event.headers['x-authorizer-email'] = String(ctx.email);
    if (ctx.roles) event.headers['x-authorizer-roles'] = String(ctx.roles);
    if (ctx.orgRole) event.headers['x-authorizer-org-role'] = String(ctx.orgRole);
    if (ctx.orgRoles) event.headers['x-authorizer-org-roles'] = String(ctx.orgRoles);
    if (ctx.activeOrgId) event.headers['x-authorizer-active-org-id'] = String(ctx.activeOrgId);
    if (ctx.isPlatformOrg !== undefined) event.headers['x-authorizer-is-platform-org'] = String(ctx.isPlatformOrg);
}

/**
 * SQS Handler for processing payment events
 * 
 * Receives PAYMENT_PHASE_COMPLETED events from payment-service
 * and activates the next phase using the phase orchestrator.
 */
export const sqsHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    console.log('[SQS Handler] Received event with', event.Records.length, 'records');

    const batchItemFailures: SQSBatchItemFailure[] = [];

    for (const record of event.Records) {
        try {
            // Parse the SNS message wrapped in SQS message
            const snsMessage = JSON.parse(record.body);
            const eventPayload = JSON.parse(snsMessage.Message);

            console.log('[SQS Handler] Processing event', {
                messageId: record.messageId,
                eventType: eventPayload.type,
            });

            // Only process PAYMENT_PHASE_COMPLETED events
            if (eventPayload.type === PaymentEventType.PAYMENT_PHASE_COMPLETED) {
                const payload: PaymentPhaseCompletedPayload = eventPayload.payload;

                console.log('[SQS Handler] Processing PAYMENT_PHASE_COMPLETED', {
                    phaseId: payload.phaseId,
                    applicationId: payload.applicationId,
                    phaseName: payload.phaseName,
                });

                // Use the phase orchestrator to activate the next phase
                const result = await phaseOrchestratorService.completePhaseAndActivateNext(
                    payload.phaseId,
                    payload.userId
                );

                console.log('[SQS Handler] Phase orchestration complete', {
                    phaseId: payload.phaseId,
                    nextPhaseId: result.nextPhase?.id || null,
                    applicationCompleted: result.applicationCompleted,
                });
            } else {
                console.log('[SQS Handler] Ignoring event type:', eventPayload.type);
            }
        } catch (error) {
            console.error('[SQS Handler] Error processing message', {
                messageId: record.messageId,
                error: error instanceof Error ? error.message : error,
            });
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }

    return { batchItemFailures };
};

import serverlessExpress from '@codegenie/serverless-express';
import { APIGatewayProxyEvent, Context, Callback, SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { app } from './app';
import { phaseOrchestratorService } from './services/phase-orchestrator.service';
import { PaymentEventType, PaymentPhaseCompletedPayload } from '@valentine-efagene/qshelter-common';

// Create handler once - pass Express app directly, not app.listen()
const serverlessExpressInstance = serverlessExpress({ app });

export const handler = (
    event: APIGatewayProxyEvent,
    context: Context,
    callback: Callback,
) => {
    return serverlessExpressInstance(event, context, callback);
};

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

/**
 * SQS Handler for Policy Sync Events
 * 
 * This handler processes messages from the SQS queue that receives
 * policy change events via SNS subscription.
 */

import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { getPolicySyncService } from '../services/policy-sync.service';
import { AnyPolicyEvent } from '../types/policy-events';

interface SNSMessage {
    Type: string;
    MessageId: string;
    TopicArn: string;
    Message: string;
    Timestamp: string;
    SignatureVersion: string;
    Signature: string;
    SigningCertUrl: string;
    UnsubscribeUrl: string;
}

export async function sqsHandler(event: SQSEvent): Promise<SQSBatchResponse> {
    console.log(`[SQS Handler] Processing ${event.Records.length} messages`);

    const batchItemFailures: SQSBatchItemFailure[] = [];
    const policySyncService = getPolicySyncService();

    for (const record of event.Records) {
        try {
            // Parse the SQS message body
            const body = JSON.parse(record.body);

            // The message might be wrapped in SNS notification format
            let policyEvent: AnyPolicyEvent;

            if (body.Type === 'Notification' && body.Message) {
                // SNS wrapped message
                const snsMessage = body as SNSMessage;
                policyEvent = JSON.parse(snsMessage.Message) as AnyPolicyEvent;
            } else {
                // Direct message (e.g., from direct SQS publish)
                policyEvent = body as AnyPolicyEvent;
            }

            console.log(`[SQS Handler] Processing event: ${policyEvent.eventType} (${policyEvent.eventId})`);

            // Process the event
            await policySyncService.processEvent(policyEvent);

            console.log(`[SQS Handler] Successfully processed: ${policyEvent.eventId}`);
        } catch (error) {
            console.error(`[SQS Handler] Error processing message ${record.messageId}:`, error);

            // Add to batch failures for retry
            batchItemFailures.push({
                itemIdentifier: record.messageId,
            });
        }
    }

    // Return batch item failures for partial batch response
    return { batchItemFailures };
}

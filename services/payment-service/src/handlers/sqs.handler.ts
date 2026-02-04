import { SQSEvent, SQSRecord, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import {
    PaymentEvent,
    PaymentEventType,
    AllocateToInstallmentsPayload,
    WalletCreditedPayload,
    ProcessInstallmentPaymentPayload,
    PaymentPhaseActivatedPayload,
} from '@valentine-efagene/qshelter-common';
import { walletService } from '../services/wallet.service';
import { allocationService } from '../services/allocation.service';
import { installmentGenerationService } from '../services/installment-generation.service';

/**
 * Parse SNS-wrapped SQS message body
 * SNS wraps the message in an envelope when delivering to SQS
 */
function parseMessage(record: SQSRecord): PaymentEvent | null {
    try {
        const body = JSON.parse(record.body);

        // Check if this is an SNS envelope
        if (body && body.Type === 'Notification' && body.Message) {
            return JSON.parse(body.Message) as PaymentEvent;
        }

        // Otherwise, treat as direct message
        return body as PaymentEvent;
    } catch (error) {
        console.error('[SQS Handler] Failed to parse message', {
            messageId: record.messageId,
            body: record.body,
            error,
        });
        return null;
    }
}

/**
 * Handle WALLET.CREDITED event
 * Triggers auto-allocation of funds to pending installments
 */
async function handleWalletCredited(event: PaymentEvent<WalletCreditedPayload>): Promise<void> {
    const { userId, walletId, amount, source } = event.payload;

    console.log('[SQS Handler] Processing wallet credited event', {
        userId,
        walletId,
        amount,
        source,
        correlationId: event.meta.correlationId,
    });

    // Only auto-allocate for virtual account funding
    if (source === 'virtual_account') {
        await allocationService.autoAllocateToPendingInstallments(userId, walletId);
    }
}

/**
 * Handle ALLOCATE_TO_INSTALLMENTS command
 * Manually triggered allocation of funds
 */
async function handleAllocateToInstallments(event: PaymentEvent<AllocateToInstallmentsPayload>): Promise<void> {
    const { userId, walletId, applicationId, maxAmount } = event.payload;

    console.log('[SQS Handler] Processing allocate to installments command', {
        userId,
        walletId,
        applicationId,
        maxAmount,
        correlationId: event.meta.correlationId,
    });

    await allocationService.autoAllocateToPendingInstallments(userId, walletId, {
        applicationId,
        maxAmount,
    });
}

/**
 * Handle PROCESS_INSTALLMENT_PAYMENT command
 * Process a specific installment payment
 */
async function handleProcessInstallmentPayment(event: PaymentEvent<ProcessInstallmentPaymentPayload>): Promise<void> {
    const { installmentId, amount, walletId, userId, reference } = event.payload;

    console.log('[SQS Handler] Processing installment payment', {
        installmentId,
        amount,
        walletId,
        correlationId: event.meta.correlationId,
    });

    await allocationService.payInstallment({
        installmentId,
        amount,
        walletId,
        userId,
        reference,
    });
}

/**
 * Handle PAYMENT_PHASE_ACTIVATED event
 * Triggers automatic installment generation for the phase
 */
async function handlePaymentPhaseActivated(event: PaymentEvent<PaymentPhaseActivatedPayload>): Promise<void> {
    const payload = event.payload;

    console.log('[SQS Handler] Processing payment phase activated event', {
        phaseId: payload.phaseId,
        paymentPhaseId: payload.paymentPhaseId,
        totalAmount: payload.totalAmount,
        correlationId: event.meta.correlationId,
    });

    await installmentGenerationService.generateInstallments({
        phaseId: payload.phaseId,
        applicationId: payload.applicationId,
        tenantId: payload.tenantId,
        paymentPhaseId: payload.paymentPhaseId,
        totalAmount: payload.totalAmount,
        interestRate: payload.interestRate,
        numberOfInstallments: payload.numberOfInstallments,
        paymentPlanId: payload.paymentPlanId,
        startDate: payload.startDate,
        userId: payload.userId,
    });
}

/**
 * Process a single payment event based on type
 */
async function processPaymentEvent(event: PaymentEvent): Promise<void> {
    switch (event.type) {
        case PaymentEventType.WALLET_CREDITED:
            await handleWalletCredited(event as unknown as PaymentEvent<WalletCreditedPayload>);
            break;

        case PaymentEventType.ALLOCATE_TO_INSTALLMENTS:
            await handleAllocateToInstallments(event as unknown as PaymentEvent<AllocateToInstallmentsPayload>);
            break;

        case PaymentEventType.PROCESS_INSTALLMENT_PAYMENT:
            await handleProcessInstallmentPayment(event as unknown as PaymentEvent<ProcessInstallmentPaymentPayload>);
            break;

        case PaymentEventType.PAYMENT_PHASE_ACTIVATED:
            await handlePaymentPhaseActivated(event as unknown as PaymentEvent<PaymentPhaseActivatedPayload>);
            break;

        default:
            console.warn('[SQS Handler] Unknown payment event type', {
                type: event.type,
                correlationId: event.meta?.correlationId,
            });
    }
}

/**
 * SQS Lambda handler for processing payment events
 * Uses partial batch response to handle failures gracefully
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    console.log('[SQS Handler] Received batch', {
        recordCount: event.Records.length,
    });

    const batchItemFailures: SQSBatchItemFailure[] = [];

    for (const record of event.Records) {
        try {
            const message = parseMessage(record);

            if (!message) {
                console.error('[SQS Handler] Skipping unparseable message', {
                    messageId: record.messageId,
                });
                // Don't add to failures - message is malformed and retry won't help
                continue;
            }

            console.log('[SQS Handler] Processing message', {
                messageId: record.messageId,
                type: message.type,
                source: message.meta?.source,
                correlationId: message.meta?.correlationId,
            });

            await processPaymentEvent(message);

            console.log('[SQS Handler] Successfully processed message', {
                messageId: record.messageId,
            });
        } catch (error) {
            console.error('[SQS Handler] Failed to process message', {
                messageId: record.messageId,
                error: error instanceof Error ? error.message : error,
            });

            // Add to failures for retry
            batchItemFailures.push({
                itemIdentifier: record.messageId,
            });
        }
    }

    console.log('[SQS Handler] Batch complete', {
        total: event.Records.length,
        failed: batchItemFailures.length,
        succeeded: event.Records.length - batchItemFailures.length,
    });

    return { batchItemFailures };
};

import { SQSEvent, SQSRecord, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import {
    NotificationEvent,
    NotificationType,
    NotificationChannel,
} from '@valentine-efagene/qshelter-common';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { EmailService } from '../services/email.service';
import { TemplateTypeValue } from '../validators/email.validator';

// Lazy-initialized email service
let emailService: EmailService | null = null;
let secretsLoaded = false;

/**
 * Load notification config secrets from Secrets Manager into process.env
 */
async function loadSecrets(): Promise<void> {
    if (secretsLoaded) return;

    const stage = process.env.STAGE || process.env.NODE_ENV || 'staging';
    const secretId = `qshelter/${stage}/notification-config`;

    console.log('[SQS Handler] Loading secrets from Secrets Manager', { secretId });

    try {
        const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
        const command = new GetSecretValueCommand({ SecretId: secretId });
        const response = await client.send(command);

        if (response.SecretString) {
            const secrets = JSON.parse(response.SecretString);

            // Load secrets into process.env
            for (const [key, value] of Object.entries(secrets)) {
                if (typeof value === 'string' && !process.env[key]) {
                    process.env[key] = value;
                }
            }

            console.log('[SQS Handler] Secrets loaded successfully', {
                keys: Object.keys(secrets),
            });
        }

        secretsLoaded = true;
    } catch (error) {
        console.error('[SQS Handler] Failed to load secrets', {
            secretId,
            error: error instanceof Error ? error.message : error,
        });
        throw error;
    }
}

/**
 * Get or initialize the email service
 */
async function getEmailService(): Promise<EmailService> {
    if (!emailService) {
        await loadSecrets();
        emailService = new EmailService();
    }
    return emailService;
}

/**
 * Parse SNS-wrapped SQS message body
 * SNS wraps the message in an envelope when delivering to SQS
 */
function parseMessage(record: SQSRecord): NotificationEvent | null {
    try {
        const body = JSON.parse(record.body);

        // Check if this is an SNS envelope
        if (body && body.Type === 'Notification' && body.Message) {
            return JSON.parse(body.Message) as NotificationEvent;
        }

        // Otherwise, treat as direct message
        return body as NotificationEvent;
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
 * Map NotificationType enum to TemplateTypeValue
 */
function getTemplateType(notificationType: NotificationType): TemplateTypeValue | null {
    // The NotificationType enum values match TemplateTypeValue
    const typeMap: Record<string, TemplateTypeValue> = {
        [NotificationType.VERIFY_EMAIL]: 'verifyEmail',
        [NotificationType.PASSWORD_RESET]: 'resetPassword',
        [NotificationType.WELCOME]: 'welcomeMessage',
        [NotificationType.ACCOUNT_VERIFIED]: 'accountVerified',
        [NotificationType.ACCOUNT_SUSPENDED]: 'accountSuspended',
        [NotificationType.MISSED_PAYMENT]: 'missedPayments',
        [NotificationType.WALLET_TOP_UP]: 'walletTopUp',
        [NotificationType.PROPERTY_ALLOCATION]: 'propertyAllocation',
        [NotificationType.UPDATED_TERMS]: 'updatedTermsAndConditions',
        [NotificationType.ADMIN_CONTRIBUTION_RECEIVED]: 'adminContributionReceived',
        [NotificationType.ADMIN_PROPERTY_ALLOCATION]: 'adminPropertyAllocation',
        [NotificationType.ADMIN_INVITE]: 'adminInviteAdmin',
        [NotificationType.OTP]: 'otp',
        // Mortgage - Prequalification
        [NotificationType.PREQUALIFICATION_SUBMITTED]: 'prequalificationSubmitted',
        [NotificationType.PREQUALIFICATION_APPROVED]: 'prequalificationApproved',
        [NotificationType.PREQUALIFICATION_REJECTED]: 'prequalificationRejected',
        // Mortgage - Application
        [NotificationType.APPLICATION_CREATED]: 'applicationCreated',
        [NotificationType.APPLICATION_ACTIVATED]: 'applicationActivated',
        [NotificationType.APPLICATION_TERMINATION_REQUESTED]: 'applicationTerminationRequested',
        [NotificationType.APPLICATION_TERMINATION_APPROVED]: 'applicationTerminationApproved',
        [NotificationType.APPLICATION_TERMINATED]: 'applicationTerminated',
        // Mortgage - Payments
        [NotificationType.PAYMENT_RECEIVED]: 'paymentReceived',
        [NotificationType.PAYMENT_FAILED]: 'paymentFailed',
        [NotificationType.PAYMENT_REMINDER]: 'paymentReminder',
        // Mortgage - Offer Letters
        [NotificationType.OFFER_LETTER_SENT]: 'provisionalOfferLetter',
        [NotificationType.OFFER_LETTER_SIGNED]: 'finalOfferLetter',
        // Documents
        [NotificationType.DOCUMENT_APPROVED]: 'documentApproved',
        [NotificationType.DOCUMENT_REJECTED]: 'documentRejected',
    };

    return typeMap[notificationType] || null;
}

/**
 * Process email notification
 */
async function processEmailNotification(event: NotificationEvent): Promise<void> {
    const templateName = getTemplateType(event.type);

    if (!templateName) {
        console.warn('[SQS Handler] Unknown notification type for email', { type: event.type });
        return;
    }

    const payload = event.payload as Record<string, unknown>;

    console.log('[SQS Handler] Processing email notification', {
        type: event.type,
        templateName,
        to: payload.to_email,
        correlationId: event.meta?.correlationId,
    });

    const service = await getEmailService();
    await service.sendTemplateEmail({
        ...payload,
        templateName,
    } as { to_email: string; templateName: typeof templateName;[key: string]: unknown });

    console.log('[SQS Handler] Email sent successfully', {
        type: event.type,
        correlationId: event.meta?.correlationId,
    });
}

/**
 * Process SMS notification (placeholder for future implementation)
 */
async function processSMSNotification(event: NotificationEvent): Promise<void> {
    console.log('[SQS Handler] SMS notifications not yet implemented', {
        type: event.type,
        correlationId: event.meta?.correlationId,
    });
    // TODO: Implement SMS sending
}

/**
 * Process push notification (placeholder for future implementation)
 */
async function processPushNotification(event: NotificationEvent): Promise<void> {
    console.log('[SQS Handler] Push notifications not yet implemented', {
        type: event.type,
        correlationId: event.meta?.correlationId,
    });
    // TODO: Implement push notifications
}

/**
 * Process a single notification event based on channel
 */
async function processNotification(event: NotificationEvent): Promise<void> {
    switch (event.channel) {
        case NotificationChannel.EMAIL:
            await processEmailNotification(event);
            break;
        case NotificationChannel.SMS:
            await processSMSNotification(event);
            break;
        case NotificationChannel.PUSH:
            await processPushNotification(event);
            break;
        default:
            console.warn('[SQS Handler] Unknown notification channel', {
                channel: event.channel,
                type: event.type,
            });
    }
}

/**
 * SQS Lambda handler for processing notification events
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
                channel: message.channel,
                source: message.meta?.source,
                correlationId: message.meta?.correlationId,
            });

            await processNotification(message);

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

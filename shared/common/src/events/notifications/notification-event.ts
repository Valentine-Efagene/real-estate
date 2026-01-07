import { NotificationType, NotificationChannel } from './notification-enums';

/**
 * Metadata attached to every notification event for tracing and debugging
 */
export interface NotificationMeta {
    /** Service that published the event */
    source: string;
    /** ISO timestamp of when event was created */
    timestamp: string;
    /** Correlation ID for distributed tracing */
    correlationId?: string;
    /** User ID if applicable */
    userId?: string;
    /** Tenant ID if applicable */
    tenantId?: string;
}

/**
 * Standard notification event payload sent via SNS->SQS
 * All services must use this interface when publishing notification events
 */
export interface NotificationEvent<T = Record<string, unknown>> {
    /** Type of notification - determines which template/handler to use */
    type: NotificationType;
    /** Delivery channel - email, sms, or push */
    channel: NotificationChannel;
    /** The actual notification data (varies by type) */
    payload: T;
    /** Event metadata for tracing */
    meta: NotificationMeta;
}

/**
 * Email-specific payload fields that most email templates need
 */
export interface EmailPayload {
    /** Recipient email address */
    to_email: string;
    /** Optional subject override (defaults to template title) */
    subject?: string;
}

/**
 * Verify email payload
 */
export interface VerifyEmailPayload extends EmailPayload {
    homeBuyerName: string;
    verificationLink: string;
}

/**
 * Password reset payload
 */
export interface PasswordResetPayload extends EmailPayload {
    homeBuyerName: string;
    otp: string;
    ttl: number;
}

/**
 * Welcome email payload
 */
export interface WelcomePayload extends EmailPayload {
    homeBuyerName: string;
    loginLink: string;
}

/**
 * Missed payments payload
 */
export interface MissedPaymentsPayload extends EmailPayload {
    homeBuyerName: string;
    amount: number;
    loginLink: string;
}

/**
 * Account verified payload
 */
export interface AccountVerifiedPayload extends EmailPayload {
    homeBuyerName: string;
    loginLink: string;
}

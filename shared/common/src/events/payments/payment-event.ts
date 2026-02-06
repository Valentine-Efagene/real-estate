/**
 * Payment event types for the payment service queue
 * These are internal service events, not user-facing notifications
 */
export enum PaymentEventType {
    // Wallet events (published by payment service)
    WALLET_CREDITED = 'wallet.credited',
    WALLET_DEBITED = 'wallet.debited',
    WALLET_CREATED = 'wallet.created',

    // Allocation commands (published by mortgage service or after wallet credit)
    ALLOCATE_TO_INSTALLMENTS = 'payment.allocate_to_installments',

    // Payment commands (published by mortgage service)
    PROCESS_INSTALLMENT_PAYMENT = 'payment.process_installment',
    REFUND_PAYMENT = 'payment.refund',

    // Virtual account events
    VIRTUAL_ACCOUNT_FUNDED = 'virtualaccount.funded',

    // Phase events (published by mortgage service when payment phase is activated)
    PAYMENT_PHASE_ACTIVATED = 'phase.payment_activated',

    // Phase completed (published by payment service when all installments paid)
    // mortgage-service listens to this to activate the next phase
    PAYMENT_PHASE_COMPLETED = 'phase.payment_completed',
}

/**
 * Metadata for payment events
 */
export interface PaymentEventMeta {
    /** Service that published the event */
    source: string;
    /** ISO timestamp of when event was created */
    timestamp: string;
    /** Correlation ID for distributed tracing */
    correlationId?: string;
    /** User ID */
    userId?: string;
    /** Tenant ID */
    tenantId?: string;
}

/**
 * Base payment event structure
 */
export interface PaymentEvent<T = Record<string, unknown>> {
    type: PaymentEventType;
    payload: T;
    meta: PaymentEventMeta;
}

// =============================================================================
// Event Payloads
// =============================================================================

/**
 * Payload when wallet is credited
 */
export interface WalletCreditedPayload {
    walletId: string;
    userId: string;
    transactionId: string;
    amount: number;
    currency: string;
    newBalance: number;
    reference: string;
    source: 'virtual_account' | 'manual' | 'refund';
}

/**
 * Payload for allocating funds to installments
 */
export interface AllocateToInstallmentsPayload {
    userId: string;
    walletId: string;
    /** Optional: limit to specific application */
    applicationId?: string;
    /** Optional: limit to specific amount */
    maxAmount?: number;
}

/**
 * Payload for processing an installment payment
 */
export interface ProcessInstallmentPaymentPayload {
    installmentId: string;
    amount: number;
    walletId: string;
    userId: string;
    reference: string;
}

/**
 * Payload when a PAYMENT phase is activated
 * Triggers installment generation in payment-service
 */
export interface PaymentPhaseActivatedPayload {
    phaseId: string;
    applicationId: string;
    tenantId: string;
    paymentPhaseId: string;
    totalAmount: number;
    interestRate: number;
    numberOfInstallments: number | null;
    paymentPlanId: string;
    /** ISO date string for installment start date */
    startDate: string;
    /** Actor who triggered the phase activation */
    userId: string;
}

/**
 * Payload when a PAYMENT phase is completed (all installments paid)
 * Triggers next phase activation in mortgage-service
 */
export interface PaymentPhaseCompletedPayload {
    phaseId: string;
    applicationId: string;
    tenantId: string;
    paymentPhaseId: string;
    phaseName: string;
    phaseOrder: number;
    /** Actor who made the final payment */
    userId: string;
}

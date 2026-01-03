import {
    NotificationType,
    getEventPublisher,
} from '@valentine-efagene/qshelter-common';

// Use the singleton pattern from qshelter-common
const SERVICE_NAME = 'mortgage-service';

/**
 * Get the EventPublisher instance for mortgage-service
 */
function getPublisher() {
    return getEventPublisher(SERVICE_NAME);
}

/**
 * Format currency for display in emails
 */
export function formatCurrency(amount: number, currency = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
    }).format(amount);
}

/**
 * Format date for display in emails
 */
export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

// ============== Prequalification Notifications ==============

export interface PrequalificationSubmittedPayload {
    email: string;
    userName: string;
    applicationId: string;
    propertyName: string;
    requestedAmount: string;
    submittedDate: string;
    dashboardUrl: string;
}

export async function sendPrequalificationSubmittedNotification(
    payload: PrequalificationSubmittedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.PREQUALIFICATION_SUBMITTED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationId: payload.applicationId,
            propertyName: payload.propertyName,
            requestedAmount: payload.requestedAmount,
            submittedDate: payload.submittedDate,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface PrequalificationApprovedPayload {
    email: string;
    userName: string;
    applicationId: string;
    propertyName: string;
    approvedAmount: string;
    termMonths: number;
    expiryDate: string;
    dashboardUrl: string;
}

export async function sendPrequalificationApprovedNotification(
    payload: PrequalificationApprovedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.PREQUALIFICATION_APPROVED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationId: payload.applicationId,
            propertyName: payload.propertyName,
            approvedAmount: payload.approvedAmount,
            termMonths: payload.termMonths,
            expiryDate: payload.expiryDate,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface PrequalificationRejectedPayload {
    email: string;
    userName: string;
    applicationId: string;
    propertyName: string;
    reason?: string;
}

export async function sendPrequalificationRejectedNotification(
    payload: PrequalificationRejectedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.PREQUALIFICATION_REJECTED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationId: payload.applicationId,
            propertyName: payload.propertyName,
            reason: payload.reason || 'Your application did not meet the required criteria.',
        },
        { correlationId },
    );
}

// ============== Contract Notifications ==============

export interface ContractCreatedPayload {
    email: string;
    userName: string;
    contractNumber: string;
    propertyName: string;
    totalAmount: string;
    termMonths: number;
    monthlyPayment: string;
    dashboardUrl: string;
}

export async function sendContractCreatedNotification(
    payload: ContractCreatedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.CONTRACT_CREATED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            contractNumber: payload.contractNumber,
            propertyName: payload.propertyName,
            totalAmount: payload.totalAmount,
            termMonths: payload.termMonths,
            monthlyPayment: payload.monthlyPayment,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface ContractActivatedPayload {
    email: string;
    userName: string;
    contractNumber: string;
    propertyName: string;
    startDate: string;
    nextPaymentDate: string;
    monthlyPayment: string;
    dashboardUrl: string;
}

export async function sendContractActivatedNotification(
    payload: ContractActivatedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.CONTRACT_ACTIVATED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            contractNumber: payload.contractNumber,
            propertyName: payload.propertyName,
            startDate: payload.startDate,
            nextPaymentDate: payload.nextPaymentDate,
            monthlyPayment: payload.monthlyPayment,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface ContractTerminationRequestedPayload {
    email: string;
    userName: string;
    contractId: string;
    contractNumber: string;
    requestNumber: string;
    terminationType: string;
    reason: string;
    requestDate: Date;
    statusUrl: string;
}

export async function sendContractTerminationRequestedNotification(
    payload: ContractTerminationRequestedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.CONTRACT_TERMINATION_REQUESTED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            contractNumber: payload.contractNumber,
            requestNumber: payload.requestNumber,
            terminationType: payload.terminationType,
            reason: payload.reason,
            requestDate: formatDate(payload.requestDate),
            dashboardLink: payload.statusUrl,
        },
        { correlationId },
    );
}

export interface ContractTerminationApprovedPayload {
    email: string;
    userName: string;
    contractId: string;
    contractNumber: string;
    refundAmount: number;
    processingTime: string;
    statusUrl: string;
}

export async function sendContractTerminationApprovedNotification(
    payload: ContractTerminationApprovedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.CONTRACT_TERMINATION_APPROVED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            contractNumber: payload.contractNumber,
            refundAmount: formatCurrency(payload.refundAmount),
            processingTime: payload.processingTime,
            dashboardLink: payload.statusUrl,
        },
        { correlationId },
    );
}

export interface ContractTerminatedPayload {
    email: string;
    userName: string;
    contractId: string;
    contractNumber: string;
    terminationDate: Date;
    refundAmount: number;
    refundStatus: string;
    supportUrl: string;
}

export async function sendContractTerminatedNotification(
    payload: ContractTerminatedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.CONTRACT_TERMINATED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            contractNumber: payload.contractNumber,
            terminationDate: formatDate(payload.terminationDate),
            refundAmount: formatCurrency(payload.refundAmount),
            refundStatus: payload.refundStatus,
            supportLink: payload.supportUrl,
        },
        { correlationId },
    );
}

// ============== Payment Notifications ==============

export interface PaymentReceivedPayload {
    email: string;
    userName: string;
    contractId: string;
    contractNumber: string;
    paymentAmount: number;
    paymentDate: Date;
    paymentReference: string;
    remainingBalance: number;
    nextPaymentDate?: Date;
    nextPaymentAmount?: number;
    dashboardUrl: string;
}

export async function sendPaymentReceivedNotification(
    payload: PaymentReceivedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.PAYMENT_RECEIVED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            contractNumber: payload.contractNumber,
            paymentAmount: formatCurrency(payload.paymentAmount),
            paymentDate: formatDate(payload.paymentDate),
            paymentReference: payload.paymentReference,
            remainingBalance: formatCurrency(payload.remainingBalance),
            nextPaymentDate: payload.nextPaymentDate ? formatDate(payload.nextPaymentDate) : 'N/A',
            nextPaymentAmount: payload.nextPaymentAmount ? formatCurrency(payload.nextPaymentAmount) : 'N/A',
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface PaymentFailedPayload {
    email: string;
    userName: string;
    contractId: string;
    paymentAmount: number;
    amountDue: number;
    dueDate: Date;
    retryUrl: string;
    supportUrl: string;
}

export async function sendPaymentFailedNotification(
    payload: PaymentFailedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.PAYMENT_FAILED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            paymentAmount: formatCurrency(payload.paymentAmount),
            amountDue: formatCurrency(payload.amountDue),
            dueDate: formatDate(payload.dueDate),
            retryLink: payload.retryUrl,
            supportLink: payload.supportUrl,
        },
        { correlationId },
    );
}

export interface PaymentReminderPayload {
    email: string;
    userName: string;
    contractNumber: string;
    propertyName: string;
    amount: number;
    dueDate: Date;
    daysUntilDue: number;
    paymentUrl: string;
}

export async function sendPaymentReminderNotification(
    payload: PaymentReminderPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.PAYMENT_REMINDER,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            contractNumber: payload.contractNumber,
            propertyName: payload.propertyName,
            amount: formatCurrency(payload.amount),
            dueDate: formatDate(payload.dueDate),
            daysUntilDue: payload.daysUntilDue,
            paymentLink: payload.paymentUrl,
        },
        { correlationId },
    );
}

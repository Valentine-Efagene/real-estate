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

// ============== application Notifications ==============

export interface ApplicationCreatedPayload {
    email: string;
    userName: string;
    applicationNumber: string;
    propertyName: string;
    totalAmount: string;
    termMonths: number;
    monthlyPayment: string;
    dashboardUrl: string;
}

export async function sendApplicationCreatedNotification(
    payload: ApplicationCreatedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.APPLICATION_CREATED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            totalAmount: payload.totalAmount,
            termMonths: payload.termMonths,
            monthlyPayment: payload.monthlyPayment,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface ApplicationActivatedPayload {
    email: string;
    userName: string;
    applicationNumber: string;
    propertyName: string;
    startDate: string;
    nextPaymentDate: string;
    monthlyPayment: string;
    dashboardUrl: string;
}

export async function sendApplicationActivatedNotification(
    payload: ApplicationActivatedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.APPLICATION_ACTIVATED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            startDate: payload.startDate,
            nextPaymentDate: payload.nextPaymentDate,
            monthlyPayment: payload.monthlyPayment,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface ApplicationTerminationRequestedPayload {
    email: string;
    userName: string;
    applicationId: string;
    applicationNumber: string;
    requestNumber: string;
    terminationType: string;
    reason: string;
    requestDate: Date;
    statusUrl: string;
}

export async function sendApplicationTerminationRequestedNotification(
    payload: ApplicationTerminationRequestedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.APPLICATION_TERMINATION_REQUESTED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            requestNumber: payload.requestNumber,
            terminationType: payload.terminationType,
            reason: payload.reason,
            requestDate: formatDate(payload.requestDate),
            dashboardLink: payload.statusUrl,
        },
        { correlationId },
    );
}

export interface ApplicationTerminationApprovedPayload {
    email: string;
    userName: string;
    applicationId: string;
    applicationNumber: string;
    refundAmount: number;
    processingTime: string;
    statusUrl: string;
}

export async function sendApplicationTerminationApprovedNotification(
    payload: ApplicationTerminationApprovedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.APPLICATION_TERMINATION_APPROVED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            refundAmount: formatCurrency(payload.refundAmount),
            processingTime: payload.processingTime,
            dashboardLink: payload.statusUrl,
        },
        { correlationId },
    );
}

export interface ApplicationTerminatedPayload {
    email: string;
    userName: string;
    applicationId: string;
    applicationNumber: string;
    terminationDate: Date;
    refundAmount: number;
    refundStatus: string;
    supportUrl: string;
}

export async function sendApplicationTerminatedNotification(
    payload: ApplicationTerminatedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.APPLICATION_TERMINATED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
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
    applicationId: string;
    applicationNumber: string;
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
            applicationNumber: payload.applicationNumber,
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
    applicationId: string;
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
    applicationNumber: string;
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
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            amount: formatCurrency(payload.amount),
            dueDate: formatDate(payload.dueDate),
            daysUntilDue: payload.daysUntilDue,
            paymentLink: payload.paymentUrl,
        },
        { correlationId },
    );
}

// ============== Offer Letter Notifications ==============

export interface OfferLetterNotificationPayload {
    email: string;
    userName: string;
    letterNumber: string;
    letterType: string; // "Provisional Offer Letter" or "Final Offer Letter"
    applicationNumber: string;
    propertyName: string;
    expiryDate: string;
    viewUrl: string;
    customMessage?: string;
}

export async function sendOfferLetterNotification(
    payload: OfferLetterNotificationPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.OFFER_LETTER_SENT,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            letterNumber: payload.letterNumber,
            letterType: payload.letterType,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            expiryDate: payload.expiryDate,
            viewLink: payload.viewUrl,
            customMessage: payload.customMessage,
        },
        { correlationId },
    );
}

export interface OfferLetterSignedPayload {
    email: string;
    userName: string;
    letterNumber: string;
    letterType: string;
    applicationNumber: string;
    propertyName: string;
    signedDate: string;
    downloadUrl: string;
}

export async function sendOfferLetterSignedNotification(
    payload: OfferLetterSignedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.OFFER_LETTER_SIGNED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            letterNumber: payload.letterNumber,
            letterType: payload.letterType,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            signedDate: payload.signedDate,
            downloadLink: payload.downloadUrl,
        },
        { correlationId },
    );
}

// ============== Document Notifications ==============

export interface DocumentApprovedPayload {
    email: string;
    userName: string;
    documentName: string;
    stepName: string;
    applicationNumber: string;
    propertyName?: string;
    approvedDate: string;
    dashboardUrl: string;
}

export async function sendDocumentApprovedNotification(
    payload: DocumentApprovedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.DOCUMENT_APPROVED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            documentName: payload.documentName,
            stepName: payload.stepName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            approvedDate: payload.approvedDate,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface DocumentRejectedPayload {
    email: string;
    userName: string;
    documentName: string;
    stepName: string;
    applicationNumber: string;
    propertyName?: string;
    reason: string;
    dashboardUrl: string;
}

export async function sendDocumentRejectedNotification(
    payload: DocumentRejectedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.DOCUMENT_REJECTED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            documentName: payload.documentName,
            stepName: payload.stepName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            reason: payload.reason,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

/**
 * Payload for application superseded notification
 */
export interface ApplicationSupersededPayload {
    email: string;
    userName: string;
    applicationNumber: string;
    propertyName: string;
    unitNumber: string;
    dashboardUrl: string;
}

/**
 * Send notification when a buyer's application has been superseded
 * (another buyer locked the unit they were applying for)
 */
export async function sendApplicationSupersededNotification(
    payload: ApplicationSupersededPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.APPLICATION_SUPERSEDED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            unitNumber: payload.unitNumber,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

/**
 * Payload for questionnaire phase completed notification
 */
export interface QuestionnairePhaseCompletedPayload {
    email: string;
    userName: string;
    applicationNumber: string;
    propertyName: string;
    unitNumber: string;
    phaseName: string;
    score?: number;
    maxScore?: number;
    passed: boolean;
    dashboardUrl: string;
}

/**
 * Send notification when a questionnaire phase is completed.
 */
export async function sendQuestionnairePhaseCompletedNotification(
    payload: QuestionnairePhaseCompletedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.QUESTIONNAIRE_PHASE_COMPLETED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            unitNumber: payload.unitNumber,
            phaseName: payload.phaseName,
            score: payload.score,
            maxScore: payload.maxScore,
            passed: payload.passed,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

/**
 * Payload for documentation phase completed notification
 */
export interface DocumentationPhaseCompletedPayload {
    email: string;
    userName: string;
    applicationNumber: string;
    propertyName: string;
    unitNumber: string;
    phaseName: string;
    stepsCompleted: number;
    dashboardUrl: string;
}

/**
 * Send notification when a documentation phase is completed.
 */
export async function sendDocumentationPhaseCompletedNotification(
    payload: DocumentationPhaseCompletedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.DOCUMENTATION_PHASE_COMPLETED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            unitNumber: payload.unitNumber,
            phaseName: payload.phaseName,
            stepsCompleted: payload.stepsCompleted,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

/**
 * Payload for payment phase completed notification
 */
export interface PaymentPhaseCompletedPayload {
    email: string;
    userName: string;
    applicationNumber: string;
    propertyName: string;
    unitNumber: string;
    phaseName: string;
    totalPaid: string;
    installmentsPaid: number;
    dashboardUrl: string;
}

/**
 * Send notification when a payment phase is completed.
 */
export async function sendPaymentPhaseCompletedNotification(
    payload: PaymentPhaseCompletedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.PAYMENT_PHASE_COMPLETED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            unitNumber: payload.unitNumber,
            phaseName: payload.phaseName,
            totalPaid: payload.totalPaid,
            installmentsPaid: payload.installmentsPaid,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

// ============== Bank/Organization Review Notifications ==============

export interface BankReviewRequiredPayload {
    email: string;
    reviewerName: string;
    organizationName: string;
    applicationNumber: string;
    customerName: string;
    propertyName: string;
    unitNumber: string;
    stageName: string;
    documentsCount: number;
    slaHours?: number;
    slaDeadline?: string;
    dashboardUrl: string;
}

/**
 * Send notification to bank/organization when their review stage activates.
 * This is an AUTOMATIC notification - no manual event configuration needed.
 */
export async function sendBankReviewRequiredNotification(
    payload: BankReviewRequiredPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.BANK_REVIEW_REQUIRED,
        {
            to_email: payload.email,
            reviewerName: payload.reviewerName,
            organizationName: payload.organizationName,
            applicationNumber: payload.applicationNumber,
            customerName: payload.customerName,
            propertyName: payload.propertyName,
            unitNumber: payload.unitNumber,
            stageName: payload.stageName,
            documentsCount: payload.documentsCount,
            slaHours: payload.slaHours,
            slaDeadline: payload.slaDeadline,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface StageCompletedNotificationPayload {
    email: string;
    userName: string;
    applicationNumber: string;
    propertyName: string;
    unitNumber: string;
    stageName: string;
    completedBy: string;
    nextStageName?: string;
    isPhaseComplete: boolean;
    dashboardUrl: string;
}

/**
 * Send notification when an approval stage is completed.
 * Notifies customer and relevant parties of progress.
 */
export async function sendStageCompletedNotification(
    payload: StageCompletedNotificationPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.STAGE_COMPLETED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            unitNumber: payload.unitNumber,
            stageName: payload.stageName,
            completedBy: payload.completedBy,
            nextStageName: payload.nextStageName,
            isPhaseComplete: payload.isPhaseComplete,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

// ============== SLA Notifications ==============

export interface SlaWarningPayload {
    email: string;
    recipientName: string;
    applicationNumber: string;
    propertyName: string;
    stageName: string;
    slaDeadline: string;
    hoursRemaining: number;
    dashboardUrl: string;
}

/**
 * Send SLA warning when approaching the breach deadline.
 */
export async function sendSlaWarningNotification(
    payload: SlaWarningPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.SLA_WARNING,
        {
            to_email: payload.email,
            recipientName: payload.recipientName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            stageName: payload.stageName,
            slaDeadline: payload.slaDeadline,
            hoursRemaining: payload.hoursRemaining,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

export interface SlaBreachedPayload {
    email: string;
    recipientName: string;
    applicationNumber: string;
    propertyName: string;
    stageName: string;
    slaDeadline: string;
    breachedAt: string;
    hoursOverdue: number;
    dashboardUrl: string;
}

/**
 * Send SLA breach notification when the deadline has passed.
 */
export async function sendSlaBreachedNotification(
    payload: SlaBreachedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.SLA_BREACHED,
        {
            to_email: payload.email,
            recipientName: payload.recipientName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            stageName: payload.stageName,
            slaDeadline: payload.slaDeadline,
            breachedAt: payload.breachedAt,
            hoursOverdue: payload.hoursOverdue,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

// ============== Offer Letter Expiry Notifications ==============

export interface OfferLetterExpiredPayload {
    email: string;
    userName: string;
    applicationNumber: string;
    propertyName: string;
    offerLetterType: string;
    expiryDate: string;
    dashboardUrl: string;
}

/**
 * Send notification when an offer letter has expired without being signed.
 */
export async function sendOfferLetterExpiredNotification(
    payload: OfferLetterExpiredPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.OFFER_LETTER_EXPIRED,
        {
            to_email: payload.email,
            homeBuyerName: payload.userName,
            applicationNumber: payload.applicationNumber,
            propertyName: payload.propertyName,
            offerLetterType: payload.offerLetterType,
            expiryDate: payload.expiryDate,
            dashboardLink: payload.dashboardUrl,
        },
        { correlationId },
    );
}

// ============== Co-Applicant Notifications ==============

export interface CoApplicantInvitedPayload {
    email: string;
    inviteeName: string;
    inviterName: string;
    applicationTitle: string;
    propertyName: string;
    acceptLink: string;
    expiresAt: string;
}

export async function sendCoApplicantInvitedNotification(
    payload: CoApplicantInvitedPayload,
    correlationId?: string,
): Promise<void> {
    const publisher = getPublisher();
    await publisher.publishEmail(
        NotificationType.CO_APPLICANT_INVITED,
        {
            to_email: payload.email,
            inviteeName: payload.inviteeName,
            inviterName: payload.inviterName,
            applicationTitle: payload.applicationTitle,
            propertyName: payload.propertyName,
            acceptLink: payload.acceptLink,
            expiresAt: payload.expiresAt,
        },
        { correlationId },
    );
}

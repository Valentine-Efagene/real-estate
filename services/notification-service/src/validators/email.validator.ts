import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// ============== Enums ==============

export const TemplateType = z.enum([
    'otp',
    'welcomeMessage',
    'accountSuspended',
    'accountVerified',
    'missedPayments',
    'propertyAllocation',
    'resetPassword',
    'updatedTermsAndConditions',
    'verifyEmail',
    'walletTopUp',
    'adminContributionReceived',
    'adminPropertyAllocation',
    'adminInviteAdmin',
    // Mortgage - Prequalification
    'prequalificationSubmitted',
    'prequalificationApproved',
    'prequalificationRejected',
    // Mortgage - Application
    'applicationCreated',
    'applicationActivated',
    'applicationTerminationRequested',
    'applicationTerminationApproved',
    'applicationTerminated',
    // Mortgage - Payments
    'paymentReceived',
    'paymentFailed',
    'paymentReminder',
    // Mortgage - Offer Letters
    'provisionalOfferLetter',
    'finalOfferLetter',
    'applicationCongratulations',
    // Documents
    'documentApproved',
    'documentRejected',
    // Organization
    'organizationInvitation',
    'organizationInvitationAccepted',
    'organizationInvitationExpired',
    // Application lifecycle
    'applicationSuperseded',
    // Unit locking
    'unitLocked',
    'unitReleased',
    // Phase completions
    'questionnairePhaseCompleted',
    'documentationPhaseCompleted',
    'paymentPhaseCompleted',
    // Offer letter expiry
    'offerLetterExpired',
    // Underwriting
    'underwritingApproved',
    'underwritingRejected',
    'underwritingConditional',
    // Bank review
    'bankReviewRequired',
    // Stage completion
    'stageCompleted',
    // SLA
    'slaWarning',
    'slaBreached',
    // Co-Applicant
    'coApplicantInvited',
]);

export type TemplateTypeValue = z.infer<typeof TemplateType>;

// ============== Base Schemas ==============

export const BaseEmailSchema = z.object({
    to_email: z.email(),
}).openapi('BaseEmail');

export const SendEmailSchema = BaseEmailSchema.extend({
    subject: z.string().min(1),
    message: z.string().min(1),
}).openapi('SendEmail');

export const SendTemplateEmailSchema = BaseEmailSchema.extend({
    subject: z.string().optional(),
    templateName: TemplateType,
}).openapi('SendTemplateEmail');

export const SendRawHtmlEmailSchema = BaseEmailSchema.extend({
    subject: z.string().min(1),
    html: z.string().min(1),
}).openapi('SendRawHtmlEmail');

// ============== Specific Email Schemas ==============

export const AccountSuspendedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    reason: z.string().min(1),
}).openapi('AccountSuspended');

export const AccountVerifiedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    loginLink: z.url(),
}).openapi('AccountVerified');

export const MissedPaymentsSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    amount: z.number().positive(),
    loginLink: z.url(),
}).openapi('MissedPayments');

export const PropertyAllocationSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    equity: z.number(),
}).openapi('PropertyAllocation');

export const ResetPasswordSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    otp: z.string().min(1),
    ttl: z.number().positive(),
}).openapi('ResetPassword');

export const UpdatedTermsAndConditionsSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
}).openapi('UpdatedTermsAndConditions');

export const VerifyEmailSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    verificationLink: z.url(),
}).openapi('VerifyEmail');

export const WalletTopUpSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    amount: z.number().positive(),
    transactionId: z.string().min(1),
    walletBalance: z.number().nonnegative(),
}).openapi('WalletTopUp');

export const AdminContributionReceivedSchema = BaseEmailSchema.extend({
    customerName: z.string().min(1),
    amount: z.number().positive(),
    transactionID: z.string().min(1),
}).openapi('AdminContributionReceived');

export const AdminPropertyAllocationSchema = BaseEmailSchema.extend({
    customerName: z.string().min(1),
    planType: z.string().min(1),
    propertyDetail: z.string().min(1),
}).openapi('AdminPropertyAllocation');

export const AdminInviteAdminSchema = BaseEmailSchema.extend({
    firstName: z.string().min(1),
    inviteLink: z.url(),
}).openapi('AdminInviteAdmin');

// ============== Mortgage - Prequalification Schemas ==============

export const PrequalificationSubmittedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationId: z.string().min(1),
    propertyName: z.string().min(1),
    requestedAmount: z.string().min(1),
    submittedDate: z.string().min(1),
    dashboardLink: z.url(),
}).openapi('PrequalificationSubmitted');

export const PrequalificationApprovedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationId: z.string().min(1),
    propertyName: z.string().min(1),
    approvedAmount: z.string().min(1),
    termMonths: z.number().positive(),
    expiryDate: z.string().min(1),
    dashboardLink: z.url(),
}).openapi('PrequalificationApproved');

export const PrequalificationRejectedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationId: z.string().min(1),
    propertyName: z.string().min(1),
    reason: z.string().optional(),
}).openapi('PrequalificationRejected');

// ============== Mortgage - Application Schemas ==============

export const ApplicationCreatedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    totalAmount: z.string().min(1),
    termMonths: z.number().positive(),
    monthlyPayment: z.string().min(1),
    dashboardLink: z.url(),
}).openapi('ApplicationCreated');

export const ApplicationActivatedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    startDate: z.string().min(1),
    nextPaymentDate: z.string().min(1),
    monthlyPayment: z.string().min(1),
    dashboardLink: z.url(),
}).openapi('ApplicationActivated');

export const ApplicationTerminationRequestedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    terminationType: z.string().min(1),
    requestDate: z.string().min(1),
    reason: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('ApplicationTerminationRequested');

export const ApplicationTerminationApprovedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    terminationDate: z.string().min(1),
    totalPaid: z.string().optional(),
    refundAmount: z.string().optional(),
    deductions: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('ApplicationTerminationApproved');

export const ApplicationTerminatedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    startDate: z.string().min(1),
    terminationDate: z.string().min(1),
    totalPaymentsMade: z.number().nonnegative(),
    totalAmountPaid: z.string().min(1),
    refundStatus: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('ApplicationTerminated');

// ============== Mortgage - Payment Schemas ==============

export const PaymentReceivedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    paymentReference: z.string().min(1),
    amount: z.string().min(1),
    applicationNumber: z.string().min(1),
    paymentDate: z.string().min(1),
    paymentMethod: z.string().min(1),
    totalPaid: z.string().min(1),
    remainingBalance: z.string().min(1),
    nextPaymentDate: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('PaymentReceived');

export const PaymentFailedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    paymentReference: z.string().min(1),
    amount: z.string().min(1),
    applicationNumber: z.string().min(1),
    attemptDate: z.string().min(1),
    failureReason: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('PaymentFailed');

export const PaymentReminderSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    amount: z.string().min(1),
    dueDate: z.string().min(1),
    daysUntilDue: z.number().nonnegative(),
    paymentLink: z.url(),
}).openapi('PaymentReminder');

export const TestTempSchema = z.object({
    path: z.string().min(1),
}).openapi('TestTemp');

// ============== Application Lifecycle Schemas ==============

export const ApplicationSupersededSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    supersededDate: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('ApplicationSuperseded');

// ============== Unit Locking Schemas ==============

export const UnitLockedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    unitName: z.string().min(1),
    lockExpiryDate: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('UnitLocked');

export const UnitReleasedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    unitName: z.string().min(1),
    reason: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('UnitReleased');

// ============== Phase Completion Schemas ==============

export const PhaseCompletedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    phaseName: z.string().min(1),
    completedDate: z.string().min(1),
    nextPhaseName: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('PhaseCompleted');

export const PaymentPhaseCompletedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    phaseName: z.string().min(1),
    totalAmountPaid: z.string().min(1),
    completedDate: z.string().min(1),
    nextPhaseName: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('PaymentPhaseCompleted');

// ============== Offer Letter Expiry Schema ==============

export const OfferLetterExpiredSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    offerLetterType: z.string().min(1),
    expiryDate: z.string().min(1),
    dashboardLink: z.url(),
}).openapi('OfferLetterExpired');

// ============== Underwriting Schemas ==============

export const UnderwritingApprovedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    approvedAmount: z.string().optional(),
    approvedDate: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('UnderwritingApproved');

export const UnderwritingRejectedSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    reason: z.string().optional(),
    reviewedDate: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('UnderwritingRejected');

export const UnderwritingConditionalSchema = BaseEmailSchema.extend({
    homeBuyerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    conditions: z.string().optional(),
    reviewedDate: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('UnderwritingConditional');

// ============== Bank Review Schema ==============

export const BankReviewRequiredSchema = BaseEmailSchema.extend({
    reviewerName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    applicantName: z.string().min(1),
    slaDeadline: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('BankReviewRequired');

// ============== Stage Completion Schema ==============

export const StageCompletedSchema = BaseEmailSchema.extend({
    recipientName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    stageName: z.string().min(1),
    completedDate: z.string().min(1),
    nextStageName: z.string().optional(),
    dashboardLink: z.url(),
}).openapi('StageCompleted');

// ============== SLA Schemas ==============

export const SlaWarningSchema = BaseEmailSchema.extend({
    recipientName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    stageName: z.string().min(1),
    slaDeadline: z.string().min(1),
    hoursRemaining: z.number().positive(),
    dashboardLink: z.url(),
}).openapi('SlaWarning');

export const SlaBreachedSchema = BaseEmailSchema.extend({
    recipientName: z.string().min(1),
    applicationNumber: z.string().min(1),
    propertyName: z.string().min(1),
    stageName: z.string().min(1),
    slaDeadline: z.string().min(1),
    breachedAt: z.string().min(1),
    hoursOverdue: z.number().nonnegative(),
    dashboardLink: z.url(),
}).openapi('SlaBreached');

// ============== Organization Invitation Expired Schema ==============

export const OrganizationInvitationExpiredSchema = BaseEmailSchema.extend({
    recipientName: z.string().min(1),
    organizationName: z.string().min(1),
    role: z.string().min(1),
    expiryDate: z.string().min(1),
    contactEmail: z.string().optional(),
}).openapi('OrganizationInvitationExpired');

// ============== Co-Applicant Invitation Schema ==============

export const CoApplicantInvitedSchema = BaseEmailSchema.extend({
    inviteeName: z.string().min(1),
    inviterName: z.string().min(1),
    applicationTitle: z.string().min(1),
    propertyName: z.string().min(1),
    acceptLink: z.string().url(),
    expiresAt: z.string().min(1),
}).openapi('CoApplicantInvited');

// ============== Types ==============

export type BaseEmailInput = z.infer<typeof BaseEmailSchema>;
export type SendEmailInput = z.infer<typeof SendEmailSchema>;
export type SendTemplateEmailInput = z.infer<typeof SendTemplateEmailSchema>;
export type SendRawHtmlEmailInput = z.infer<typeof SendRawHtmlEmailSchema>;
export type AccountSuspendedInput = z.infer<typeof AccountSuspendedSchema>;
export type AccountVerifiedInput = z.infer<typeof AccountVerifiedSchema>;
export type MissedPaymentsInput = z.infer<typeof MissedPaymentsSchema>;
export type PropertyAllocationInput = z.infer<typeof PropertyAllocationSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UpdatedTermsAndConditionsInput = z.infer<typeof UpdatedTermsAndConditionsSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type WalletTopUpInput = z.infer<typeof WalletTopUpSchema>;
export type AdminContributionReceivedInput = z.infer<typeof AdminContributionReceivedSchema>;
export type AdminPropertyAllocationInput = z.infer<typeof AdminPropertyAllocationSchema>;
export type AdminInviteAdminInput = z.infer<typeof AdminInviteAdminSchema>;
export type PrequalificationSubmittedInput = z.infer<typeof PrequalificationSubmittedSchema>;
export type PrequalificationApprovedInput = z.infer<typeof PrequalificationApprovedSchema>;
export type PrequalificationRejectedInput = z.infer<typeof PrequalificationRejectedSchema>;
export type ApplicationCreatedInput = z.infer<typeof ApplicationCreatedSchema>;
export type ApplicationActivatedInput = z.infer<typeof ApplicationActivatedSchema>;
export type ApplicationTerminationRequestedInput = z.infer<typeof ApplicationTerminationRequestedSchema>;
export type ApplicationTerminationApprovedInput = z.infer<typeof ApplicationTerminationApprovedSchema>;
export type ApplicationTerminatedInput = z.infer<typeof ApplicationTerminatedSchema>;
export type PaymentReceivedInput = z.infer<typeof PaymentReceivedSchema>;
export type PaymentFailedInput = z.infer<typeof PaymentFailedSchema>;
export type PaymentReminderInput = z.infer<typeof PaymentReminderSchema>;
export type TestTempInput = z.infer<typeof TestTempSchema>;
export type ApplicationSupersededInput = z.infer<typeof ApplicationSupersededSchema>;
export type UnitLockedInput = z.infer<typeof UnitLockedSchema>;
export type UnitReleasedInput = z.infer<typeof UnitReleasedSchema>;
export type PhaseCompletedInput = z.infer<typeof PhaseCompletedSchema>;
export type PaymentPhaseCompletedInput = z.infer<typeof PaymentPhaseCompletedSchema>;
export type OfferLetterExpiredInput = z.infer<typeof OfferLetterExpiredSchema>;
export type UnderwritingApprovedInput = z.infer<typeof UnderwritingApprovedSchema>;
export type UnderwritingRejectedInput = z.infer<typeof UnderwritingRejectedSchema>;
export type UnderwritingConditionalInput = z.infer<typeof UnderwritingConditionalSchema>;
export type BankReviewRequiredInput = z.infer<typeof BankReviewRequiredSchema>;
export type StageCompletedInput = z.infer<typeof StageCompletedSchema>;
export type SlaWarningInput = z.infer<typeof SlaWarningSchema>;
export type SlaBreachedInput = z.infer<typeof SlaBreachedSchema>;
export type OrganizationInvitationExpiredInput = z.infer<typeof OrganizationInvitationExpiredSchema>;
export type CoApplicantInvitedInput = z.infer<typeof CoApplicantInvitedSchema>;

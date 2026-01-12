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
    otp: z.string().min(1),
    ttl: z.number().positive(),
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

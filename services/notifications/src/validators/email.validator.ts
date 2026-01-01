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
export type TestTempInput = z.infer<typeof TestTempSchema>;

import { TemplateTypeValue } from '../validators/email.validator';

/**
 * Template path mappings - maps template names to file paths
 * Using Object.freeze for immutability and potential V8 optimizations
 */
export const templatePathMap: Readonly<Record<TemplateTypeValue, string>> = Object.freeze({
    'otp': 'otp.html',
    'welcomeMessage': 'welcome.html',
    'accountSuspended': 'content/accountSuspended.hbs',
    'accountVerified': 'content/accountVerified.hbs',
    'missedPayments': 'content/missedPayments.hbs',
    'propertyAllocation': 'content/propertyAllocation.hbs',
    'resetPassword': 'content/resetPassword.hbs',
    'updatedTermsAndConditions': 'content/updatedTermsAndConditions.hbs',
    'verifyEmail': 'content/verifyEmail.hbs',
    'walletTopUp': 'content/walletTopUp.hbs',
    'adminContributionReceived': 'content/admin/contributionReceived.hbs',
    'adminPropertyAllocation': 'content/admin/propertyAllocation.hbs',
    'adminInviteAdmin': 'content/admin/inviteAdmin.hbs',
});

/**
 * Template titles - maps template names to email subjects
 */
export const templateTitle: Readonly<Record<TemplateTypeValue, string>> = Object.freeze({
    'otp': 'Your OTP Code',
    'welcomeMessage': 'Welcome',
    'accountSuspended': 'Account Suspended',
    'accountVerified': 'Account Verified',
    'missedPayments': 'Missed Payments',
    'propertyAllocation': 'Property Allocation',
    'resetPassword': 'Reset Your Password',
    'updatedTermsAndConditions': 'Updated Terms and Conditions',
    'verifyEmail': 'Verify Your Email',
    'walletTopUp': 'Wallet Top-Up Confirmation',
    'adminContributionReceived': 'Contribution Received',
    'adminPropertyAllocation': 'Property Allocation',
    'adminInviteAdmin': 'Admin Invitation',
});

// Pre-computed set of dynamic templates for O(1) lookup
const dynamicTemplateSet = new Set(
    Object.entries(templatePathMap)
        .filter(([, value]) => value.endsWith('.hbs'))
        .map(([key]) => key as TemplateTypeValue)
);

/**
 * Get list of template names that use dynamic .hbs templates
 * Cached for performance - computed once at module load
 */
export function getDynamicTemplates(): TemplateTypeValue[] {
    return Array.from(dynamicTemplateSet);
}

/**
 * Check if a template is dynamic (uses .hbs format)
 * O(1) lookup using Set
 */
export function isDynamicTemplate(templateName: TemplateTypeValue): boolean {
    return dynamicTemplateSet.has(templateName);
}

/**
 * Get template path by name with type safety
 */
export function getTemplatePath(templateName: TemplateTypeValue): string {
    return templatePathMap[templateName];
}

/**
 * Get template title by name with type safety
 */
export function getTemplateTitle(templateName: TemplateTypeValue): string {
    return templateTitle[templateName];
}

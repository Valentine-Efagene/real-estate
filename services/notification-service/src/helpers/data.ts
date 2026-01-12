import { TemplateTypeValue } from '../validators/email.validator';

/**
 * Template path mappings - maps template names to file paths
 * All templates use the layout system via content/*.hbs files
 * Using Object.freeze for immutability and potential V8 optimizations
 */
export const templatePathMap: Readonly<Record<TemplateTypeValue, string>> = Object.freeze({
    // General / Auth
    'otp': 'content/otp.hbs',
    'welcomeMessage': 'content/welcomeMessage.hbs',
    'accountSuspended': 'content/accountSuspended.hbs',
    'accountVerified': 'content/accountVerified.hbs',
    'resetPassword': 'content/resetPassword.hbs',
    'verifyEmail': 'content/verifyEmail.hbs',
    // User Account
    'missedPayments': 'content/missedPayments.hbs',
    'propertyAllocation': 'content/propertyAllocation.hbs',
    'updatedTermsAndConditions': 'content/updatedTermsAndConditions.hbs',
    'walletTopUp': 'content/walletTopUp.hbs',
    // Admin notifications
    'adminContributionReceived': 'content/admin/contributionReceived.hbs',
    'adminPropertyAllocation': 'content/admin/propertyAllocation.hbs',
    'adminInviteAdmin': 'content/admin/inviteAdmin.hbs',
    // Mortgage - Prequalification
    'prequalificationSubmitted': 'content/prequalificationSubmitted.hbs',
    'prequalificationApproved': 'content/prequalificationApproved.hbs',
    'prequalificationRejected': 'content/prequalificationRejected.hbs',
    // Mortgage - Application
    'applicationCreated': 'content/applicationCreated.hbs',
    'applicationActivated': 'content/applicationActivated.hbs',
    'applicationTerminationRequested': 'content/applicationTerminationRequested.hbs',
    'applicationTerminationApproved': 'content/applicationTerminationApproved.hbs',
    'applicationTerminated': 'content/applicationTerminated.hbs',
    // Mortgage - Payments
    'paymentReceived': 'content/paymentReceived.hbs',
    'paymentFailed': 'content/paymentFailed.hbs',
    'paymentReminder': 'content/paymentReminder.hbs',
    // Mortgage - Offer Letters
    'provisionalOfferLetter': 'content/provisionalOfferLetter.hbs',
    'finalOfferLetter': 'content/finalOfferLetter.hbs',
    'applicationCongratulations': 'content/applicationCongratulations.hbs',
    // Documents
    'documentApproved': 'content/documentApproved.hbs',
    'documentRejected': 'content/documentRejected.hbs',
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
    // Mortgage - Prequalification
    'prequalificationSubmitted': 'Prequalification Application Received',
    'prequalificationApproved': 'Congratulations! Your Prequalification is Approved',
    'prequalificationRejected': 'Prequalification Application Update',
    // Mortgage - Application
    'applicationCreated': 'Your Mortgage Application Has Been Created',
    'applicationActivated': 'Your Mortgage Application is Now Active',
    'applicationTerminationRequested': 'Application Termination Request Received',
    'applicationTerminationApproved': 'Application Termination Approved',
    'applicationTerminated': 'Application Terminated',
    // Mortgage - Payments
    'paymentReceived': 'Payment Received Successfully',
    'paymentFailed': 'Payment Failed - Action Required',
    'paymentReminder': 'Payment Reminder',
    // Mortgage - Offer Letters
    'provisionalOfferLetter': 'Your Provisional Offer Letter is Ready',
    'finalOfferLetter': 'Final Offer Letter - Application Finalization',
    'applicationCongratulations': 'Congratulations! Your Property Purchase is Complete',
    // Documents
    'documentApproved': 'Your Document Has Been Approved',
    'documentRejected': 'Document Requires Resubmission',
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

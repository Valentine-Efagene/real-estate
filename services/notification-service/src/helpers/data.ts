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
    // Mortgage - Prequalification
    'prequalificationSubmitted': 'content/prequalificationSubmitted.hbs',
    'prequalificationApproved': 'content/prequalificationApproved.hbs',
    'prequalificationRejected': 'content/prequalificationRejected.hbs',
    // Mortgage - Contract
    'contractCreated': 'content/contractCreated.hbs',
    'contractActivated': 'content/contractActivated.hbs',
    'contractTerminationRequested': 'content/contractTerminationRequested.hbs',
    'contractTerminationApproved': 'content/contractTerminationApproved.hbs',
    'contractTerminated': 'content/contractTerminated.hbs',
    // Mortgage - Payments
    'paymentReceived': 'content/paymentReceived.hbs',
    'paymentFailed': 'content/paymentFailed.hbs',
    'paymentReminder': 'content/paymentReminder.hbs',
    // Mortgage - Offer Letters
    'provisionalOfferLetter': 'provisionalOfferLetter.html',
    'finalOfferLetter': 'finalOfferLetter.html',
    'contractCongratulations': 'content/contractCongratulations.hbs',
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
    // Mortgage - Contract
    'contractCreated': 'Your Mortgage Contract Has Been Created',
    'contractActivated': 'Your Mortgage Contract is Now Active',
    'contractTerminationRequested': 'Contract Termination Request Received',
    'contractTerminationApproved': 'Contract Termination Approved',
    'contractTerminated': 'Contract Terminated',
    // Mortgage - Payments
    'paymentReceived': 'Payment Received Successfully',
    'paymentFailed': 'Payment Failed - Action Required',
    'paymentReminder': 'Payment Reminder',
    // Mortgage - Offer Letters
    'provisionalOfferLetter': 'Your Provisional Offer Letter is Ready',
    'finalOfferLetter': 'Final Offer Letter - Contract Finalization',
    'contractCongratulations': 'Congratulations! Your Property Purchase is Complete',
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

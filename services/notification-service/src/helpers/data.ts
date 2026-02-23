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
    // Organization
    'organizationInvitation': 'content/organizationInvitation.hbs',
    'organizationInvitationAccepted': 'content/organizationInvitationAccepted.hbs',
    'organizationInvitationExpired': 'content/organizationInvitationExpired.hbs',
    // Application lifecycle
    'applicationSuperseded': 'content/applicationSuperseded.hbs',
    // Unit locking
    'unitLocked': 'content/unitLocked.hbs',
    'unitReleased': 'content/unitReleased.hbs',
    // Phase completions
    'questionnairePhaseCompleted': 'content/questionnairePhaseCompleted.hbs',
    'documentationPhaseCompleted': 'content/documentationPhaseCompleted.hbs',
    'paymentPhaseCompleted': 'content/paymentPhaseCompleted.hbs',
    // Offer letter expiry
    'offerLetterExpired': 'content/offerLetterExpired.hbs',
    // Underwriting
    'underwritingApproved': 'content/underwritingApproved.hbs',
    'underwritingRejected': 'content/underwritingRejected.hbs',
    'underwritingConditional': 'content/underwritingConditional.hbs',
    // Bank review
    'bankReviewRequired': 'content/bankReviewRequired.hbs',
    // Stage completion
    'stageCompleted': 'content/stageCompleted.hbs',
    // SLA
    'slaWarning': 'content/slaWarning.hbs',
    'slaBreached': 'content/slaBreached.hbs',
    // Co-Applicant
    'coApplicantInvited': 'content/coApplicantInvited.hbs',
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
    // Organization
    'organizationInvitation': 'You\'ve Been Invited to Join {{organizationName}}',
    'organizationInvitationAccepted': 'Invitation Accepted',
    'organizationInvitationExpired': 'Organization Invitation Expired',
    // Application lifecycle
    'applicationSuperseded': 'Application Superseded',
    // Unit locking
    'unitLocked': 'Unit Has Been Locked',
    'unitReleased': 'Unit Has Been Released',
    // Phase completions
    'questionnairePhaseCompleted': 'Questionnaire Phase Completed',
    'documentationPhaseCompleted': 'Documentation Phase Completed',
    'paymentPhaseCompleted': 'Payment Phase Completed',
    // Offer letter expiry
    'offerLetterExpired': 'Offer Letter Has Expired',
    // Underwriting
    'underwritingApproved': 'Underwriting Approved',
    'underwritingRejected': 'Underwriting Rejected',
    'underwritingConditional': 'Conditional Underwriting Approval',
    // Bank review
    'bankReviewRequired': 'Bank Review Required',
    // Stage completion
    'stageCompleted': 'Review Stage Completed',
    // SLA
    'slaWarning': 'SLA Warning - Action Required',
    'slaBreached': 'SLA Breached - Immediate Action Required',
    // Co-Applicant
    'coApplicantInvited': 'You\'ve Been Invited as a Co-Applicant',
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

/**
 * Types of notifications that can be sent
 * Used by all services to ensure consistent event naming
 */
export enum NotificationType {
    // User lifecycle
    WELCOME = 'welcome',
    VERIFY_EMAIL = 'verifyEmail',
    ACCOUNT_VERIFIED = 'accountVerified',
    ACCOUNT_SUSPENDED = 'accountSuspended',
    PASSWORD_RESET = 'resetPassword',

    // Payments
    MISSED_PAYMENT = 'missedPayments',
    WALLET_TOP_UP = 'walletTopUp',
    PAYMENT_RECEIVED = 'paymentReceived',
    PAYMENT_FAILED = 'paymentFailed',
    PAYMENT_REMINDER = 'paymentReminder',

    // Property
    PROPERTY_ALLOCATION = 'propertyAllocation',

    // Terms
    UPDATED_TERMS = 'updatedTermsAndConditions',

    // Prequalification
    PREQUALIFICATION_SUBMITTED = 'prequalificationSubmitted',
    PREQUALIFICATION_APPROVED = 'prequalificationApproved',
    PREQUALIFICATION_REJECTED = 'prequalificationRejected',

    // Application
    APPLICATION_CREATED = 'applicationCreated',
    APPLICATION_ACTIVATED = 'applicationActivated',
    APPLICATION_TERMINATION_REQUESTED = 'applicationTerminationRequested',
    APPLICATION_TERMINATION_APPROVED = 'applicationTerminationApproved',
    APPLICATION_TERMINATED = 'applicationTerminated',
    APPLICATION_SUPERSEDED = 'applicationSuperseded',

    // Unit Locking
    UNIT_LOCKED = 'unitLocked',
    UNIT_RELEASED = 'unitReleased',

    // Phase Completion
    QUESTIONNAIRE_PHASE_COMPLETED = 'questionnairePhaseCompleted',
    DOCUMENTATION_PHASE_COMPLETED = 'documentationPhaseCompleted',
    PAYMENT_PHASE_COMPLETED = 'paymentPhaseCompleted',

    // Offer Letters
    OFFER_LETTER_SENT = 'offerLetterSent',
    OFFER_LETTER_SIGNED = 'offerLetterSigned',
    OFFER_LETTER_EXPIRED = 'offerLetterExpired',

    // Underwriting
    UNDERWRITING_APPROVED = 'underwritingApproved',
    UNDERWRITING_REJECTED = 'underwritingRejected',
    UNDERWRITING_CONDITIONAL = 'underwritingConditional',

    // Documents
    DOCUMENT_APPROVED = 'documentApproved',
    DOCUMENT_REJECTED = 'documentRejected',

    // Admin
    ADMIN_CONTRIBUTION_RECEIVED = 'adminContributionReceived',
    ADMIN_PROPERTY_ALLOCATION = 'adminPropertyAllocation',
    ADMIN_INVITE = 'adminInviteAdmin',

    // OTP
    OTP = 'otp',
}

/**
 * Channels through which notifications can be delivered
 */
export enum NotificationChannel {
    EMAIL = 'email',
    SMS = 'sms',
    PUSH = 'push',
}

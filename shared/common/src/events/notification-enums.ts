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

    // Contract
    CONTRACT_CREATED = 'contractCreated',
    CONTRACT_ACTIVATED = 'contractActivated',
    CONTRACT_TERMINATION_REQUESTED = 'contractTerminationRequested',
    CONTRACT_TERMINATION_APPROVED = 'contractTerminationApproved',
    CONTRACT_TERMINATED = 'contractTerminated',

    // Offer Letters
    OFFER_LETTER_SENT = 'offerLetterSent',
    OFFER_LETTER_SIGNED = 'offerLetterSigned',
    OFFER_LETTER_EXPIRED = 'offerLetterExpired',

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

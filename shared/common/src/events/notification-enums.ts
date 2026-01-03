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

    // Property
    PROPERTY_ALLOCATION = 'propertyAllocation',

    // Terms
    UPDATED_TERMS = 'updatedTermsAndConditions',

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

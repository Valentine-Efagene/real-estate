/**
 * Comprehensive Mortgage Lifecycle States
 * Following industry standards for mortgage servicing
 */
export enum MortgageState {
    // Application Phase
    DRAFT = 'DRAFT',                           // Initial application being filled
    SUBMITTED = 'SUBMITTED',                   // Application submitted for review

    // Pre-Approval Phase
    PRE_QUALIFICATION = 'PRE_QUALIFICATION',   // Initial assessment
    DOCUMENT_COLLECTION = 'DOCUMENT_COLLECTION', // Gathering required documents

    // Underwriting Phase
    UNDERWRITING = 'UNDERWRITING',             // Full underwriting in progress
    APPRAISAL_ORDERED = 'APPRAISAL_ORDERED',  // Property appraisal ordered
    APPRAISAL_REVIEW = 'APPRAISAL_REVIEW',    // Reviewing appraisal results
    CONDITIONAL_APPROVAL = 'CONDITIONAL_APPROVAL', // Approved with conditions

    // Approval Phase
    APPROVED = 'APPROVED',                     // Fully approved, awaiting closing
    CLOSING_SCHEDULED = 'CLOSING_SCHEDULED',   // Closing date set

    // Downpayment Phase
    AWAITING_DOWNPAYMENT = 'AWAITING_DOWNPAYMENT', // Waiting for down payment
    DOWNPAYMENT_PARTIAL = 'DOWNPAYMENT_PARTIAL',   // Partial down payment received
    DOWNPAYMENT_COMPLETE = 'DOWNPAYMENT_COMPLETE', // Full down payment received

    // Active Phase
    ACTIVE = 'ACTIVE',                         // Mortgage is active and current
    CURRENT = 'CURRENT',                       // All payments up to date (alias for ACTIVE)

    // Delinquency States
    DELINQUENT_30 = 'DELINQUENT_30',          // 30 days past due
    DELINQUENT_60 = 'DELINQUENT_60',          // 60 days past due
    DELINQUENT_90 = 'DELINQUENT_90',          // 90 days past due
    DELINQUENT_120_PLUS = 'DELINQUENT_120_PLUS', // 120+ days past due

    // Default & Loss Mitigation
    DEFAULT = 'DEFAULT',                       // In default
    FORBEARANCE = 'FORBEARANCE',              // Payment forbearance granted
    MODIFICATION = 'MODIFICATION',             // Loan modification in progress
    SHORT_SALE = 'SHORT_SALE',                // Short sale approved

    // Foreclosure Process
    FORECLOSURE_INITIATED = 'FORECLOSURE_INITIATED', // Foreclosure started
    FORECLOSURE_PENDING = 'FORECLOSURE_PENDING',     // Foreclosure in progress
    FORECLOSED = 'FORECLOSED',                       // Property foreclosed
    REO = 'REO',                                     // Real Estate Owned (bank-owned)

    // Completion States
    PAID_OFF = 'PAID_OFF',                    // Fully paid off
    REFINANCED = 'REFINANCED',                // Refinanced to new loan

    // Termination States
    CANCELLED = 'CANCELLED',                  // Application cancelled
    REJECTED = 'REJECTED',                    // Application rejected
    WITHDRAWN = 'WITHDRAWN',                  // Withdrawn by borrower
    SUSPENDED = 'SUSPENDED',                  // Temporarily suspended
}

/**
 * Events that trigger state transitions
 */
export enum MortgageEvent {
    // Application Events
    SUBMIT_APPLICATION = 'SUBMIT_APPLICATION',
    REQUEST_DOCUMENTS = 'REQUEST_DOCUMENTS',
    DOCUMENTS_SUBMITTED = 'DOCUMENTS_SUBMITTED',

    // Underwriting Events
    START_UNDERWRITING = 'START_UNDERWRITING',
    ORDER_APPRAISAL = 'ORDER_APPRAISAL',
    APPRAISAL_COMPLETED = 'APPRAISAL_COMPLETED',
    APPRAISAL_APPROVED = 'APPRAISAL_APPROVED',
    APPRAISAL_REJECTED = 'APPRAISAL_REJECTED',
    REQUEST_CONDITIONS = 'REQUEST_CONDITIONS',
    CONDITIONS_MET = 'CONDITIONS_MET',

    // Approval Events
    APPROVE = 'APPROVE',
    REJECT = 'REJECT',
    SCHEDULE_CLOSING = 'SCHEDULE_CLOSING',

    // Downpayment Events
    REQUEST_DOWNPAYMENT = 'REQUEST_DOWNPAYMENT',
    RECEIVE_PARTIAL_DOWNPAYMENT = 'RECEIVE_PARTIAL_DOWNPAYMENT',
    RECEIVE_FULL_DOWNPAYMENT = 'RECEIVE_FULL_DOWNPAYMENT',

    // Activation Events
    ACTIVATE = 'ACTIVATE',
    DISBURSE_FUNDS = 'DISBURSE_FUNDS',

    // Payment Events
    RECEIVE_PAYMENT = 'RECEIVE_PAYMENT',
    MISS_PAYMENT = 'MISS_PAYMENT',
    MARK_DELINQUENT = 'MARK_DELINQUENT',
    CURE_DELINQUENCY = 'CURE_DELINQUENCY',

    // Default & Mitigation Events
    DECLARE_DEFAULT = 'DECLARE_DEFAULT',
    GRANT_FORBEARANCE = 'GRANT_FORBEARANCE',
    APPROVE_MODIFICATION = 'APPROVE_MODIFICATION',
    APPROVE_SHORT_SALE = 'APPROVE_SHORT_SALE',

    // Foreclosure Events
    INITIATE_FORECLOSURE = 'INITIATE_FORECLOSURE',
    FORECLOSE = 'FORECLOSE',
    CONVERT_TO_REO = 'CONVERT_TO_REO',

    // Completion Events
    PAY_OFF = 'PAY_OFF',
    REFINANCE = 'REFINANCE',

    // Termination Events
    CANCEL = 'CANCEL',
    WITHDRAW = 'WITHDRAW',
    SUSPEND = 'SUSPEND',
    RESUME = 'RESUME',
}

/**
 * Side effects / Actions executed during transitions
 */
export enum MortgageAction {
    // Notification Actions
    NOTIFY_BORROWER = 'NOTIFY_BORROWER',
    NOTIFY_UNDERWRITER = 'NOTIFY_UNDERWRITER',
    NOTIFY_CLOSER = 'NOTIFY_CLOSER',
    NOTIFY_COLLECTIONS = 'NOTIFY_COLLECTIONS',
    NOTIFY_LEGAL = 'NOTIFY_LEGAL',
    SEND_EMAIL = 'SEND_EMAIL',
    SEND_SMS = 'SEND_SMS',

    // Document Actions
    REQUEST_DOCUMENTS = 'REQUEST_DOCUMENTS',
    GENERATE_AGREEMENT = 'GENERATE_AGREEMENT',
    GENERATE_APPROVAL_LETTER = 'GENERATE_APPROVAL_LETTER',
    GENERATE_CLOSING_DISCLOSURE = 'GENERATE_CLOSING_DISCLOSURE',
    GENERATE_CLOSING_DOCS = 'GENERATE_CLOSING_DOCS',
    GENERATE_PROMISSORY_NOTE = 'GENERATE_PROMISSORY_NOTE',
    REQUEST_TITLE_INSURANCE = 'REQUEST_TITLE_INSURANCE',

    // Appraisal & Inspection Actions
    ORDER_APPRAISAL = 'ORDER_APPRAISAL',
    REQUEST_INSPECTION = 'REQUEST_INSPECTION',

    // Credit & Verification Actions
    RUN_CREDIT_CHECK = 'RUN_CREDIT_CHECK',
    VERIFY_INCOME = 'VERIFY_INCOME',
    VERIFY_EMPLOYMENT = 'VERIFY_EMPLOYMENT',
    VERIFY_INSURANCE = 'VERIFY_INSURANCE',

    // Financial Actions
    CALCULATE_PAYMENT_SCHEDULE = 'CALCULATE_PAYMENT_SCHEDULE',
    SETUP_PAYMENT_SCHEDULE = 'SETUP_PAYMENT_SCHEDULE',
    DISBURSE_LOAN_AMOUNT = 'DISBURSE_LOAN_AMOUNT',
    DISBURSE_FUNDS = 'DISBURSE_FUNDS',
    PROCESS_PAYMENT = 'PROCESS_PAYMENT',
    RECORD_PAYMENT = 'RECORD_PAYMENT',
    REFUND_PAYMENT = 'REFUND_PAYMENT',
    ASSESS_LATE_FEE = 'ASSESS_LATE_FEE',
    UPDATE_CREDIT_BUREAU = 'UPDATE_CREDIT_BUREAU',
    FREEZE_ACCOUNT = 'FREEZE_ACCOUNT',

    // Process Actions
    ASSIGN_UNDERWRITER = 'ASSIGN_UNDERWRITER',
    ORDER_TITLE_SEARCH = 'ORDER_TITLE_SEARCH',
    SCHEDULE_INSPECTION = 'SCHEDULE_INSPECTION',
    CREATE_ESCROW_ACCOUNT = 'CREATE_ESCROW_ACCOUNT',
    SETUP_ESCROW = 'SETUP_ESCROW',
    RECORD_LIEN = 'RECORD_LIEN',
    RELEASE_LIEN = 'RELEASE_LIEN',

    // Legal Actions
    INITIATE_FORECLOSURE = 'INITIATE_FORECLOSURE',
    SCHEDULE_AUCTION = 'SCHEDULE_AUCTION',

    // Compliance Actions
    LOG_AUDIT_TRAIL = 'LOG_AUDIT_TRAIL',
    VERIFY_COMPLIANCE = 'VERIFY_COMPLIANCE',
    GENERATE_REGULATORY_REPORT = 'GENERATE_REGULATORY_REPORT',
    REPORT_TO_REGULATOR = 'REPORT_TO_REGULATOR',

    // Analytics Actions
    UPDATE_ANALYTICS = 'UPDATE_ANALYTICS',
}

/**
 * Context data passed through FSM transitions
 */
export interface MortgageFSMContext {
    mortgageId: number;
    borrowerId: number;
    propertyId: number;
    principal: number;
    downPayment: number;
    downPaymentReceived?: number;
    interestRate: number;
    termMonths: number;

    // Timestamps
    submittedAt?: Date;
    approvedAt?: Date;
    activatedAt?: Date;
    paidOffAt?: Date;

    // Payment tracking
    lastPaymentDate?: Date;
    nextPaymentDate?: Date;
    daysPastDue?: number;
    totalPaid?: number;
    remainingBalance?: number;

    // Document tracking
    documentsComplete?: boolean;
    appraisalValue?: number;
    appraisalDate?: Date;

    // Conditions
    conditions?: string[];
    conditionsMet?: boolean;

    // Metadata
    metadata?: Record<string, any>;
    error?: string;
    triggeredBy?: string; // User or system that triggered transition
}

/**
 * Guard conditions for transitions
 */
export interface TransitionGuard {
    name: string;
    check: (context: MortgageFSMContext) => boolean | Promise<boolean>;
    errorMessage?: string;
}

/**
 * Action to execute during transition
 */
export interface TransitionAction {
    name: string;
    execute: (context: MortgageFSMContext) => Promise<void>;
    rollback?: (context: MortgageFSMContext) => Promise<void>;
}

/**
 * Complete state transition definition
 */
export interface StateTransition {
    from: MortgageState | MortgageState[];
    to: MortgageState;
    event: MortgageEvent;
    guards?: TransitionGuard[];
    actions?: TransitionAction[];
    description?: string;
}

/**
 * State change event for audit/event sourcing
 */
export interface MortgageStateChangeEvent {
    mortgageId: number;
    fromState: MortgageState;
    toState: MortgageState;
    event: MortgageEvent;
    context: MortgageFSMContext;
    timestamp: Date;
    triggeredBy: string;
    success: boolean;
    error?: string;
}

export default {
    MortgageState,
    MortgageEvent,
    MortgageAction,
};

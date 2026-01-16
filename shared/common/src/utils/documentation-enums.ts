/**
 * Documentation-related enums for documentation plan steps.
 * Used in DocumentationPlanStep metadata to indicate upload responsibility.
 */

/**
 * Indicates who is responsible for uploading a document in a documentation step.
 */
export const UPLOADED_BY = {
    /** Document is uploaded by the customer/applicant */
    CUSTOMER: 'CUSTOMER',
    /** Document is uploaded by an admin/staff member */
    ADMIN: 'ADMIN',
    /** Document is uploaded by a lender/bank representative */
    LENDER: 'LENDER',
    /** Document is uploaded by the developer */
    DEVELOPER: 'DEVELOPER',
    /** Document is uploaded by the system (auto-generated) */
    SYSTEM: 'SYSTEM',
    /** Document is uploaded by a legal officer */
    LEGAL: 'LEGAL',
} as const;

/**
 * Type representing a valid uploadedBy value.
 */
export type UploadedBy = (typeof UPLOADED_BY)[keyof typeof UPLOADED_BY];

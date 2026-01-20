/**
 * Documentation-related enums for documentation plan steps.
 * Used in DocumentationPlanStep metadata to indicate upload responsibility.
 * 
 * NOTE: The UploadedBy Prisma enum is now the source of truth.
 * This constant object is kept for backward compatibility.
 */

/**
 * Indicates who is responsible for uploading a document in a documentation step.
 * @deprecated Use the UploadedBy Prisma enum instead
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
    /** Document is uploaded by the platform staff */
    PLATFORM: 'PLATFORM',
    /** Document is uploaded by a legal officer */
    LEGAL: 'LEGAL',
    /** Document is uploaded by an insurer */
    INSURER: 'INSURER',
} as const;

/**
 * Type representing a valid uploadedBy value.
 * @deprecated Use the UploadedBy Prisma enum instead
 */
export type UploadedByType = (typeof UPLOADED_BY)[keyof typeof UPLOADED_BY];

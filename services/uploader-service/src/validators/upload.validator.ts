import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// =============================================================================
// FOLDER ENUM
// =============================================================================

export const UploadFolderEnum = z.enum([
    'mortgage_docs',
    'property_docs',
    'property_pictures',
    'profile_pictures',
    'kyc_documents',
    'legal_documents',
    'archives',
]).openapi('UploadFolder');

export type UploadFolder = z.infer<typeof UploadFolderEnum>;

// =============================================================================
// PRESIGNED POST REQUEST (for client-side uploads)
// =============================================================================

export const presignedPostRequestSchema = z.object({
    folder: UploadFolderEnum.openapi({
        description: 'Target folder for the upload',
        example: 'mortgage_docs',
    }),
    fileName: z.string().min(1).openapi({
        description: 'Original file name with extension',
        example: 'bank_statement.pdf',
    }),
    contentType: z.string().optional().openapi({
        description: 'MIME type of the file (auto-detected from fileName if not provided)',
        example: 'application/pdf',
    }),
}).openapi('PresignedPostRequest');

export type PresignedPostRequest = z.infer<typeof presignedPostRequestSchema>;

export const presignedPostResponseSchema = z.object({
    url: z.string().url().openapi({
        description: 'S3 presigned POST URL',
        example: 'https://bucket.s3.amazonaws.com',
    }),
    fields: z.record(z.string(), z.string()).openapi({
        description: 'Form fields to include with the upload',
    }),
    key: z.string().openapi({
        description: 'The S3 object key that will be created',
        example: 'mortgage_docs/abc123-20240101T120000000Z.pdf',
    }),
    expiresIn: z.number().openapi({
        description: 'Time in seconds until the presigned URL expires',
        example: 3600,
    }),
}).openapi('PresignedPostResponse');

export type PresignedPostResponse = z.infer<typeof presignedPostResponseSchema>;

// =============================================================================
// PRESIGNED URL REQUEST (for downloads)
// =============================================================================

export const presignedUrlRequestSchema = z.object({
    url: z.string().min(1).openapi({
        description: 'S3 object URL or key to generate presigned URL for',
        example: 'https://bucket.s3.amazonaws.com/mortgage_docs/abc123.pdf',
    }),
}).openapi('PresignedUrlRequest');

export type PresignedUrlRequest = z.infer<typeof presignedUrlRequestSchema>;

export const presignedUrlResponseSchema = z.object({
    presignedUrl: z.string().url().openapi({
        description: 'Presigned URL for downloading the file',
    }),
    expiresIn: z.number().openapi({
        description: 'Time in seconds until the presigned URL expires',
        example: 3600,
    }),
}).openapi('PresignedUrlResponse');

export type PresignedUrlResponse = z.infer<typeof presignedUrlResponseSchema>;

// =============================================================================
// DELETE REQUEST
// =============================================================================

export const deleteRequestSchema = z.object({
    url: z.string().min(1).openapi({
        description: 'S3 object URL or key to delete',
        example: 'https://bucket.s3.amazonaws.com/mortgage_docs/abc123.pdf',
    }),
}).openapi('DeleteRequest');

export type DeleteRequest = z.infer<typeof deleteRequestSchema>;

// =============================================================================
// BUNDLE REQUEST (zip multiple files)
// =============================================================================

export const bundleRequestSchema = z.object({
    archiveKey: z.string().min(1).openapi({
        description: 'Key/name for the resulting archive (without extension)',
        example: 'archives/application-12345-documents',
    }),
    objectUrls: z.array(z.string().url()).min(1).openapi({
        description: 'Array of S3 object URLs to bundle into archive',
        example: [
            'https://bucket.s3.amazonaws.com/mortgage_docs/doc1.pdf',
            'https://bucket.s3.amazonaws.com/mortgage_docs/doc2.pdf',
        ],
    }),
}).openapi('BundleRequest');

export type BundleRequest = z.infer<typeof bundleRequestSchema>;

export const bundleResponseSchema = z.object({
    presignedUrl: z.string().url().openapi({
        description: 'Presigned URL to download the generated archive',
    }),
    key: z.string().openapi({
        description: 'S3 key of the created archive',
        example: 'archives/application-12345-documents.zip',
    }),
    expiresIn: z.number().openapi({
        description: 'Time in seconds until the presigned URL expires',
        example: 3600,
    }),
}).openapi('BundleResponse');

export type BundleResponse = z.infer<typeof bundleResponseSchema>;

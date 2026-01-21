import {
    OpenAPIRegistry,
    OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import {
    presignedPostRequestSchema,
    presignedPostResponseSchema,
    presignedUrlRequestSchema,
    presignedUrlResponseSchema,
    deleteRequestSchema,
    bundleRequestSchema,
    bundleResponseSchema,
    UploadFolderEnum,
} from '../validators/upload.validator';

const registry = new OpenAPIRegistry();

// Register schemas
registry.register('UploadFolder', UploadFolderEnum);
registry.register('PresignedPostRequest', presignedPostRequestSchema);
registry.register('PresignedPostResponse', presignedPostResponseSchema);
registry.register('PresignedUrlRequest', presignedUrlRequestSchema);
registry.register('PresignedUrlResponse', presignedUrlResponseSchema);
registry.register('DeleteRequest', deleteRequestSchema);
registry.register('BundleRequest', bundleRequestSchema);
registry.register('BundleResponse', bundleResponseSchema);

// Register paths
registry.registerPath({
    method: 'post',
    path: '/upload/presigned-post',
    tags: ['Upload'],
    summary: 'Generate presigned POST URL for file upload',
    description: 'Returns a presigned POST URL and form fields for direct client-side upload to S3',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: presignedPostRequestSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Presigned POST URL generated successfully',
            content: {
                'application/json': {
                    schema: presignedPostResponseSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/upload/presigned-url',
    tags: ['Upload'],
    summary: 'Generate presigned URL for file download',
    description: 'Returns a presigned GET URL for downloading a file from S3',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: presignedUrlRequestSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Presigned URL generated successfully',
            content: {
                'application/json': {
                    schema: presignedUrlResponseSchema,
                },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/upload',
    tags: ['Upload'],
    summary: 'Delete a file from S3',
    description: 'Deletes a file from S3 by URL or key',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: deleteRequestSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'File deleted successfully',
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/upload/bundle',
    tags: ['Upload'],
    summary: 'Bundle multiple files into ZIP archive',
    description: 'Fetches multiple files from S3, bundles them into a ZIP archive, and returns a presigned URL to download',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: bundleRequestSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Bundle created successfully',
            content: {
                'application/json': {
                    schema: bundleResponseSchema,
                },
            },
        },
    },
});

export function generateOpenAPIDocument() {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            title: 'Uploader Service API',
            version: '1.0.0',
            description: 'Service for generating presigned S3 URLs and managing file uploads',
        },
        servers: [{ url: '/' }],
    });
}

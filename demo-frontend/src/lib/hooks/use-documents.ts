import { useMutation } from '@tanstack/react-query';
import { uploaderApi } from '@/lib/api/client';

// Upload folder types supported by the backend
export type UploadFolder =
  | 'mortgage_docs'
  | 'property_docs'
  | 'property_pictures'
  | 'profile_pictures'
  | 'kyc_documents'
  | 'legal_documents'
  | 'archives';

// Response from the presigned-post endpoint
export interface PresignedPostResponse {
  url: string;
  fields: Record<string, string>;
  key: string;
  expiresIn: number;
}

// Response from the presigned-url (GET) endpoint
export interface PresignedGetUrlResponse {
  presignedUrl: string;
  expiresIn: number;
}

// Legacy interface for backward compatibility
export interface PresignedUrlResponse {
  uploadUrl: string;
  downloadUrl: string;
  key: string;
  expiresIn: number;
}

export interface UploadDocumentInput {
  applicationId: string;
  phaseId: string;
  documentTypeId: string;
  fileName: string;
  contentType: string;
}

/**
 * Get presigned POST URL for file upload to S3
 * Uses the uploader-service's /upload/presigned-post endpoint
 */
export function useGetPresignedUrl() {
  return useMutation({
    mutationFn: async ({
      fileName,
      contentType,
      folder,
    }: {
      fileName: string;
      contentType?: string;
      folder?: UploadFolder;
    }): Promise<PresignedPostResponse> => {
      const response = await uploaderApi.post<PresignedPostResponse>('/upload/presigned-post', {
        fileName,
        contentType,
        folder: folder || 'property_pictures',
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get presigned URL');
      }
      return response.data!;
    },
  });
}

/**
 * Get presigned GET URL for viewing/downloading a file from S3
 * Uses the uploader-service's /upload/presigned-url endpoint
 */
export async function getPresignedGetUrl(keyOrUrl: string): Promise<string> {
  const response = await uploaderApi.post<PresignedGetUrlResponse>('/upload/presigned-url', {
    url: keyOrUrl,
  });
  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to get presigned URL');
  }
  return response.data!.presignedUrl;
}

/**
 * Upload file directly to S3 using presigned POST
 * This uses form data with the fields from the presigned POST response
 * Returns the S3 key (not a direct URL, since bucket is private)
 */
export async function uploadToS3WithPresignedPost(
  presignedPost: PresignedPostResponse,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Return the S3 key - caller must use getPresignedGetUrl to get viewable URL
        resolve(presignedPost.key);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    // Build form data with presigned fields + file
    const formData = new FormData();
    Object.entries(presignedPost.fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', file);

    xhr.open('POST', presignedPost.url);
    xhr.send(formData);
  });
}

/**
 * Legacy upload function for backwards compatibility
 * @deprecated Use uploadToS3WithPresignedPost instead
 */
export async function uploadToS3(
  presignedUrl: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/**
 * Combined hook for document upload flow
 * 1. Get presigned POST URL
 * 2. Upload to S3 using form data
 * 3. Get presigned GET URL for viewing
 * 4. Return the S3 key and presigned download URL
 */
export function useDocumentUpload() {
  const getPresignedUrl = useGetPresignedUrl();

  return useMutation({
    mutationFn: async ({
      file,
      folder,
      onProgress,
    }: {
      file: File;
      folder?: UploadFolder;
      onProgress?: (progress: number) => void;
    }) => {
      // Step 1: Get presigned POST data
      const presignedData = await getPresignedUrl.mutateAsync({
        fileName: file.name,
        contentType: file.type,
        folder,
      });

      // Step 2: Upload to S3 using presigned POST (returns key)
      const key = await uploadToS3WithPresignedPost(presignedData, file, onProgress);

      // Step 3: Get presigned GET URL for viewing
      const downloadUrl = await getPresignedGetUrl(key);

      // Return the S3 key and presigned download URL for further processing
      return {
        key,
        downloadUrl,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      };
    },
  });
}

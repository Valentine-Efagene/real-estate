import { useMutation } from '@tanstack/react-query';
import { uploaderApi } from '@/lib/api/client';

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
 * Get presigned URL for document upload
 */
export function useGetPresignedUrl() {
  return useMutation({
    mutationFn: async ({
      fileName,
      contentType,
      folder,
    }: {
      fileName: string;
      contentType: string;
      folder?: string;
    }) => {
      const response = await uploaderApi.post<PresignedUrlResponse>('/presigned-url', {
        fileName,
        contentType,
        folder: folder || 'documents',
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to get presigned URL');
      }
      return response.data!;
    },
  });
}

/**
 * Upload file directly to S3 using presigned URL
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
 * 1. Get presigned URL
 * 2. Upload to S3
 * 3. Optionally notify backend of upload completion
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
      folder?: string;
      onProgress?: (progress: number) => void;
    }) => {
      // Step 1: Get presigned URL
      const presignedData = await getPresignedUrl.mutateAsync({
        fileName: file.name,
        contentType: file.type,
        folder,
      });

      // Step 2: Upload to S3
      await uploadToS3(presignedData.uploadUrl, file, onProgress);

      // Return the S3 key and download URL for further processing
      return {
        key: presignedData.key,
        downloadUrl: presignedData.downloadUrl,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      };
    },
  });
}

'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useDocumentUpload } from '@/lib/hooks';
import type { RequiredDocument } from '@/lib/hooks/use-applications';

interface DocumentUploadSectionProps {
  applicationId: string;
  phaseId: string;
  requiredDocuments: RequiredDocument[];
}

interface UploadingFile {
  documentId: string;
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
}

export function DocumentUploadSection({
  applicationId,
  phaseId,
  requiredDocuments,
}: DocumentUploadSectionProps) {
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, UploadingFile>>({});
  const uploadDocument = useDocumentUpload();

  const handleFileSelect = useCallback(
    async (documentId: string, file: File) => {
      setUploadingFiles((prev) => ({
        ...prev,
        [documentId]: { documentId, file, progress: 0, status: 'uploading' },
      }));

      try {
        await uploadDocument.mutateAsync({
          file,
          folder: 'mortgage_docs',
          onProgress: (progress) => {
            setUploadingFiles((prev) => ({
              ...prev,
              [documentId]: { ...prev[documentId], progress },
            }));
          },
        });

        setUploadingFiles((prev) => ({
          ...prev,
          [documentId]: { ...prev[documentId], status: 'completed', progress: 100 },
        }));

        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        setUploadingFiles((prev) => ({
          ...prev,
          [documentId]: { ...prev[documentId], status: 'error' },
        }));
        toast.error(
          error instanceof Error ? error.message : 'Upload failed'
        );
      }
    },
    [applicationId, phaseId, uploadDocument]
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'UPLOADED':
        return <Badge className="bg-blue-500">Uploaded</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="font-semibold">Required Documents:</h4>
      <div className="grid gap-4">
        {requiredDocuments.map((doc) => {
          const uploadingFile = uploadingFiles[doc.id];
          const isUploading = uploadingFile?.status === 'uploading';
          const isCompleted =
            uploadingFile?.status === 'completed' || doc.status === 'UPLOADED' || doc.status === 'APPROVED';

          return (
            <Card key={doc.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{doc.name}</span>
                      {getStatusBadge(doc.status)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{doc.description}</p>

                    {/* Progress bar during upload */}
                    {isUploading && (
                      <div className="mt-2">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${uploadingFile.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Uploading... {uploadingFile.progress}%
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    {isCompleted ? (
                      <span className="text-green-600 text-xl">✓</span>
                    ) : (
                      <Label htmlFor={`file-${doc.id}`} className="cursor-pointer">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isUploading}
                          asChild
                        >
                          <span>
                            {isUploading ? 'Uploading...' : 'Upload'}
                          </span>
                        </Button>
                        <Input
                          id={`file-${doc.id}`}
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          disabled={isUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileSelect(doc.id, file);
                            }
                          }}
                        />
                      </Label>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

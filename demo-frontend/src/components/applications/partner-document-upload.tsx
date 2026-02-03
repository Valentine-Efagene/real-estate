'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useUploadPhaseDocument } from '@/lib/hooks/use-applications';
import { useGetPresignedUrl, uploadToS3WithPresignedPost, type UploadFolder } from '@/lib/hooks/use-documents';

interface PartnerDocumentUploadProps {
    applicationId: string;
    phaseId: string;
    phaseName: string;
    role: 'DEVELOPER' | 'LENDER' | 'PLATFORM';
    onUploadSuccess?: () => void;
}

// Document types by role
const DOCUMENT_TYPES_BY_ROLE = {
    DEVELOPER: [
        { value: 'SALES_OFFER_LETTER', label: 'Sales Offer Letter' },
        { value: 'ALLOCATION_LETTER', label: 'Allocation Letter' },
        { value: 'BUILDING_PLAN', label: 'Building Plan' },
        { value: 'PROPERTY_TITLE', label: 'Property Title' },
    ],
    LENDER: [
        { value: 'PREAPPROVAL_LETTER', label: 'Preapproval Letter' },
        { value: 'MORTGAGE_OFFER_LETTER', label: 'Mortgage Offer Letter' },
        { value: 'LOAN_AGREEMENT', label: 'Loan Agreement' },
        { value: 'DISBURSEMENT_NOTICE', label: 'Disbursement Notice' },
    ],
    PLATFORM: [
        { value: 'ACKNOWLEDGMENT', label: 'Acknowledgment' },
        { value: 'VERIFICATION_REPORT', label: 'Verification Report' },
        { value: 'OTHER', label: 'Other Document' },
    ],
};

export function PartnerDocumentUpload({
    applicationId,
    phaseId,
    phaseName,
    role,
    onUploadSuccess,
}: PartnerDocumentUploadProps) {
    const uploadPhaseDocument = useUploadPhaseDocument();
    const getPresignedUrl = useGetPresignedUrl();

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const documentTypes = DOCUMENT_TYPES_BY_ROLE[role] || DOCUMENT_TYPES_BY_ROLE.PLATFORM;

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    }, []);

    const handleUpload = useCallback(async () => {
        if (!selectedFile || !documentType) {
            toast.error('Please select a file and document type');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Step 1: Get presigned URL
            const presignedData = await getPresignedUrl.mutateAsync({
                fileName: selectedFile.name,
                contentType: selectedFile.type,
                folder: 'mortgage_docs' as UploadFolder,
            });

            // Step 2: Upload to S3
            const s3Key = await uploadToS3WithPresignedPost(presignedData, selectedFile, (progress) => {
                setUploadProgress(progress);
            });

            // Step 3: Record document in the application phase
            // For demo, we'll use the S3 key as URL (in production, this would be resolved via presigned get URL)
            await uploadPhaseDocument.mutateAsync({
                applicationId,
                phaseId,
                documentType,
                url: `s3://qshelter-uploads/${s3Key}`,
                fileName: selectedFile.name,
            });

            toast.success('Document uploaded successfully');
            setSelectedFile(null);
            setDocumentType('');
            setUploadProgress(0);
            onUploadSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    }, [selectedFile, documentType, applicationId, phaseId, getPresignedUrl, uploadPhaseDocument, onUploadSuccess]);

    const roleLabel = {
        DEVELOPER: 'Developer',
        LENDER: 'Lender / Bank',
        PLATFORM: 'Platform Admin',
    }[role];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Upload Document ({roleLabel})</CardTitle>
                <CardDescription>
                    Upload a document for the {phaseName} phase
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Document Type</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
                            {documentTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="file">File</Label>
                    <Input
                        id="file"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={handleFileSelect}
                        disabled={isUploading}
                    />
                    {selectedFile && (
                        <p className="text-sm text-gray-500">
                            Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </p>
                    )}
                </div>

                {isUploading && (
                    <div className="space-y-1">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <p className="text-sm text-gray-500">Uploading... {uploadProgress}%</p>
                    </div>
                )}

                <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || !documentType || isUploading}
                    className="w-full"
                >
                    {isUploading ? 'Uploading...' : 'Upload Document'}
                </Button>
            </CardContent>
        </Card>
    );
}

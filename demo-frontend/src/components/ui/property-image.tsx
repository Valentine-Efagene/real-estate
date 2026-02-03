'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { getPresignedGetUrl } from '@/lib/hooks/use-documents';

interface PropertyImageProps {
    src: string | null | undefined;
    alt: string;
    fill?: boolean;
    width?: number;
    height?: number;
    className?: string;
    fallback?: React.ReactNode;
}

/**
 * Property image component that handles S3 presigned URLs
 * Fetches a presigned URL if the src is an S3 URL
 */
export function PropertyImage({
    src,
    alt,
    fill,
    width,
    height,
    className,
    fallback,
}: PropertyImageProps) {
    const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) {
            setPresignedUrl(null);
            return;
        }

        // Check if it's an S3 URL that needs a presigned URL
        const isS3Url = src.includes('s3.') || src.includes('amazonaws.com');

        if (!isS3Url) {
            // Direct URL, use as-is
            setPresignedUrl(src);
            return;
        }

        // Fetch presigned URL for S3 objects
        setIsLoading(true);
        setError(false);

        getPresignedGetUrl(src)
            .then((url) => {
                setPresignedUrl(url);
            })
            .catch((err) => {
                console.error('Failed to get presigned URL:', err);
                setError(true);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [src]);

    // Show fallback if no src or error
    if (!src || error) {
        return (
            <>
                {fallback || (
                    <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
                        <span className="text-4xl">🏠</span>
                    </div>
                )}
            </>
        );
    }

    // Show loading state
    if (isLoading || !presignedUrl) {
        return <Skeleton className={className} />;
    }

    // Render the image with presigned URL
    if (fill) {
        return (
            <Image
                src={presignedUrl}
                alt={alt}
                fill
                className={className}
                onError={() => setError(true)}
            />
        );
    }

    return (
        <Image
            src={presignedUrl}
            alt={alt}
            width={width || 400}
            height={height || 300}
            className={className}
            onError={() => setError(true)}
        />
    );
}

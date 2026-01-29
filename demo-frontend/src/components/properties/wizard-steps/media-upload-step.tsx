'use client';

import { useState, useRef, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload,
  X,
  Image as ImageIcon,
  Video,
  FileText,
  Box,
  ChevronRight,
  ChevronLeft,
  Star,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGetPresignedUrl, uploadToS3WithPresignedPost, getPresignedGetUrl } from '@/lib/hooks/use-documents';
import type { MediaFile } from './types';

interface MediaUploadStepProps {
  media: MediaFile[];
  displayImageKey?: string;
  onChange: (media: MediaFile[]) => void;
  onDisplayImageChange: (key?: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const MEDIA_TYPE_ICONS = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  FLOOR_PLAN: FileText,
  '3D_TOUR': Box,
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function MediaUploadStep({
  media,
  displayImageKey,
  onChange,
  onDisplayImageChange,
  onNext,
  onBack,
}: MediaUploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaFile[]>(media);
  const getPresignedUrl = useGetPresignedUrl();

  // Keep ref in sync with prop
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  const updateMediaItem = (id: string, updates: Partial<MediaFile>) => {
    const updated = mediaRef.current.map((m) =>
      m.id === id ? { ...m, ...updates } : m
    );
    mediaRef.current = updated;
    onChange(updated);
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);

    // Validate files
    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is too large. Maximum size is 20MB.`);
        return;
      }

      const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
      const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

      if (!isImage && !isVideo) {
        toast.error(`${file.name} has an unsupported file type.`);
        return;
      }
    }

    // Add files to media array with uploading status
    const newMedia: MediaFile[] = newFiles.map((file, idx) => ({
      id: `${Date.now()}-${idx}`,
      file,
      type: ALLOWED_IMAGE_TYPES.includes(file.type) ? 'IMAGE' : 'VIDEO',
      order: media.length + idx,
      isUploading: true,
      uploadProgress: 0,
    }));

    const allMedia = [...media, ...newMedia];
    mediaRef.current = allMedia;
    onChange(allMedia);

    // Upload each file
    for (let i = 0; i < newMedia.length; i++) {
      const mediaItem = newMedia[i];
      const file = mediaItem.file!;

      try {
        // Get presigned POST data
        const presignedData = await getPresignedUrl.mutateAsync({
          fileName: file.name,
          contentType: file.type,
          folder: 'property_pictures',
        });

        // Upload to S3 with progress tracking using presigned POST (returns key)
        const key = await uploadToS3WithPresignedPost(presignedData, file, (progress) => {
          updateMediaItem(mediaItem.id, { uploadProgress: progress });
        });

        // Get presigned GET URL for viewing
        const downloadUrl = await getPresignedGetUrl(key);

        // Mark as uploaded
        updateMediaItem(mediaItem.id, {
          isUploading: false,
          key,
          downloadUrl,
          uploadProgress: 100,
        });

        // Set first image as display image if none set
        if (!displayImageKey && mediaItem.type === 'IMAGE') {
          onDisplayImageChange(key);
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
        updateMediaItem(mediaItem.id, {
          isUploading: false,
          error: 'Upload failed',
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeMedia = (id: string) => {
    const item = media.find((m) => m.id === id);
    if (item?.key === displayImageKey) {
      // Find next image to set as display
      const nextImage = media.find((m) => m.type === 'IMAGE' && m.id !== id);
      onDisplayImageChange(nextImage?.key);
    }
    onChange(media.filter((m) => m.id !== id));
  };

  const updateMediaType = (id: string, type: MediaFile['type']) => {
    onChange(media.map((m) => (m.id === id ? { ...m, type } : m)));
  };

  const updateCaption = (id: string, caption: string) => {
    onChange(media.map((m) => (m.id === id ? { ...m, caption } : m)));
  };

  const setAsDisplayImage = (key: string) => {
    onDisplayImageChange(key);
  };

  const reorderMedia = (fromIndex: number, toIndex: number) => {
    const newMedia = [...media];
    const [moved] = newMedia.splice(fromIndex, 1);
    newMedia.splice(toIndex, 0, moved);
    onChange(newMedia.map((m, idx) => ({ ...m, order: idx })));
  };

  const hasImages = media.some((m) => m.type === 'IMAGE');
  const isUploading = media.some((m) => m.isUploading);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <CardTitle>Property Media</CardTitle>
          </div>
          <CardDescription>
            Upload photos, videos, floor plans, and 3D tours. First image will be the display image.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              Images (JPEG, PNG, WebP) or Videos (MP4, MOV) up to 20MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(',')}
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Media Grid */}
          {media.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {media.map((item) => {
                const Icon = MEDIA_TYPE_ICONS[item.type];
                const isDisplay = item.key === displayImageKey;

                return (
                  <div key={item.id} className="relative group">
                    <Card className={isDisplay ? 'ring-2 ring-primary' : ''}>
                      <CardContent className="p-3">
                        <div className="aspect-video bg-muted rounded flex items-center justify-center mb-2 relative overflow-hidden">
                          {item.downloadUrl && item.type === 'IMAGE' ? (
                            <img
                              src={item.downloadUrl}
                              alt={item.caption || 'Property media'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Icon className="h-8 w-8 text-muted-foreground" />
                          )}

                          {item.isUploading && (
                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                              <div className="w-full px-4">
                                <Progress value={item.uploadProgress} />
                                <p className="text-xs text-center mt-1">
                                  {item.uploadProgress}%
                                </p>
                              </div>
                            </div>
                          )}

                          {isDisplay && (
                            <Badge className="absolute top-2 left-2">
                              <Star className="h-3 w-3 mr-1" />
                              Display
                            </Badge>
                          )}
                        </div>

                        <Select
                          value={item.type}
                          onValueChange={(value) => updateMediaType(item.id, value as MediaFile['type'])}
                          disabled={item.isUploading}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IMAGE">Image</SelectItem>
                            <SelectItem value="VIDEO">Video</SelectItem>
                            <SelectItem value="FLOOR_PLAN">Floor Plan</SelectItem>
                            <SelectItem value="3D_TOUR">3D Tour</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          placeholder="Caption (optional)"
                          value={item.caption || ''}
                          onChange={(e) => updateCaption(item.id, e.target.value)}
                          disabled={item.isUploading}
                          className="h-8 text-xs mt-2"
                        />

                        {item.type === 'IMAGE' && !isDisplay && item.key && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAsDisplayImage(item.key!)}
                            disabled={item.isUploading}
                            className="w-full mt-2 h-8 text-xs"
                          >
                            <Star className="h-3 w-3 mr-1" />
                            Set as Display
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeMedia(item.id)}
                          disabled={item.isUploading}
                          className="w-full mt-2 h-8 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}

          {!hasImages && media.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                ⚠️ You should upload at least one image to use as the display image
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={isUploading || !hasImages}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              Continue to Variants
              <ChevronRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Save, Upload, Trash2, Image as ImageIcon, Star } from 'lucide-react';
import { useProperty, useUpdateProperty, Property } from '@/lib/hooks/use-properties';
import { propertyApi, uploaderApi } from '@/lib/api/client';
import { ProtectedRoute } from '@/components/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPresignedGetUrl } from '@/lib/hooks/use-documents';

interface PropertyMedia {
    id: string;
    url: string;
    type: string;
    caption?: string;
    order: number;
}

function EditPropertyPage() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.id as string;
    const queryClient = useQueryClient();

    const { data: property, isLoading, error } = useProperty(propertyId);
    const updateProperty = useUpdateProperty();

    // Fetch existing media
    const { data: existingMedia, refetch: refetchMedia } = useQuery({
        queryKey: ['property-media', propertyId],
        queryFn: async () => {
            const response = await propertyApi.get<PropertyMedia[]>(`/property/property-media/${propertyId}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch media');
            }
            return response.data || [];
        },
        enabled: !!propertyId,
    });

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'SALE',
        propertyType: 'APARTMENT',
        country: 'Nigeria',
        currency: 'NGN',
        city: '',
        district: '',
        zipCode: '',
        streetAddress: '',
        displayImageId: '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [presignedUrls, setPresignedUrls] = useState<Record<string, string>>({});

    // Fetch presigned URLs for media display
    useEffect(() => {
        const fetchPresignedUrls = async () => {
            if (!existingMedia || existingMedia.length === 0) return;
            
            const urls: Record<string, string> = {};
            await Promise.all(
                existingMedia.map(async (media) => {
                    try {
                        const presignedUrl = await getPresignedGetUrl(media.url);
                        urls[media.id] = presignedUrl;
                    } catch (err) {
                        console.error(`Failed to get presigned URL for media ${media.id}:`, err);
                    }
                })
            );
            setPresignedUrls(urls);
        };
        
        fetchPresignedUrls();
    }, [existingMedia]);

    // Initialize form data when property loads
    useEffect(() => {
        if (property) {
            setFormData({
                title: property.title || '',
                description: property.description || '',
                category: property.category || 'SALE',
                propertyType: property.propertyType || 'APARTMENT',
                country: property.country || 'Nigeria',
                currency: property.currency || 'NGN',
                city: property.city || '',
                district: property.district || '',
                zipCode: property.zipCode || '',
                streetAddress: property.streetAddress || '',
                displayImageId: property.displayImageId || '',
            });
        }
    }, [property]);

    const handleSaveDetails = async () => {
        setIsSaving(true);
        try {
            await updateProperty.mutateAsync({ id: propertyId, data: formData });
            toast.success('Property updated successfully');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update property');
        } finally {
            setIsSaving(false);
        }
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length) return;

        setIsUploadingMedia(true);
        const uploadedMedia: Array<{ url: string; type: string; order: number }> = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileId = `${file.name}-${Date.now()}`;
                setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

                // Get presigned POST URL
                const presignedResponse = await uploaderApi.post<{
                    url: string;
                    fields: Record<string, string>;
                    key: string;
                    expiresIn: number;
                }>('/upload/presigned-post', {
                    fileName: file.name,
                    contentType: file.type,
                    folder: 'property_pictures',
                });

                if (!presignedResponse.success || !presignedResponse.data) {
                    throw new Error('Failed to get upload URL');
                }

                const { url, fields, key } = presignedResponse.data;

                // Upload to S3 using FormData POST
                const formData = new FormData();
                Object.entries(fields).forEach(([fieldKey, value]) => {
                    formData.append(fieldKey, value);
                });
                formData.append('file', file);

                const uploadResponse = await fetch(url, {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Failed to upload ${file.name}`);
                }

                setUploadProgress((prev) => ({ ...prev, [fileId]: 100 }));

                // Construct the S3 URL from the bucket URL and key
                const s3Url = `${url}${key}`;

                uploadedMedia.push({
                    url: s3Url,
                    type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
                    order: (existingMedia?.length || 0) + i,
                });
            }

            // Send media to backend
            if (uploadedMedia.length > 0) {
                const response = await propertyApi.post(`/property/properties/${propertyId}/media`, {
                    media: uploadedMedia,
                });

                if (!response.success) {
                    throw new Error(response.error?.message || 'Failed to save media');
                }

                await refetchMedia();
                toast.success(`${uploadedMedia.length} file(s) uploaded successfully`);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to upload media');
        } finally {
            setIsUploadingMedia(false);
            setUploadProgress({});
            // Reset file input
            e.target.value = '';
        }
    };

    const handleDeleteMedia = async (mediaId: string) => {
        if (!confirm('Are you sure you want to delete this media?')) return;

        try {
            const response = await propertyApi.delete(`/property/property-media/${mediaId}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to delete media');
            }
            await refetchMedia();
            toast.success('Media deleted successfully');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete media');
        }
    };

    const handleSetDisplayImage = async (mediaId: string) => {
        try {
            await updateProperty.mutateAsync({
                id: propertyId,
                data: { displayImageId: mediaId },
            });
            setFormData((prev) => ({ ...prev, displayImageId: mediaId }));
            toast.success('Display image updated');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to set display image');
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    if (error || !property) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="text-red-700">Error Loading Property</CardTitle>
                        <CardDescription className="text-red-600">
                            {error instanceof Error ? error.message : 'Property not found'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" onClick={() => router.push('/admin/properties')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Properties
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/admin/properties')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Edit Property</h1>
                        <p className="text-muted-foreground">{property.title}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="details" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">Property Details</TabsTrigger>
                    <TabsTrigger value="media">Media & Images</TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details">
                    <Card>
                        <CardHeader>
                            <CardTitle>Property Information</CardTitle>
                            <CardDescription>Update the basic property details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4">
                                <div>
                                    <Label htmlFor="title">Property Title *</Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g., Lekki Gardens Estate"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Describe the property..."
                                        rows={4}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="category">Category</Label>
                                        <Select
                                            value={formData.category}
                                            onValueChange={(v) => setFormData({ ...formData, category: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SALE">For Sale</SelectItem>
                                                <SelectItem value="RENT">For Rent</SelectItem>
                                                <SelectItem value="LEASE">For Lease</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="propertyType">Property Type</Label>
                                        <Select
                                            value={formData.propertyType}
                                            onValueChange={(v) => setFormData({ ...formData, propertyType: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="APARTMENT">Apartment</SelectItem>
                                                <SelectItem value="HOUSE">House</SelectItem>
                                                <SelectItem value="LAND">Land</SelectItem>
                                                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="city">City *</Label>
                                        <Input
                                            id="city"
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                            placeholder="e.g., Lagos"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="district">District/Area</Label>
                                        <Input
                                            id="district"
                                            value={formData.district}
                                            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                            placeholder="e.g., Lekki Phase 1"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="streetAddress">Street Address</Label>
                                    <Input
                                        id="streetAddress"
                                        value={formData.streetAddress}
                                        onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                                        placeholder="Full street address"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t">
                                <Button onClick={handleSaveDetails} disabled={isSaving}>
                                    <Save className="h-4 w-4 mr-2" />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Media Tab */}
                <TabsContent value="media">
                    <Card>
                        <CardHeader>
                            <CardTitle>Property Media</CardTitle>
                            <CardDescription>
                                Upload photos and videos. Click the star to set as display image.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Upload Section */}
                            <div className="border-2 border-dashed rounded-lg p-8 text-center">
                                <input
                                    type="file"
                                    id="media-upload"
                                    multiple
                                    accept="image/*,video/*"
                                    onChange={handleMediaUpload}
                                    className="hidden"
                                    disabled={isUploadingMedia}
                                />
                                <label
                                    htmlFor="media-upload"
                                    className="cursor-pointer flex flex-col items-center gap-2"
                                >
                                    <Upload className="h-10 w-10 text-muted-foreground" />
                                    <p className="font-medium">
                                        {isUploadingMedia ? 'Uploading...' : 'Click to upload media'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Images and videos (max 10MB each)
                                    </p>
                                </label>
                            </div>

                            {/* Upload Progress */}
                            {Object.keys(uploadProgress).length > 0 && (
                                <div className="space-y-2">
                                    {Object.entries(uploadProgress).map(([fileId, progress]) => (
                                        <div key={fileId} className="flex items-center gap-2">
                                            <div className="flex-1 bg-muted rounded-full h-2">
                                                <div
                                                    className="bg-primary h-2 rounded-full transition-all"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-muted-foreground">{progress}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Media Gallery */}
                            {existingMedia && existingMedia.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {existingMedia.map((media) => {
                                        const displayUrl = presignedUrls[media.id] || '';
                                        return (
                                        <div
                                            key={media.id}
                                            className={`relative group rounded-lg overflow-hidden border-2 ${
                                                formData.displayImageId === media.id
                                                    ? 'border-primary ring-2 ring-primary/20'
                                                    : 'border-transparent'
                                            }`}
                                        >
                                            {!displayUrl ? (
                                                <div className="w-full h-32 bg-muted flex items-center justify-center">
                                                    <span className="text-xs text-muted-foreground">Loading...</span>
                                                </div>
                                            ) : media.type === 'VIDEO' ? (
                                                <video
                                                    src={displayUrl}
                                                    className="w-full h-32 object-cover"
                                                    muted
                                                />
                                            ) : (
                                                <img
                                                    src={displayUrl}
                                                    alt="Property media"
                                                    className="w-full h-32 object-cover"
                                                />
                                            )}

                                            {/* Overlay controls */}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="secondary"
                                                    className="h-8 w-8"
                                                    onClick={() => handleSetDisplayImage(media.id)}
                                                    title="Set as display image"
                                                >
                                                    <Star
                                                        className={`h-4 w-4 ${
                                                            formData.displayImageId === media.id
                                                                ? 'fill-yellow-400 text-yellow-400'
                                                                : ''
                                                        }`}
                                                    />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="destructive"
                                                    className="h-8 w-8"
                                                    onClick={() => handleDeleteMedia(media.id)}
                                                    title="Delete media"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {/* Display image badge */}
                                            {formData.displayImageId === media.id && (
                                                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                                                    Display Image
                                                </div>
                                            )}
                                        </div>
                                    );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>No media uploaded yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function EditPropertyPageWrapper() {
    return (
        <ProtectedRoute roles={['admin']}>
            <EditPropertyPage />
        </ProtectedRoute>
    );
}

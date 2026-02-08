'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle2, Circle, ArrowLeft } from 'lucide-react';
import {
    PropertyDetailsStep,
    MediaUploadStep,
    VariantsStep,
    UnitsStep,
    ReviewStep,
    type PropertyFormData,
    type MediaFile,
    type VariantFormData,
    type UnitFormData,
} from '@/components/properties/wizard-steps';
import { useCreateProperty, useCreateVariant, useCreateUnit } from '@/lib/hooks/use-properties';
import { propertyApi } from '@/lib/api/client';
import { ProtectedRoute } from '@/components/auth';

const STEPS = [
    { id: 'details', label: 'Property Details', description: 'Basic information' },
    { id: 'media', label: 'Media & Images', description: 'Photos and videos' },
    { id: 'variants', label: 'Variants', description: 'Configurations & pricing' },
    { id: 'units', label: 'Units', description: 'Individual units' },
    { id: 'review', label: 'Review & Publish', description: 'Final review' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

interface WizardData {
    property: PropertyFormData;
    media: MediaFile[];
    displayImageKey?: string;
    variants: VariantFormData[];
    units: Record<string, UnitFormData[]>; // variantId -> units[]
    initialStatus: 'DRAFT' | 'PUBLISHED';
}

function CreatePropertyWizardPage() {
    const router = useRouter();
    const createProperty = useCreateProperty();
    const createVariant = useCreateVariant();
    const createUnit = useCreateUnit();

    const [currentStep, setCurrentStep] = useState<StepId>('details');
    const [wizardData, setWizardData] = useState<WizardData>({
        property: {
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
            longitude: null,
            latitude: null,
        },
        media: [],
        variants: [],
        units: {},
        initialStatus: 'DRAFT',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
    const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

    const updateWizardData = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
        setWizardData((prev) => ({ ...prev, [key]: value }));
    };

    const goToStep = (stepId: StepId) => {
        setCurrentStep(stepId);
    };

    const goNext = () => {
        const nextIndex = currentStepIndex + 1;
        if (nextIndex < STEPS.length) {
            setCurrentStep(STEPS[nextIndex].id);
        }
    };

    const goBack = () => {
        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
            setCurrentStep(STEPS[prevIndex].id);
        }
    };

    const handleCancel = () => {
        const hasData =
            wizardData.property.title || wizardData.media.length > 0 || wizardData.variants.length > 0;

        if (hasData) {
            if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
                return;
            }
        }

        router.push('/admin/properties');
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Step 1: Create the property
            const property = await createProperty.mutateAsync({
                ...wizardData.property,
                status: wizardData.initialStatus,
            } as Record<string, unknown>);

            const propertyId = property.id;

            // Step 2: Add media to property
            if (wizardData.media.length > 0) {
                const mediaData = wizardData.media
                    .filter((m) => m.key) // Only uploaded media
                    .map((m, idx) => ({
                        url: m.downloadUrl,
                        type: m.type,
                        caption: m.caption,
                        order: idx,
                    }));

                if (mediaData.length > 0) {
                    const mediaResponse = await propertyApi.post<Array<{ id: string; url: string; type: string }>>(`/property/properties/${propertyId}/media`, { media: mediaData });

                    // Set display image if selected - use media record ID (not URL)
                    if (wizardData.displayImageKey && mediaResponse.data) {
                        const displayMedia = wizardData.media.find((m) => m.key === wizardData.displayImageKey);
                        if (displayMedia?.downloadUrl) {
                            // Find the created media record matching the display image URL
                            const displayMediaRecord = mediaResponse.data.find(
                                (m) => m.url === displayMedia.downloadUrl
                            );
                            if (displayMediaRecord) {
                                await propertyApi.put(`/property/properties/${propertyId}`, {
                                    displayImageId: displayMediaRecord.id,
                                });
                            }
                        }
                    }
                }
            }

            // Step 3: Create variants and their units
            for (const variant of wizardData.variants) {
                const createdVariant = await createVariant.mutateAsync({
                    propertyId,
                    data: {
                        name: variant.name,
                        description: variant.description,
                        nBedrooms: variant.nBedrooms,
                        nBathrooms: variant.nBathrooms,
                        nParkingSpots: variant.nParkingSpots,
                        area: variant.area,
                        price: variant.price,
                        pricePerSqm: variant.pricePerSqm,
                        totalUnits: variant.totalUnits,
                    },
                });

                // Create units for this variant
                const variantUnits = wizardData.units[variant.id] || [];
                for (const unit of variantUnits) {
                    await createUnit.mutateAsync({
                        propertyId,
                        variantId: createdVariant.id,
                        data: {
                            unitNumber: unit.unitNumber,
                            floorNumber: unit.floorNumber,
                            blockName: unit.blockName,
                            priceOverride: unit.priceOverride,
                            areaOverride: unit.areaOverride,
                            notes: unit.notes,
                            status: unit.status,
                        },
                    });
                }
            }

            toast.success('Property created successfully!');
            router.push('/admin/properties');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create property');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={handleCancel}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-semibold">Create New Property</h1>
                                <p className="text-sm text-muted-foreground">
                                    Step {currentStepIndex + 1} of {STEPS.length}: {STEPS[currentStepIndex].label}
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                            Cancel
                        </Button>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 space-y-2">
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between">
                            {STEPS.map((step, idx) => (
                                <button
                                    key={step.id}
                                    onClick={() => goToStep(step.id)}
                                    disabled={isSubmitting}
                                    className={`flex items-center gap-1.5 text-xs transition-colors ${currentStepIndex === idx
                                        ? 'text-primary font-medium'
                                        : currentStepIndex > idx
                                            ? 'text-green-600 hover:text-green-700'
                                            : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {currentStepIndex > idx ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                        <Circle
                                            className={`h-4 w-4 ${currentStepIndex === idx ? 'fill-primary text-primary' : ''}`}
                                        />
                                    )}
                                    <span className="hidden md:inline">{step.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Card>
                    <CardContent className="p-6">
                        {currentStep === 'details' && (
                            <PropertyDetailsStep
                                data={wizardData.property}
                                onChange={(data: PropertyFormData) => updateWizardData('property', data)}
                                onNext={goNext}
                            />
                        )}

                        {currentStep === 'media' && (
                            <MediaUploadStep
                                media={wizardData.media}
                                displayImageKey={wizardData.displayImageKey}
                                onChange={(media: MediaFile[]) => updateWizardData('media', media)}
                                onDisplayImageChange={(key: string | undefined) =>
                                    updateWizardData('displayImageKey', key)
                                }
                                onNext={goNext}
                                onBack={goBack}
                            />
                        )}

                        {currentStep === 'variants' && (
                            <VariantsStep
                                variants={wizardData.variants}
                                currency={wizardData.property.currency}
                                onChange={(variants: VariantFormData[]) => updateWizardData('variants', variants)}
                                onNext={goNext}
                                onBack={goBack}
                            />
                        )}

                        {currentStep === 'units' && (
                            <UnitsStep
                                variants={wizardData.variants}
                                units={wizardData.units}
                                onChange={(units: Record<string, UnitFormData[]>) =>
                                    updateWizardData('units', units)
                                }
                                onNext={goNext}
                                onBack={goBack}
                            />
                        )}

                        {currentStep === 'review' && (
                            <ReviewStep
                                wizardData={{
                                    property: wizardData.property,
                                    media: wizardData.media,
                                    displayImageKey: wizardData.displayImageKey,
                                    variants: wizardData.variants,
                                    units: wizardData.units,
                                    initialStatus: wizardData.initialStatus,
                                }}
                                onStatusChange={(status: 'DRAFT' | 'PUBLISHED') =>
                                    updateWizardData('initialStatus', status)
                                }
                                onEdit={goToStep}
                                onBack={goBack}
                                onSubmit={handleSubmit}
                                isSubmitting={isSubmitting}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function CreatePropertyPage() {
    return (
        <ProtectedRoute>
            <CreatePropertyWizardPage />
        </ProtectedRoute>
    );
}

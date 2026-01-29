'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { CheckCircle2, Circle } from 'lucide-react';
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
} from './wizard-steps';
import { useCreateProperty } from '@/lib/hooks/use-properties';

const STEPS = [
  { id: 'details', label: 'Property Details', description: 'Basic information' },
  { id: 'media', label: 'Media & Images', description: 'Photos and videos' },
  { id: 'variants', label: 'Variants', description: 'Configurations & pricing' },
  { id: 'units', label: 'Units', description: 'Individual units' },
  { id: 'review', label: 'Review & Publish', description: 'Final review' },
] as const;

type StepId = typeof STEPS[number]['id'];

export interface CreatePropertyWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export interface WizardData {
  property: PropertyFormData;
  media: MediaFile[];
  displayImageKey?: string;
  variants: VariantFormData[];
  units: Record<string, UnitFormData[]>; // variantId -> units[]
  initialStatus: 'DRAFT' | 'PUBLISHED';
}

export function CreatePropertyWizard({ open, onOpenChange, onSuccess }: CreatePropertyWizardProps) {
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

  const handleClose = () => {
    if (isSubmitting) return;
    
    const hasData = wizardData.property.title || wizardData.media.length > 0 || wizardData.variants.length > 0;
    
    if (hasData) {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }

    // Reset wizard
    setCurrentStep('details');
    setWizardData({
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create New Property</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => goToStep(step.id)}
                disabled={isSubmitting}
                className={`flex items-center gap-1 transition-colors ${
                  currentStepIndex === idx
                    ? 'text-primary font-medium'
                    : currentStepIndex > idx
                    ? 'text-green-600 hover:text-green-700'
                    : 'hover:text-foreground'
                }`}
              >
                {currentStepIndex > idx ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Circle className={`h-3 w-3 ${currentStepIndex === idx ? 'fill-primary' : ''}`} />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-1">
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
              onDisplayImageChange={(key: string | undefined) => updateWizardData('displayImageKey', key)}
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
              onChange={(units: Record<string, UnitFormData[]>) => updateWizardData('units', units)}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {currentStep === 'review' && (
            <ReviewStep
              wizardData={wizardData}
              onStatusChange={(status: 'DRAFT' | 'PUBLISHED') => updateWizardData('initialStatus', status)}
              onEdit={goToStep}
              onBack={goBack}
              onSubmit={async () => {
                setIsSubmitting(true);
                try {
                  // TODO: Submit the complete property with media, variants, and units
                  toast.success('Property created successfully!');
                  onSuccess?.();
                  handleClose();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to create property');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

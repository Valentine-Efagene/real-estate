'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft,
  Edit,
  CheckCircle2,
  Building2,
  Image as ImageIcon,
  Layers,
  Home,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { WizardData } from './types';

interface ReviewStepProps {
  wizardData: WizardData;
  onStatusChange: (status: 'DRAFT' | 'PUBLISHED') => void;
  onEdit: (stepId: 'details' | 'media' | 'variants' | 'units') => void;
  onBack: () => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

export function ReviewStep({
  wizardData,
  onStatusChange,
  onEdit,
  onBack,
  onSubmit,
  isSubmitting,
}: ReviewStepProps) {
  const { property, media, displayImageKey, variants, units, initialStatus } = wizardData;

  const currencySymbol =
    property.currency === 'NGN' ? '₦' :
      property.currency === 'USD' ? '$' :
        property.currency === 'GBP' ? '£' : '€';

  const displayImage = media.find((m) => m.key === displayImageKey);
  const totalUnits = Object.values(units).reduce((sum, variantUnits) => sum + variantUnits.length, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <CardTitle>Review & Publish</CardTitle>
          </div>
          <CardDescription>
            Review all details before creating the property
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Property Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Property Details</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit('details')}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Title</p>
            <p className="text-sm">{property.title}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Category</p>
            <Badge variant="outline">{property.category}</Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Type</p>
            <Badge variant="outline">{property.propertyType}</Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Currency</p>
            <p className="text-sm">{property.currency}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Location</p>
            <p className="text-sm">
              {property.city}
              {property.district && `, ${property.district}`}
              {property.country && `, ${property.country}`}
            </p>
          </div>
          {property.description && (
            <div className="col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-sm line-clamp-3">{property.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Media */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Media ({media.length})</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit('media')}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {media.slice(0, 8).map((item) => (
              <div key={item.id} className="relative group">
                <div className="aspect-video bg-muted rounded overflow-hidden">
                  {item.downloadUrl && item.type === 'IMAGE' ? (
                    <img
                      src={item.downloadUrl}
                      alt={item.caption || 'Property media'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  {item.key === displayImageKey && (
                    <div className="absolute top-1 right-1">
                      <Badge variant="default" className="text-xs">Display</Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {media.length > 8 && (
              <div className="aspect-video bg-muted rounded flex items-center justify-center">
                <p className="text-sm text-muted-foreground">+{media.length - 8} more</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Variants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Variants ({variants.length})</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit('variants')}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {variants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{variant.name}</p>
                  <div className="flex gap-2 mt-1">
                    {variant.nBedrooms && <Badge variant="outline">{variant.nBedrooms} bed</Badge>}
                    {variant.nBathrooms && <Badge variant="outline">{variant.nBathrooms} bath</Badge>}
                    {variant.area && <Badge variant="outline">{variant.area} m²</Badge>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{currencySymbol}{variant.price.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{variant.totalUnits} units</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Units Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Units ({totalUnits} total)</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit('units')}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {variants.map((variant) => {
              const variantUnits = units[variant.id] || [];
              return (
                <div key={variant.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{variant.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {variantUnits.length} unit{variantUnits.length !== 1 ? 's' : ''} created
                    </p>
                  </div>
                  <Badge variant={variantUnits.length >= variant.totalUnits ? 'default' : 'secondary'}>
                    {variantUnits.length}/{variant.totalUnits}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Initial Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Initial Status</CardTitle>
          <CardDescription>
            Choose whether to publish immediately or save as draft
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={initialStatus} onValueChange={(value) => onStatusChange(value as 'DRAFT' | 'PUBLISHED')}>
            <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="DRAFT" id="draft" />
              <Label htmlFor="draft" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Save as Draft</p>
                    <p className="text-sm text-muted-foreground">
                      Property will be saved but not visible to customers
                    </p>
                  </div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="PUBLISHED" id="published" />
              <Label htmlFor="published" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Publish Immediately</p>
                    <p className="text-sm text-muted-foreground">
                      Property will be immediately visible to customers
                    </p>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Property...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Create Property
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ChevronRight } from 'lucide-react';
import type { PropertyFormData } from './types';

interface PropertyDetailsStepProps {
  data: PropertyFormData;
  onChange: (data: PropertyFormData) => void;
  onNext: () => void;
}

export function PropertyDetailsStep({ data, onChange, onNext }: PropertyDetailsStepProps) {
  const handleChange = (key: keyof PropertyFormData, value: string | number | null) => {
    onChange({ ...data, [key]: value });
  };

  const isValid = () => {
    return !!(
      data.title &&
      data.category &&
      data.propertyType &&
      data.country &&
      data.currency &&
      data.city
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid()) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Property Information</CardTitle>
          </div>
          <CardDescription>
            Enter the basic details of the property listing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="title">
                Property Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={data.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Lekki Gardens Estate"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                A clear, descriptive name for the property
              </p>
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={data.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe the property, location, amenities..."
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select value={data.category} onValueChange={(value) => handleChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALE">For Sale</SelectItem>
                  <SelectItem value="RENT">For Rent</SelectItem>
                  <SelectItem value="LEASE">For Lease</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="propertyType">
                Property Type <span className="text-destructive">*</span>
              </Label>
              <Select value={data.propertyType} onValueChange={(value) => handleChange('propertyType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APARTMENT">Apartment</SelectItem>
                  <SelectItem value="HOUSE">House</SelectItem>
                  <SelectItem value="ESTATE">Estate</SelectItem>
                  <SelectItem value="TOWNHOUSE">Townhouse</SelectItem>
                  <SelectItem value="LAND">Land</SelectItem>
                  <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="country">
                Country <span className="text-destructive">*</span>
              </Label>
              <Input
                id="country"
                value={data.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="Nigeria"
                required
              />
            </div>

            <div>
              <Label htmlFor="currency">
                Currency <span className="text-destructive">*</span>
              </Label>
              <Select value={data.currency} onValueChange={(value) => handleChange('currency', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">NGN (₦)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                value={data.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="e.g., Lagos"
                required
              />
            </div>

            <div>
              <Label htmlFor="district">District/Area</Label>
              <Input
                id="district"
                value={data.district}
                onChange={(e) => handleChange('district', e.target.value)}
                placeholder="e.g., Lekki Phase 1"
              />
            </div>

            <div>
              <Label htmlFor="zipCode">Zip/Postal Code</Label>
              <Input
                id="zipCode"
                value={data.zipCode}
                onChange={(e) => handleChange('zipCode', e.target.value)}
                placeholder="e.g., 101245"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="streetAddress">Street Address</Label>
              <Input
                id="streetAddress"
                value={data.streetAddress}
                onChange={(e) => handleChange('streetAddress', e.target.value)}
                placeholder="e.g., 15 Admiralty Way"
              />
            </div>

            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={data.latitude ?? ''}
                onChange={(e) => handleChange('latitude', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g., 6.4541"
              />
            </div>

            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={data.longitude ?? ''}
                onChange={(e) => handleChange('longitude', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="e.g., 3.3947"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isValid()}>
          Continue to Media
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </form>
  );
}

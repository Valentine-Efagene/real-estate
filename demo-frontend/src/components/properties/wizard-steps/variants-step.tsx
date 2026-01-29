'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, ChevronRight, ChevronLeft, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type { VariantFormData } from './types';

interface VariantsStepProps {
  variants: VariantFormData[];
  currency: string;
  onChange: (variants: VariantFormData[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function VariantsStep({ variants, currency, onChange, onNext, onBack }: VariantsStepProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VariantFormData | null>(null);
  const [formData, setFormData] = useState<Partial<VariantFormData>>({
    name: '',
    description: '',
    nBedrooms: undefined,
    nBathrooms: undefined,
    nParkingSpots: undefined,
    area: undefined,
    price: 0,
    pricePerSqm: undefined,
    totalUnits: 1,
  });

  const currencySymbol = currency === 'NGN' ? '₦' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';

  const openCreateDialog = () => {
    setEditingVariant(null);
    setFormData({
      name: '',
      description: '',
      nBedrooms: undefined,
      nBathrooms: undefined,
      nParkingSpots: undefined,
      area: undefined,
      price: 0,
      pricePerSqm: undefined,
      totalUnits: 1,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (variant: VariantFormData) => {
    setEditingVariant(variant);
    setFormData(variant);
    setIsDialogOpen(true);
  };

  const handleSaveVariant = () => {
    if (!formData.name || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newVariant: VariantFormData = {
      id: editingVariant?.id || `variant-${Date.now()}`,
      name: formData.name!,
      description: formData.description,
      nBedrooms: formData.nBedrooms,
      nBathrooms: formData.nBathrooms,
      nParkingSpots: formData.nParkingSpots,
      area: formData.area,
      price: formData.price!,
      pricePerSqm: formData.pricePerSqm,
      totalUnits: formData.totalUnits || 1,
    };

    if (editingVariant) {
      onChange(variants.map((v) => (v.id === editingVariant.id ? newVariant : v)));
      toast.success('Variant updated');
    } else {
      onChange([...variants, newVariant]);
      toast.success('Variant added');
    }

    setIsDialogOpen(false);
  };

  const deleteVariant = (id: string) => {
    if (confirm('Are you sure you want to delete this variant?')) {
      onChange(variants.filter((v) => v.id !== id));
      toast.success('Variant deleted');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG').format(price);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Property Variants</CardTitle>
                <CardDescription>
                  Define different configurations (e.g., 2-bed, 3-bed) with their own pricing
                </CardDescription>
              </div>
            </div>
            <Button onClick={openCreateDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Variant
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-2">No variants yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Add variants to define different unit configurations
              </p>
              <Button onClick={openCreateDialog} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Variant
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Specs</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{variant.name}</p>
                        {variant.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {variant.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {variant.nBedrooms && (
                          <Badge variant="outline">{variant.nBedrooms} bed</Badge>
                        )}
                        {variant.nBathrooms && (
                          <Badge variant="outline">{variant.nBathrooms} bath</Badge>
                        )}
                        {variant.nParkingSpots && (
                          <Badge variant="outline">{variant.nParkingSpots} parking</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {variant.area ? (
                        <span>
                          {variant.area} m²
                          {variant.pricePerSqm && (
                            <span className="text-xs text-muted-foreground block">
                              {currencySymbol}{formatPrice(variant.pricePerSqm)}/m²
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {currencySymbol}{formatPrice(variant.price)}
                    </TableCell>
                    <TableCell>
                      <Badge>{variant.totalUnits}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(variant)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteVariant(variant.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {variants.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            ⚠️ You need to create at least one variant before proceeding
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button type="button" onClick={onNext} disabled={variants.length === 0}>
          Continue to Units
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Variant Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVariant ? 'Edit Variant' : 'Add Variant'}</DialogTitle>
            <DialogDescription>
              Define the configuration details and pricing for this variant
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label htmlFor="variant-name">
                Variant Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="variant-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 3-Bedroom Corner Piece"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="variant-description">Description</Label>
              <Textarea
                id="variant-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about this variant..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                min="0"
                value={formData.nBedrooms ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nBedrooms: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input
                id="bathrooms"
                type="number"
                min="0"
                value={formData.nBathrooms ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nBathrooms: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="parking">Parking Spots</Label>
              <Input
                id="parking"
                type="number"
                min="0"
                value={formData.nParkingSpots ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nParkingSpots: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="area">Area (m²)</Label>
              <Input
                id="area"
                type="number"
                min="0"
                step="0.01"
                value={formData.area ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    area: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="price">
                Price ({currency}) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                min="0"
                value={formData.price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="pricePerSqm">Price per m²</Label>
              <Input
                id="pricePerSqm"
                type="number"
                min="0"
                step="0.01"
                value={formData.pricePerSqm ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricePerSqm: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="totalUnits">
                Total Units <span className="text-destructive">*</span>
              </Label>
              <Input
                id="totalUnits"
                type="number"
                min="1"
                value={formData.totalUnits}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    totalUnits: parseInt(e.target.value) || 1,
                  })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Number of units available for this variant
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVariant}>
              {editingVariant ? 'Update' : 'Add'} Variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

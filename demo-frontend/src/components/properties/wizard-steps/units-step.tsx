'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, ChevronRight, ChevronLeft, Home } from 'lucide-react';
import { toast } from 'sonner';
import type { VariantFormData, UnitFormData } from './types';

interface UnitsStepProps {
  variants: VariantFormData[];
  units: Record<string, UnitFormData[]>;
  onChange: (units: Record<string, UnitFormData[]>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function UnitsStep({ variants, units, onChange, onNext, onBack }: UnitsStepProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id || '');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitFormData | null>(null);
  const [formData, setFormData] = useState<Partial<UnitFormData>>({
    unitNumber: '',
    floorNumber: undefined,
    blockName: '',
    priceOverride: undefined,
    areaOverride: undefined,
    notes: '',
    status: 'AVAILABLE',
  });

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const variantUnits = units[selectedVariantId] || [];

  const openCreateDialog = () => {
    setEditingUnit(null);
    setFormData({
      unitNumber: '',
      floorNumber: undefined,
      blockName: '',
      priceOverride: undefined,
      areaOverride: undefined,
      notes: '',
      status: 'AVAILABLE',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (unit: UnitFormData) => {
    setEditingUnit(unit);
    setFormData(unit);
    setIsDialogOpen(true);
  };

  const handleSaveUnit = () => {
    if (!formData.unitNumber) {
      toast.error('Please enter a unit number');
      return;
    }

    const newUnit: UnitFormData = {
      id: editingUnit?.id || `unit-${Date.now()}`,
      unitNumber: formData.unitNumber!,
      floorNumber: formData.floorNumber,
      blockName: formData.blockName,
      priceOverride: formData.priceOverride,
      areaOverride: formData.areaOverride,
      notes: formData.notes,
      status: formData.status || 'AVAILABLE',
    };

    const updatedVariantUnits = editingUnit
      ? variantUnits.map((u) => (u.id === editingUnit.id ? newUnit : u))
      : [...variantUnits, newUnit];

    onChange({
      ...units,
      [selectedVariantId]: updatedVariantUnits,
    });

    toast.success(editingUnit ? 'Unit updated' : 'Unit added');
    setIsDialogOpen(false);
  };

  const deleteUnit = (id: string) => {
    if (confirm('Are you sure you want to delete this unit?')) {
      onChange({
        ...units,
        [selectedVariantId]: variantUnits.filter((u) => u.id !== id),
      });
      toast.success('Unit deleted');
    }
  };

  const generateUnits = () => {
    if (!selectedVariant) return;

    const count = selectedVariant.totalUnits;
    const generatedUnits: UnitFormData[] = [];

    for (let i = 1; i <= count; i++) {
      generatedUnits.push({
        id: `unit-${selectedVariantId}-${i}-${Date.now()}`,
        unitNumber: `${i}`,
        status: 'AVAILABLE',
      });
    }

    onChange({
      ...units,
      [selectedVariantId]: generatedUnits,
    });

    toast.success(`Generated ${count} units`);
  };

  const getTotalUnits = () => {
    return Object.values(units).reduce((sum, variantUnits) => sum + variantUnits.length, 0);
  };

  const getRequiredUnits = () => {
    return variants.reduce((sum, v) => sum + v.totalUnits, 0);
  };

  const totalUnits = getTotalUnits();
  const requiredUnits = getRequiredUnits();
  const allUnitsCreated = totalUnits >= requiredUnits;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Property Units</CardTitle>
                <CardDescription>
                  Create individual units for each variant ({totalUnits} of {requiredUnits} units created)
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedVariantId} onValueChange={setSelectedVariantId}>
            <TabsList className="w-full justify-start">
              {variants.map((variant) => {
                const variantUnitsCount = units[variant.id]?.length || 0;
                return (
                  <TabsTrigger key={variant.id} value={variant.id} className="flex items-center gap-2">
                    {variant.name}
                    <Badge variant={variantUnitsCount >= variant.totalUnits ? 'default' : 'secondary'}>
                      {variantUnitsCount}/{variant.totalUnits}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {variants.map((variant) => (
              <TabsContent key={variant.id} value={variant.id} className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{variant.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {variantUnits.length} of {variant.totalUnits} units created
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {variantUnits.length === 0 && (
                      <Button onClick={generateUnits} variant="outline" size="sm">
                        Generate {variant.totalUnits} Units
                      </Button>
                    )}
                    <Button onClick={openCreateDialog} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Unit
                    </Button>
                  </div>
                </div>

                {variantUnits.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm font-medium mb-2">No units yet</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Add units manually or generate them automatically
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={generateUnits} variant="outline" size="sm">
                        Generate {variant.totalUnits} Units
                      </Button>
                      <Button onClick={openCreateDialog} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Manually
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit Number</TableHead>
                        <TableHead>Floor</TableHead>
                        <TableHead>Block</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variantUnits.map((unit) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                          <TableCell>
                            {unit.floorNumber ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {unit.blockName || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {unit.priceOverride ? (
                              <Badge variant="outline">Override: ₦{unit.priceOverride.toLocaleString()}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Default</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                unit.status === 'AVAILABLE' ? 'default' : 
                                unit.status === 'RESERVED' ? 'secondary' : 
                                'outline'
                              }
                            >
                              {unit.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(unit)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteUnit(unit.id)}
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
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {!allUnitsCreated && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            ⚠️ You need to create all {requiredUnits} units before proceeding ({totalUnits} created so far)
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button type="button" onClick={onNext} disabled={!allUnitsCreated}>
          Continue to Review
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Unit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
            <DialogDescription>
              {selectedVariant && `Create a unit for ${selectedVariant.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="unit-number">
                Unit Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unit-number"
                value={formData.unitNumber}
                onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                placeholder="e.g., A1, B-14, Plot 5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="floor">Floor Number</Label>
                <Input
                  id="floor"
                  type="number"
                  value={formData.floorNumber ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      floorNumber: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="block">Block Name</Label>
                <Input
                  id="block"
                  value={formData.blockName}
                  onChange={(e) => setFormData({ ...formData, blockName: e.target.value })}
                  placeholder="e.g., Block A"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price-override">Price Override</Label>
                <Input
                  id="price-override"
                  type="number"
                  value={formData.priceOverride ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priceOverride: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="area-override">Area Override (m²)</Label>
                <Input
                  id="area-override"
                  type="number"
                  step="0.01"
                  value={formData.areaOverride ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      areaOverride: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="RESERVED">Reserved</SelectItem>
                  <SelectItem value="SOLD">Sold</SelectItem>
                  <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Internal notes about this unit..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUnit}>
              {editingUnit ? 'Update' : 'Add'} Unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

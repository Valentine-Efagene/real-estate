'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
    useProperties,
    usePropertyVariants,
    usePropertyUnits,
    useCreateProperty,
    useUpdateProperty,
    useDeleteProperty,
    usePublishProperty,
    useUnpublishProperty,
    useCreateVariant,
    useDeleteVariant,
    useCreateUnit,
    useDeleteUnit,
    Property,
    PropertyVariant,
    PropertyUnit,
} from '@/lib/hooks/use-properties';
import Link from 'next/link';
import { Plus, Trash2, Eye, EyeOff, Building, Layers, Home, ChevronRight } from 'lucide-react';

// ============================================================================
// Create Variant Dialog
// ============================================================================
function CreateVariantDialog({ propertyId, onSuccess }: { propertyId: string; onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);
    const createVariant = useCreateVariant();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        nBedrooms: 3,
        nBathrooms: 2,
        nParkingSpots: 1,
        area: 150,
        price: 85000000,
        totalUnits: 1,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createVariant.mutateAsync({ propertyId, data: formData });
            toast.success('Variant created successfully');
            setOpen(false);
            setFormData({
                name: '',
                description: '',
                nBedrooms: 3,
                nBathrooms: 2,
                nParkingSpots: 1,
                area: 150,
                price: 85000000,
                totalUnits: 1,
            });
            onSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create variant');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Variant
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Property Variant</DialogTitle>
                    <DialogDescription>
                        Add a unit type/variant to this property (e.g., 3-Bedroom Flat, 4-Bedroom Duplex).
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Label htmlFor="variantName">Variant Name *</Label>
                            <Input
                                id="variantName"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., 3-Bedroom Flat"
                                required
                            />
                        </div>

                        <div className="col-span-2">
                            <Label htmlFor="variantDescription">Description</Label>
                            <Textarea
                                id="variantDescription"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe this variant..."
                                rows={2}
                            />
                        </div>

                        <div>
                            <Label htmlFor="nBedrooms">Bedrooms</Label>
                            <Input
                                id="nBedrooms"
                                type="number"
                                value={formData.nBedrooms}
                                onChange={(e) => setFormData({ ...formData, nBedrooms: parseInt(e.target.value) || 0 })}
                            />
                        </div>

                        <div>
                            <Label htmlFor="nBathrooms">Bathrooms</Label>
                            <Input
                                id="nBathrooms"
                                type="number"
                                value={formData.nBathrooms}
                                onChange={(e) => setFormData({ ...formData, nBathrooms: parseInt(e.target.value) || 0 })}
                            />
                        </div>

                        <div>
                            <Label htmlFor="nParkingSpots">Parking Spots</Label>
                            <Input
                                id="nParkingSpots"
                                type="number"
                                value={formData.nParkingSpots}
                                onChange={(e) => setFormData({ ...formData, nParkingSpots: parseInt(e.target.value) || 0 })}
                            />
                        </div>

                        <div>
                            <Label htmlFor="area">Area (sqm)</Label>
                            <Input
                                id="area"
                                type="number"
                                value={formData.area}
                                onChange={(e) => setFormData({ ...formData, area: parseFloat(e.target.value) || 0 })}
                            />
                        </div>

                        <div>
                            <Label htmlFor="price">Price (₦) *</Label>
                            <Input
                                id="price"
                                type="number"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="totalUnits">Total Units</Label>
                            <Input
                                id="totalUnits"
                                type="number"
                                value={formData.totalUnits}
                                onChange={(e) => setFormData({ ...formData, totalUnits: parseInt(e.target.value) || 1 })}
                                min={1}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createVariant.isPending}>
                            {createVariant.isPending ? 'Creating...' : 'Create Variant'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Create Unit Dialog
// ============================================================================
function CreateUnitDialog({ propertyId, variantId, onSuccess }: { propertyId: string; variantId: string; onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);
    const createUnit = useCreateUnit();

    const [formData, setFormData] = useState({
        unitNumber: '',
        floorNumber: 1,
        blockName: '',
        notes: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createUnit.mutateAsync({ propertyId, variantId, data: formData });
            toast.success('Unit created successfully');
            setOpen(false);
            setFormData({
                unitNumber: '',
                floorNumber: 1,
                blockName: '',
                notes: '',
            });
            onSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create unit');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Unit
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Unit</DialogTitle>
                    <DialogDescription>
                        Add a specific unit to this variant (e.g., Unit 14B).
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="unitNumber">Unit Number *</Label>
                            <Input
                                id="unitNumber"
                                value={formData.unitNumber}
                                onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                                placeholder="e.g., 14B"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="floorNumber">Floor Number</Label>
                            <Input
                                id="floorNumber"
                                type="number"
                                value={formData.floorNumber}
                                onChange={(e) => setFormData({ ...formData, floorNumber: parseInt(e.target.value) || 1 })}
                            />
                        </div>

                        <div>
                            <Label htmlFor="blockName">Block Name</Label>
                            <Input
                                id="blockName"
                                value={formData.blockName}
                                onChange={(e) => setFormData({ ...formData, blockName: e.target.value })}
                                placeholder="e.g., Block B"
                            />
                        </div>

                        <div className="col-span-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Input
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="e.g., Corner unit with extra windows"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createUnit.isPending}>
                            {createUnit.isPending ? 'Creating...' : 'Create Unit'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Property Row with Expandable Variants and Units
// ============================================================================
function PropertyRow({ property }: { property: Property }) {
    const { data: variants, isLoading: variantsLoading } = usePropertyVariants(property.id);
    const publishProperty = usePublishProperty();
    const unpublishProperty = useUnpublishProperty();
    const deleteProperty = useDeleteProperty();

    const handlePublish = async () => {
        try {
            await publishProperty.mutateAsync(property.id);
            toast.success('Property published');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to publish');
        }
    };

    const handleUnpublish = async () => {
        try {
            await unpublishProperty.mutateAsync(property.id);
            toast.success('Property unpublished');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to unpublish');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this property? This cannot be undone.')) return;
        try {
            await deleteProperty.mutateAsync(property.id);
            toast.success('Property deleted');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete');
        }
    };

    const propertyName = property.title || 'Unnamed Property';
    const propertyStatus = property.status || 'DRAFT';
    const location = [property.city, property.district, property.country].filter(Boolean).join(', ');

    return (
        <AccordionItem value={property.id} className="border rounded-lg mb-2">
            <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                        <Building className="h-5 w-5 text-gray-400" />
                        <div className="text-left">
                            <div className="font-medium">{propertyName}</div>
                            <div className="text-sm text-gray-500">
                                {location}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={propertyStatus === 'PUBLISHED' ? 'default' : 'outline'}>
                            {propertyStatus}
                        </Badge>
                        <Badge variant="secondary">
                            {variants?.length || 0} variants
                        </Badge>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                    {/* Property Actions */}
                    <div className="flex gap-2 border-b pb-3">
                        {propertyStatus === 'PUBLISHED' ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleUnpublish}
                                disabled={unpublishProperty.isPending}
                            >
                                <EyeOff className="h-3 w-3 mr-1" />
                                Unpublish
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handlePublish}
                                disabled={publishProperty.isPending}
                            >
                                <Eye className="h-3 w-3 mr-1" />
                                Publish
                            </Button>
                        )}
                        <CreateVariantDialog propertyId={property.id} />
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteProperty.isPending}
                        >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                        </Button>
                    </div>

                    {/* Variants */}
                    {variantsLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : variants && variants.length > 0 ? (
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-gray-500 flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Variants
                            </div>
                            {variants.map((variant) => (
                                <VariantCard
                                    key={variant.id}
                                    propertyId={property.id}
                                    variant={variant}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-gray-500">
                            <Layers className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                            <p>No variants yet. Add a variant to define unit types.</p>
                        </div>
                    )}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

// ============================================================================
// Variant Card with Units
// ============================================================================
function VariantCard({ propertyId, variant }: {
    propertyId: string;
    variant: PropertyVariant;
}) {
    const { data: units, isLoading: unitsLoading } = usePropertyUnits(propertyId, variant.id);
    const deleteVariant = useDeleteVariant();
    const [showUnits, setShowUnits] = useState(false);

    const handleDelete = async () => {
        if (!confirm('Delete this variant and all its units?')) return;
        try {
            await deleteVariant.mutateAsync({ propertyId, variantId: variant.id });
            toast.success('Variant deleted');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete');
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0,
        }).format(price);
    };

    return (
        <Card className="ml-6">
            <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">{variant.name}</CardTitle>
                        <CardDescription>
                            {variant.nBedrooms ?? '-'} bed • {variant.nBathrooms ?? '-'} bath • {variant.area ?? '-'} sqm • {formatPrice(variant.price)}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            {variant.availableUnits}/{variant.totalUnits} available
                        </Badge>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowUnits(!showUnits)}
                        >
                            <Home className="h-3 w-3 mr-1" />
                            {showUnits ? 'Hide' : 'Show'} Units
                        </Button>
                        <CreateUnitDialog propertyId={propertyId} variantId={variant.id} />
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleDelete}
                            disabled={deleteVariant.isPending}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {showUnits && (
                <CardContent className="pt-0">
                    {unitsLoading ? (
                        <Skeleton className="h-20 w-full" />
                    ) : units && units.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Block</TableHead>
                                    <TableHead>Floor</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {units.map((unit: PropertyUnit) => (
                                    <TableRow key={unit.id}>
                                        <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                                        <TableCell>{unit.blockName || '-'}</TableCell>
                                        <TableCell>{unit.floorNumber ?? '-'}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={unit.status === 'AVAILABLE' ? 'default' : 'secondary'}
                                            >
                                                {unit.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-3 text-gray-500 text-sm">
                            No units yet. Add individual units to this variant.
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

// ============================================================================
// Main Page Component
// ============================================================================
function AdminPropertiesContent() {
    const { data, isLoading, error } = useProperties();
    const properties = data?.items || [];

    if (error) {
        return (
            <div className="text-center py-12">
                <span className="text-4xl">❌</span>
                <h2 className="text-xl font-semibold mt-4">Failed to load properties</h2>
                <p className="text-gray-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Property Management</h1>
                    <p className="text-gray-500 mt-1">
                        Create and manage properties, variants, and units
                    </p>
                </div>
                <Button asChild>
                    <Link href="/admin/properties/new">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Property
                    </Link>
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Properties</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{properties.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Published</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {properties.filter((p) => p.status === 'PUBLISHED').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Draft</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-600">
                            {properties.filter((p) => p.status !== 'PUBLISHED').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">For Sale</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {properties.filter((p) => p.category === 'SALE').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Properties List */}
            <Card>
                <CardHeader>
                    <CardTitle>All Properties</CardTitle>
                    <CardDescription>
                        Manage your property portfolio. Click on a property to view/add variants and units.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : properties.length === 0 ? (
                        <div className="text-center py-12">
                            <Building className="h-12 w-12 mx-auto text-gray-300" />
                            <h3 className="mt-4 text-lg font-medium">No properties yet</h3>
                            <p className="text-gray-500 mt-1">Get started by creating your first property.</p>
                            <div className="mt-4">
                                <Button asChild>
                                    <Link href="/admin/properties/new">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Property
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Accordion type="single" collapsible className="w-full">
                            {properties.map((property) => (
                                <PropertyRow key={property.id} property={property} />
                            ))}
                        </Accordion>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function AdminPropertiesPage() {
    // Authorization is enforced at the API Gateway level via Lambda authorizer
    // Any authenticated user can view this page, but API calls will fail if they
    // don't have the required permissions (e.g., properties:write for creating)
    return (
        <ProtectedRoute>
            <AdminPropertiesContent />
        </ProtectedRoute>
    );
}

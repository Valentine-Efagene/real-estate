'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useProperty,
  usePropertyVariants,
  usePropertyUnits,
  usePaymentMethods,
  useCreateApplication,
  type PropertyVariant,
  type PropertyUnit,
  type PaymentMethod,
} from '@/lib/hooks';

function formatCurrency(amount: number, currency: string = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function PropertyDetailContent({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const { data: property, isLoading: propertyLoading } = useProperty(propertyId);
  const { data: variants, isLoading: variantsLoading } = usePropertyVariants(propertyId);
  const { data: paymentMethods, isLoading: methodsLoading } = usePaymentMethods(propertyId);
  const createApplication = useCreateApplication();

  const [selectedVariant, setSelectedVariant] = useState<PropertyVariant | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<PropertyUnit | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);

  const { data: units } = usePropertyUnits(
    propertyId,
    selectedVariant?.id || ''
  );

  const handleStartApplication = async () => {
    if (!selectedUnit || !selectedMethod) {
      toast.error('Please select a unit and payment method');
      return;
    }

    try {
      const application = await createApplication.mutateAsync({
        propertyUnitId: selectedUnit.id,
        paymentMethodId: selectedMethod.id,
        title: `Purchase - ${property?.name} Unit ${selectedUnit.unitNumber}`,
        applicationType: selectedMethod.type === 'MORTGAGE' ? 'MORTGAGE' :
          selectedMethod.type === 'INSTALLMENT' ? 'INSTALLMENT' : 'FULL_PAYMENT',
        totalAmount: selectedUnit.price,
        monthlyIncome: 2500000, // Default - would collect from user
        monthlyExpenses: 800000, // Default - would collect from user
        applicantAge: 40, // Default - would collect from user
        selectedMortgageTermMonths: selectedMethod.termMonths,
      });

      toast.success('Application created successfully!');
      router.push(`/applications/${application.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create application');
    }
  };

  if (propertyLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Property not found</h2>
        <Link href="/properties">
          <Button className="mt-4">Back to Properties</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <Link href="/properties">
        <Button variant="ghost">← Back to Properties</Button>
      </Link>

      {/* Property Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{property.name}</h1>
          <p className="text-gray-500 mt-1">
            {property.address}, {property.city}, {property.state}
          </p>
        </div>
        <Badge variant={property.status === 'PUBLISHED' ? 'default' : 'secondary'}>
          {property.status}
        </Badge>
      </div>

      {/* Property Details */}
      <Card>
        <CardHeader>
          <CardTitle>About This Property</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            {property.description || 'No description available'}
          </p>
        </CardContent>
      </Card>

      {/* Variants & Units */}
      <Tabs defaultValue="variants">
        <TabsList>
          <TabsTrigger value="variants">Unit Types</TabsTrigger>
          <TabsTrigger value="payment">Payment Options</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="space-y-4">
          {variantsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : variants?.length === 0 ? (
            <p className="text-gray-500">No unit types available</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {variants?.map((variant) => (
                <Card
                  key={variant.id}
                  className={`cursor-pointer transition-all ${selectedVariant?.id === variant.id
                      ? 'ring-2 ring-primary'
                      : 'hover:shadow-md'
                    }`}
                  onClick={() => {
                    setSelectedVariant(variant);
                    setSelectedUnit(null);
                  }}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{variant.name}</CardTitle>
                    <CardDescription>{variant.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Bedrooms:</span>{' '}
                        <span className="font-medium">{variant.bedrooms}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Bathrooms:</span>{' '}
                        <span className="font-medium">{variant.bathrooms}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Size:</span>{' '}
                        <span className="font-medium">{variant.squareMeters} sqm</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Parking:</span>{' '}
                        <span className="font-medium">{variant.parkingSpaces}</span>
                      </div>
                    </div>
                    <p className="mt-4 text-xl font-bold text-primary">
                      From {formatCurrency(variant.basePrice, variant.currency)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Available Units */}
          {selectedVariant && (
            <Card>
              <CardHeader>
                <CardTitle>Available Units - {selectedVariant.name}</CardTitle>
                <CardDescription>
                  Select a specific unit to start your application
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!units ? (
                  <Skeleton className="h-24" />
                ) : units.length === 0 ? (
                  <p className="text-gray-500">No units available for this type</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                    {units.map((unit) => (
                      <Button
                        key={unit.id}
                        variant={selectedUnit?.id === unit.id ? 'default' : 'outline'}
                        className="h-auto py-4 flex-col"
                        onClick={() => setSelectedUnit(unit)}
                        disabled={unit.status !== 'AVAILABLE'}
                      >
                        <span className="font-bold">Unit {unit.unitNumber}</span>
                        <span className="text-xs">
                          Block {unit.block}, Floor {unit.floor}
                        </span>
                        <span className="text-xs mt-1">
                          {formatCurrency(unit.price, unit.currency)}
                        </span>
                        {unit.status !== 'AVAILABLE' && (
                          <Badge variant="secondary" className="mt-1">
                            {unit.status}
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          {methodsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : paymentMethods?.length === 0 ? (
            <p className="text-gray-500">No payment methods configured</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paymentMethods?.map((method) => (
                <Card
                  key={method.id}
                  className={`cursor-pointer transition-all ${selectedMethod?.id === method.id
                      ? 'ring-2 ring-primary'
                      : 'hover:shadow-md'
                    }`}
                  onClick={() => setSelectedMethod(method)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{method.name}</CardTitle>
                      <Badge>{method.type}</Badge>
                    </div>
                    <CardDescription>{method.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500">Down Payment:</span>{' '}
                        <span className="font-medium">{method.downPaymentPercentage}%</span>
                      </div>
                      {method.mortgagePercentage && (
                        <div>
                          <span className="text-gray-500">Mortgage:</span>{' '}
                          <span className="font-medium">{method.mortgagePercentage}%</span>
                        </div>
                      )}
                      {method.interestRate && (
                        <div>
                          <span className="text-gray-500">Interest Rate:</span>{' '}
                          <span className="font-medium">{method.interestRate}% p.a.</span>
                        </div>
                      )}
                      {method.termMonths && (
                        <div>
                          <span className="text-gray-500">Term:</span>{' '}
                          <span className="font-medium">{method.termMonths / 12} years</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Start Application Button */}
      {selectedUnit && selectedMethod && (
        <Card className="bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Ready to apply?</h3>
                <p className="text-sm text-gray-600">
                  Unit {selectedUnit.unitNumber} • {selectedMethod.name}
                </p>
                <p className="text-xl font-bold mt-2">
                  {formatCurrency(selectedUnit.price, selectedUnit.currency)}
                </p>
              </div>
              <Dialog open={showApplicationDialog} onOpenChange={setShowApplicationDialog}>
                <DialogTrigger asChild>
                  <Button size="lg">Start Application</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Application</DialogTitle>
                    <DialogDescription>
                      You&apos;re about to start an application for:
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-gray-500">Property:</div>
                      <div className="font-medium">{property.name}</div>
                      <div className="text-gray-500">Unit:</div>
                      <div className="font-medium">{selectedUnit.unitNumber}</div>
                      <div className="text-gray-500">Price:</div>
                      <div className="font-medium">
                        {formatCurrency(selectedUnit.price, selectedUnit.currency)}
                      </div>
                      <div className="text-gray-500">Payment Method:</div>
                      <div className="font-medium">{selectedMethod.name}</div>
                      <div className="text-gray-500">Down Payment:</div>
                      <div className="font-medium">
                        {formatCurrency(
                          (selectedUnit.price * selectedMethod.downPaymentPercentage) / 100,
                          selectedUnit.currency
                        )}{' '}
                        ({selectedMethod.downPaymentPercentage}%)
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowApplicationDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleStartApplication}
                      disabled={createApplication.isPending}
                    >
                      {createApplication.isPending ? 'Creating...' : 'Confirm & Start'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedRoute>
      <PropertyDetailContent propertyId={id} />
    </ProtectedRoute>
  );
}

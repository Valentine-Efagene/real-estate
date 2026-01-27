'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProperties } from '@/lib/hooks';

function PropertiesContent() {
  const { data, isLoading, error } = useProperties();
  const properties = data?.items || [];

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600">Error loading properties</h2>
        <p className="text-gray-500 mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
        <p className="text-gray-500 mt-1">
          Browse available properties and find your dream home
        </p>
      </div>

      {/* Properties Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <Skeleton className="h-48 rounded-t-lg" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">No properties available</h2>
          <p className="text-gray-500 mt-2">
            Check back later for new listings
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card key={property.id} className="overflow-hidden">
              <div className="relative h-48 bg-gray-200">
                {property.imageUrl ? (
                  <Image
                    src={property.imageUrl}
                    alt={property.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-4xl">🏠</span>
                  </div>
                )}
                <Badge className="absolute top-2 right-2">
                  {property.status}
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="line-clamp-1">{property.name}</CardTitle>
                <CardDescription className="line-clamp-1">
                  {property.city}, {property.state}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {property.description || 'No description available'}
                </p>
              </CardContent>
              <CardFooter>
                <Link href={`/properties/${property.id}`} className="w-full">
                  <Button className="w-full">View Details</Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PropertiesPage() {
  return (
    <ProtectedRoute>
      <PropertiesContent />
    </ProtectedRoute>
  );
}

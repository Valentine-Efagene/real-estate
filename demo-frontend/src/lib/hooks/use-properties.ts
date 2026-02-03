import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyApi, mortgageApi } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';

// Types (aligned with Prisma schema)
export interface Property {
  id: string;
  title: string;
  description?: string;
  category: string; // SALE, RENT, LEASE
  propertyType: string;
  country: string;
  currency: string;
  city: string;
  district?: string;
  zipCode?: string;
  streetAddress?: string;
  longitude?: number;
  latitude?: number;
  status: string; // DRAFT, PUBLISHED, etc.
  displayImageId?: string;
  displayImage?: {
    id: string;
    url: string;
  };
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  // Optional eager-loaded relations
  variants?: PropertyVariant[];
}

export interface PropertyVariant {
  id: string;
  propertyId: string;
  name: string;
  description?: string;
  nBedrooms?: number;
  nBathrooms?: number;
  nParkingSpots?: number;
  area?: number; // sqm
  price: number;
  pricePerSqm?: number;
  totalUnits: number;
  availableUnits: number;
  status: string;
}

export interface PropertyUnit {
  id: string;
  variantId: string;
  unitNumber: string;
  floorNumber?: number;
  blockName?: string;
  status: string; // AVAILABLE, RESERVED, SOLD, LOCKED
  priceOverride?: number;
  areaOverride?: number;
  notes?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: string; // FULL_PAYMENT, INSTALLMENT, MORTGAGE
  downPaymentPercentage: number;
  mortgagePercentage?: number;
  interestRate?: number;
  termMonths?: number;
  description: string;
}

// Hooks
export function useProperties(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.properties.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.set(key, String(value));
          }
        });
      }
      const endpoint = `/property/properties${params.toString() ? `?${params}` : ''}`;
      const response = await propertyApi.get<{ items: Property[]; total: number }>(endpoint);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch properties');
      }
      return response.data!;
    },
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: queryKeys.properties.detail(id),
    queryFn: async () => {
      const response = await propertyApi.get<Property>(`/property/properties/${id}`);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch property');
      }
      return response.data!;
    },
    enabled: !!id,
  });
}

export function usePropertyVariants(propertyId: string) {
  return useQuery({
    queryKey: queryKeys.properties.variants(propertyId),
    queryFn: async () => {
      const response = await propertyApi.get<PropertyVariant[]>(
        `/property/properties/${propertyId}/variants`
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch variants');
      }
      return response.data!;
    },
    enabled: !!propertyId,
  });
}

export function usePropertyUnits(propertyId: string, variantId: string) {
  return useQuery({
    queryKey: queryKeys.properties.units(propertyId, variantId),
    queryFn: async () => {
      const response = await propertyApi.get<PropertyUnit[]>(
        `/property/properties/${propertyId}/variants/${variantId}/units`
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch units');
      }
      return response.data!;
    },
    enabled: !!propertyId && !!variantId,
  });
}

export function usePaymentMethods(propertyId: string) {
  return useQuery({
    queryKey: queryKeys.properties.paymentMethods(propertyId),
    queryFn: async () => {
      const response = await mortgageApi.get<PaymentMethod[]>(
        `/payment-methods/property/${propertyId}`
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch payment methods');
      }
      return response.data!;
    },
    enabled: !!propertyId,
  });
}

// Admin mutations
export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Property>) => {
      const response = await propertyApi.post<Property>('/property/properties', data);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create property');
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Property> }) => {
      const response = await propertyApi.put<Property>(`/property/properties/${id}`, data);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update property');
      }
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.detail(variables.id) });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await propertyApi.delete(`/property/properties/${id}`);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete property');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all });
    },
  });
}

export function usePublishProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await propertyApi.patch<Property>(`/property/properties/${id}/publish`, {});
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to publish property');
      }
      return response.data!;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.detail(id) });
    },
  });
}

export function useUnpublishProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await propertyApi.patch<Property>(`/property/properties/${id}/unpublish`, {});
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to unpublish property');
      }
      return response.data!;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.detail(id) });
    },
  });
}

// Variant mutations
export interface CreateVariantInput {
  name: string;
  description?: string;
  nBedrooms?: number;
  nBathrooms?: number;
  nParkingSpots?: number;
  area?: number;
  price: number;
  pricePerSqm?: number;
  totalUnits?: number;
}

export function useCreateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, data }: { propertyId: string; data: CreateVariantInput }) => {
      const response = await propertyApi.post<PropertyVariant>(
        `/property/properties/${propertyId}/variants`,
        data
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create variant');
      }
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.variants(variables.propertyId) });
    },
  });
}

export function useDeleteVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, variantId }: { propertyId: string; variantId: string }) => {
      const response = await propertyApi.delete(
        `/property/properties/${propertyId}/variants/${variantId}`
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete variant');
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.variants(variables.propertyId) });
    },
  });
}

// Unit mutations
export interface CreateUnitInput {
  unitNumber: string;
  floorNumber?: number;
  blockName?: string;
  priceOverride?: number;
  areaOverride?: number;
  notes?: string;
  status?: string;
}

export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, variantId, data }: { propertyId: string; variantId: string; data: CreateUnitInput }) => {
      const response = await propertyApi.post<PropertyUnit>(
        `/property/properties/${propertyId}/variants/${variantId}/units`,
        data
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create unit');
      }
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.units(variables.propertyId, variables.variantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.variants(variables.propertyId) });
    },
  });
}

export function useDeleteUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, variantId, unitId }: { propertyId: string; variantId: string; unitId: string }) => {
      const response = await propertyApi.delete(
        `/property/properties/${propertyId}/variants/${variantId}/units/${unitId}`
      );
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete unit');
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.units(variables.propertyId, variables.variantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.variants(variables.propertyId) });
    },
  });
}


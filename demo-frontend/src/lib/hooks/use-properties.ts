import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyApi } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';

// Types (simplified - would import from shared package)
export interface Property {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  country: string;
  status: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyVariant {
  id: string;
  propertyId: string;
  name: string;
  description: string;
  bedrooms: number;
  bathrooms: number;
  squareMeters: number;
  parkingSpaces: number;
  basePrice: number;
  currency: string;
  imageUrl?: string;
}

export interface PropertyUnit {
  id: string;
  variantId: string;
  unitNumber: string;
  floor: number;
  block: string;
  status: string; // AVAILABLE, RESERVED, SOLD
  price: number;
  currency: string;
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
      const endpoint = `/properties${params.toString() ? `?${params}` : ''}`;
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
      const response = await propertyApi.get<Property>(`/properties/${id}`);
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
        `/properties/${propertyId}/variants`
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
        `/properties/${propertyId}/variants/${variantId}/units`
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
      const response = await propertyApi.get<PaymentMethod[]>(
        `/properties/${propertyId}/payment-methods`
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
      const response = await propertyApi.post<Property>('/properties', data);
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

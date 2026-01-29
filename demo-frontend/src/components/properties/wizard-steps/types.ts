export interface PropertyFormData {
  title: string;
  description: string;
  category: string;
  propertyType: string;
  country: string;
  currency: string;
  city: string;
  district: string;
  zipCode: string;
  streetAddress: string;
  longitude: number | null;
  latitude: number | null;
}

export interface MediaFile {
  id: string; // Local ID for React keys
  file?: File; // Original file (before upload)
  key?: string; // S3 key (after upload)
  downloadUrl?: string; // S3 download URL
  type: 'IMAGE' | 'VIDEO' | 'FLOOR_PLAN' | '3D_TOUR';
  caption?: string;
  order: number;
  uploadProgress?: number;
  isUploading?: boolean;
  error?: string;
}

export interface VariantFormData {
  id: string; // Local ID for React keys (before creation)
  name: string;
  description?: string;
  nBedrooms?: number;
  nBathrooms?: number;
  nParkingSpots?: number;
  area?: number;
  price: number;
  pricePerSqm?: number;
  totalUnits: number;
  amenities?: string[]; // Amenity IDs
  media?: MediaFile[];
}

export interface UnitFormData {
  id: string; // Local ID
  unitNumber: string;
  floorNumber?: number;
  blockName?: string;
  priceOverride?: number;
  areaOverride?: number;
  notes?: string;
  status: string;
}

export interface WizardData {
  property: PropertyFormData;
  media: MediaFile[];
  displayImageKey?: string;
  variants: VariantFormData[];
  units: Record<string, UnitFormData[]>; // variantId -> units[]
  initialStatus: 'DRAFT' | 'PUBLISHED';
}

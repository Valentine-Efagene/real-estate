export enum DocumentStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  DECLINED = 'DECLINED',
}

export enum Status {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  DECLINED = 'DECLINED',
}

export class CreateDocumentDto {
  url: string;
  name?: string;
  description?: string;
  size?: number;
}

export class UpdateDocumentDto {
  url?: string;
  name?: string;
  description?: string;
}

export class UpdateDocumentStatusDto {
  status: DocumentStatus;
  comment?: string;
}

export class DocumentReuploadDto {
  url: string;
}

export class PaginatedData {
  total: number;

  totalPages: number;

  currentPage: number;
}

export enum Frequency {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  ONE_TIME = 'ONE_TIME',
  DAILY = 'DAILY',
}

export enum ResponseMessage {
  CREATED = 'Created successfully',
  UPDATED = 'Updated successfully',
  DELETED = 'Deleted successfully',
  FETCHED = 'Fetched successfully',
  SUCCESS = 'Operation successful',
  ERROR = 'An error occurred',
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  NGN = 'NGN',
}
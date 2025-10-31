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

export interface IDocument {
  url: string;
  name: string;
  description: string;
}

export class PaginatedData {
  total: number;

  totalPages: number;

  currentPage: number;
}
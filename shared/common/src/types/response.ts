export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Standard paginated response structure.
 * Use this for all list endpoints that support pagination.
 * 
 * @example
 * ```typescript
 * const response: PaginatedResponse<User> = {
 *   items: users,
 *   pagination: { page: 1, limit: 20, total: 100, totalPages: 5 }
 * };
 * ```
 */
export interface PaginatedResponse<T = any> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Helper to create a paginated response
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number = 1,
  limit: number = 20
): PaginatedResponse<T> {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message };
}

export function errorResponse(error: string): ApiResponse {
  return { success: false, error };
}

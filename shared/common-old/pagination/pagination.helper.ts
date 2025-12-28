import { PaginatedResponse, PaginationQuery } from './pagination.types';

export class PaginationHelper {
    /**
     * Creates a paginated response object
     */
    static paginate<T>(
        items: T[],
        total: number,
        query: PaginationQuery
    ): PaginatedResponse<T> {
        const page = Math.max(1, query.page || 1);
        const limit = this.getLimit(query.limit);
        const totalPages = Math.ceil(total / limit);

        return {
            data: items,
            meta: {
                total,
                page,
                limit,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }

    /**
     * Calculate the number of records to skip for pagination
     */
    static getSkip(page?: number, limit?: number): number {
        const actualPage = Math.max(1, page || 1);
        const actualLimit = this.getLimit(limit);
        return (actualPage - 1) * actualLimit;
    }

    /**
     * Get validated limit (min: 1, max: 100, default: 10)
     */
    static getLimit(limit?: number): number {
        return Math.min(100, Math.max(1, limit || 10));
    }

    /**
     * Parse and validate pagination query parameters
     */
    static parseQuery(query: any): PaginationQuery {
        return {
            page: query.page ? parseInt(query.page, 10) : 1,
            limit: query.limit ? parseInt(query.limit, 10) : 10,
            sortBy: query.sortBy || 'id',
            sortOrder: query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
            search: query.search || undefined,
        };
    }
}

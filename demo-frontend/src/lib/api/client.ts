import { env } from '@/lib/env';
import type { ApiResponse } from '@/lib/auth/types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface FetchOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Base API client that handles authentication via httpOnly cookies.
 * For client-side calls, requests go through Next.js API routes that proxy to backend.
 * For server-side calls, we can call backend directly with the token.
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {} } = options;

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      credentials: 'include', // Include cookies
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: 'API_ERROR',
            message: data.message || 'Request failed',
          },
        };
      }

      return data;
    } catch (error) {
      console.error(`API error (${method} ${endpoint}):`, error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred',
        },
      };
    }
  }

  get<T>(endpoint: string, headers?: Record<string, string>) {
    return this.fetch<T>(endpoint, { method: 'GET', headers });
  }

  post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>) {
    return this.fetch<T>(endpoint, { method: 'POST', body, headers });
  }

  put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>) {
    return this.fetch<T>(endpoint, { method: 'PUT', body, headers });
  }

  patch<T>(endpoint: string, body?: unknown, headers?: Record<string, string>) {
    return this.fetch<T>(endpoint, { method: 'PATCH', body, headers });
  }

  delete<T>(endpoint: string, headers?: Record<string, string>) {
    return this.fetch<T>(endpoint, { method: 'DELETE', headers });
  }
}

// Client instances for each service
// These call backend APIs via Next.js proxy routes for client-side
// to ensure httpOnly cookies are properly forwarded
export const userApi = new ApiClient('/api/proxy/user');
export const propertyApi = new ApiClient('/api/proxy/property');
export const mortgageApi = new ApiClient('/api/proxy/mortgage');
export const documentsApi = new ApiClient('/api/proxy/documents');
export const paymentApi = new ApiClient('/api/proxy/payment');
export const uploaderApi = new ApiClient('/api/proxy/uploader');

/**
 * Server-side API client factory
 * Creates clients that call backend directly with auth token
 */
export function createServerApiClient(baseUrl: string, accessToken: string) {
  return {
    get: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return response.json();
    },
    post: async <T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return response.json();
    },
  };
}

// Server-side client factories
export function createUserApiServer(accessToken: string) {
  return createServerApiClient(env.userServiceUrl, accessToken);
}

export function createPropertyApiServer(accessToken: string) {
  return createServerApiClient(env.propertyServiceUrl, accessToken);
}

export function createMortgageApiServer(accessToken: string) {
  return createServerApiClient(env.mortgageServiceUrl, accessToken);
}

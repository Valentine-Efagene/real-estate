/**
 * JWT payload structure from QShelter backend
 */
export interface JwtPayload {
  sub: string;           // userId
  email: string;
  roles: string[];       // e.g., ['admin', 'user']
  tenantId: string;
  jti: string;           // unique token ID
  iat: number;           // issued at
  exp: number;           // expiration
}

/**
 * User session stored in auth context
 */
export interface UserSession {
  userId: string;
  email: string;
  roles: string[];
  tenantId: string;
  expiresAt: number;
}

/**
 * Auth response from login/refresh
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * User roles enum matching backend
 */
export type UserRole =
  | 'admin'
  | 'user'
  | 'mortgage_ops'
  | 'finance'
  | 'legal'
  | 'lender'
  | 'developer';

/**
 * Check if user has a specific role
 */
export function hasRole(roles: string[], role: UserRole): boolean {
  return roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(roles: string[], requiredRoles: UserRole[]): boolean {
  return requiredRoles.some((role) => roles.includes(role));
}

/**
 * Check if user is admin
 */
export function isAdmin(roles: string[]): boolean {
  return hasRole(roles, 'admin');
}

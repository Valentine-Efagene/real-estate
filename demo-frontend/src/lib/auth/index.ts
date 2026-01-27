// Client-safe exports only
export { AuthProvider, useAuth } from './auth-context';
export type { JwtPayload, UserSession, AuthResponse, ApiResponse, UserRole } from './types';
export { hasRole, hasAnyRole, isAdmin } from './types';

// Server-only utilities should be imported directly from './session'
// e.g., import { getSession } from '@/lib/auth/session'

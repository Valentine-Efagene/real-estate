'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { UserSession, UserRole } from './types';
import { hasRole, hasAnyRole, isAdmin } from './types';

interface AuthContextValue {
  user: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialSession?: UserSession | null;
}

export function AuthProvider({ children, initialSession = null }: AuthProviderProps) {
  const [user, setUser] = useState<UserSession | null>(initialSession);
  const [isLoading, setIsLoading] = useState(!initialSession);
  const router = useRouter();

  // Fetch current session on mount
  useEffect(() => {
    if (!initialSession) {
      fetchSession();
    }
  }, [initialSession]);

  // Proactive token refresh - refresh before expiry
  useEffect(() => {
    if (!user?.expiresAt) return;

    const refreshBeforeExpiry = async () => {
      console.log('[Auth] Proactive token refresh triggered');
      const success = await refreshInternal();
      if (!success) {
        console.warn('[Auth] Proactive refresh failed, user will need to log in again');
        // Don't immediately redirect - let the next API call trigger the redirect
      }
    };

    // Calculate time until we should refresh (2 minutes before expiry for safety)
    const now = Date.now();
    const expiresAt = user.expiresAt;
    const refreshBuffer = 2 * 60 * 1000; // 2 minutes before expiry
    const timeUntilRefresh = Math.max(0, expiresAt - now - refreshBuffer);

    console.log(`[Auth] Token expires at ${new Date(expiresAt).toISOString()}, refresh in ${Math.round(timeUntilRefresh / 1000)}s`);

    // Set timeout to refresh before expiry
    const timeoutId = setTimeout(refreshBeforeExpiry, timeUntilRefresh);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [user?.expiresAt]);

  // Listen for session expired events from API calls
  useEffect(() => {
    const handleSessionExpired = () => {
      console.log('[Auth] Session expired event received');
      setUser(null);
      router.push('/login?reason=session_expired');
    };

    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, [router]);

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshInternal = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('[Auth] Token refresh error:', error);
      return false;
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const refresh = useCallback(async (): Promise<boolean> => {
    return refreshInternal();
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refresh,
    hasRole: (role) => user ? hasRole(user.roles, role) : false,
    hasAnyRole: (roles) => user ? hasAnyRole(user.roles, roles) : false,
    isAdmin: user ? isAdmin(user.roles) : false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

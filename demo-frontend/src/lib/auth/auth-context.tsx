'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserSession, UserRole } from './types';
import { hasRole, hasAnyRole, isAdmin } from './types';

interface AuthContextValue {
  user: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
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
      try {
        const response = await fetch('/api/auth/refresh', { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // Token refresh failed, user will be logged out on next protected action
          console.warn('Token refresh failed');
        }
      } catch (error) {
        console.error('Token refresh error:', error);
      }
    };

    // Calculate time until we should refresh (1 minute before expiry)
    const now = Date.now();
    const expiresAt = user.expiresAt;
    const refreshBuffer = 60 * 1000; // 1 minute before expiry
    const timeUntilRefresh = Math.max(0, expiresAt - now - refreshBuffer);

    // Set timeout to refresh before expiry
    const timeoutId = setTimeout(refreshBeforeExpiry, timeUntilRefresh);

    // Also set up periodic refresh every 14 minutes as a fallback
    const intervalId = setInterval(refreshBeforeExpiry, 14 * 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [user?.expiresAt]);

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
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
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

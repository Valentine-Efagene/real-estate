'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/auth/types';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
  redirectTo?: string;
}

/**
 * Wrapper component that protects routes requiring authentication
 * Redirects to login if not authenticated
 * Optionally checks for specific roles
 */
export function ProtectedRoute({
  children,
  roles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Not authenticated - redirect to login (not /unauthorized)
      router.push(`${redirectTo}?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, redirectTo]);

  useEffect(() => {
    // Only check roles if user is authenticated AND has roles to check
    if (!isLoading && isAuthenticated && user && roles && roles.length > 0) {
      const hasRequiredRole = roles.some((role) => user?.roles.includes(role));
      if (!hasRequiredRole) {
        // User is authenticated but doesn't have required role - show error toast
        // but stay on current page or redirect to home, not /unauthorized
        router.push('/');
      }
    }
  }, [isLoading, isAuthenticated, user, roles, router]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!isAuthenticated) {
    return <LoadingSkeleton />;
  }

  if (roles && roles.length > 0) {
    const hasRequiredRole = roles.some((role) => user?.roles.includes(role));
    if (!hasRequiredRole) {
      return <LoadingSkeleton />;
    }
  }

  return <>{children}</>;
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

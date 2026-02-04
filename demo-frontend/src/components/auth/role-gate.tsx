'use client';

import { type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/lib/auth/types';

interface RoleGateProps {
  children: ReactNode;
  role?: UserRole;
  roles?: UserRole[];
  fallback?: ReactNode;
  requireAll?: boolean; // If true, user must have ALL roles (default: any role matches)
}

/**
 * Component that conditionally renders children based on user roles
 * 
 * @example
 * // Single role check
 * <RoleGate role="admin">
 *   <AdminPanel />
 * </RoleGate>
 * 
 * @example
 * // Multiple roles (any match)
 * <RoleGate roles={['admin', 'mortgage_ops']}>
 *   <ApplicationReview />
 * </RoleGate>
 * 
 * @example
 * // With fallback
 * <RoleGate role="admin" fallback={<AccessDenied />}>
 *   <AdminPanel />
 * </RoleGate>
 */
export function RoleGate({
  children,
  role,
  roles,
  fallback = null,
  requireAll = false,
}: RoleGateProps) {
  const { user, isLoading } = useAuth();

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  // No user = no access
  if (!user) {
    return <>{fallback}</>;
  }

  const requiredRoles = roles || (role ? [role] : []);

  // If no roles specified, allow all authenticated users
  if (requiredRoles.length === 0) {
    return <>{children}</>;
  }

  const hasAccess = requireAll
    ? requiredRoles.every((r) => user.roles.includes(r))
    : requiredRoles.some((r) => user.roles.includes(r));

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Admin-only content wrapper
 */
export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate role="admin" fallback={fallback}>
      {children}
    </RoleGate>
  );
}

/**
 * Staff-only content (admin, mortgage_ops, finance, legal, lender_ops, agent)
 * These are staff who can view and act on applications
 */
export function StaffOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate roles={['admin', 'mortgage_ops', 'finance', 'legal', 'lender_ops', 'agent']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

/**
 * Lender-only content (bank staff)
 */
export function LenderOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate roles={['lender', 'lender_ops', 'admin']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

/**
 * Developer-only content
 */
export function DeveloperOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <RoleGate roles={['developer', 'admin']} fallback={fallback}>
      {children}
    </RoleGate>
  );
}

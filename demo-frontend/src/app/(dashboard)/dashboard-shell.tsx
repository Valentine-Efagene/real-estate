'use client';

import type { ReactNode } from 'react';
import { OnboardingGate } from '@/components/auth';

/**
 * Client-side wrapper for the dashboard that applies the onboarding gate.
 * Org staff whose organization has incomplete onboarding are blocked or
 * redirected (if they're the assigned onboarder).
 */
export function DashboardShell({ children }: { children: ReactNode }) {
    return <OnboardingGate>{children}</OnboardingGate>;
}

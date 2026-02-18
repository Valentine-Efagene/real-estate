'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useUserProfile } from '@/lib/hooks/use-organizations';
import { Building2, Clock, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface OnboardingGateProps {
    children: ReactNode;
}

/**
 * Gate that blocks organization staff from using the platform until
 * their organization's onboarding is completed.
 *
 * - Admins bypass the gate entirely
 * - Platform org staff bypass the gate
 * - If the user is the assigned onboarder → redirect to the onboarding page
 * - Other org staff → shown a "pending onboarding" message
 */
export function OnboardingGate({ children }: OnboardingGateProps) {
    const { user, isLoading: authLoading } = useAuth();
    const { data: profile, isLoading: profileLoading } = useUserProfile();
    const router = useRouter();
    const pathname = usePathname();

    // Find the first org with incomplete onboarding (not COMPLETED)
    const pendingOnboarding = profile?.organizationMemberships?.find((m) => {
        const org = m.organization;
        // Skip platform orgs — their staff manage the platform itself
        const isPlatformOrg = org.types?.some(
            (t) => t.orgType?.code === 'PLATFORM',
        );
        if (isPlatformOrg) return false;

        // Check if org has an onboarding that's not completed
        const onboarding = org.onboarding;
        if (!onboarding) return false;

        return (
            onboarding.status === 'PENDING' ||
            onboarding.status === 'IN_PROGRESS'
        );
    });

    const isOnboarder =
        pendingOnboarding?.organization.onboarding?.assigneeId === user?.userId;
    const onboardingOrgId = pendingOnboarding?.organization.id;
    const onboardingPath = onboardingOrgId
        ? `/admin/organizations/${onboardingOrgId}/onboarding`
        : null;

    // If the user is the onboarder, redirect them to the onboarding page
    const isAlreadyOnOnboardingPage =
        onboardingPath && pathname.startsWith(onboardingPath);

    useEffect(() => {
        if (
            isOnboarder &&
            onboardingPath &&
            !isAlreadyOnOnboardingPage &&
            !authLoading &&
            !profileLoading
        ) {
            router.replace(onboardingPath);
        }
    }, [
        isOnboarder,
        onboardingPath,
        isAlreadyOnOnboardingPage,
        authLoading,
        profileLoading,
        router,
    ]);

    // Still loading auth or profile — show nothing yet
    if (authLoading || profileLoading) {
        return null;
    }

    // No user session — let ProtectedRoute handle redirect
    if (!user) {
        return <>{children}</>;
    }

    // Admins always pass through
    if (user.roles.includes('admin')) {
        return <>{children}</>;
    }

    // No pending onboarding for the user's orgs — pass through
    if (!pendingOnboarding) {
        return <>{children}</>;
    }

    // User IS the onboarder and is on the onboarding page — let them through
    if (isOnboarder && isAlreadyOnOnboardingPage) {
        return <>{children}</>;
    }

    // User IS the onboarder but not yet redirected — show loading while redirect happens
    if (isOnboarder) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    <p className="text-sm text-muted-foreground">
                        Redirecting to onboarding...
                    </p>
                </div>
            </div>
        );
    }

    // User is NOT the onboarder — show a blocked state
    const orgName = pendingOnboarding.organization.name;
    const onboardingStatus =
        pendingOnboarding.organization.onboarding?.status || 'PENDING';

    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="mx-auto max-w-lg text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                    <Building2 className="h-8 w-8 text-amber-600" />
                </div>

                <h2 className="mt-6 text-2xl font-semibold text-gray-900">
                    Organization Onboarding in Progress
                </h2>

                <p className="mt-3 text-gray-600">
                    <span className="font-medium">{orgName}</span> is currently
                    being onboarded to the QShelter platform. You&apos;ll have
                    full access once the onboarding process is complete.
                </p>

                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-amber-800">
                        Status:{' '}
                        {onboardingStatus === 'PENDING'
                            ? 'Waiting to Start'
                            : 'In Progress'}
                    </span>
                </div>

                <p className="mt-6 text-sm text-gray-500">
                    If you believe this is an error, please contact your
                    organization administrator or QShelter support.
                </p>

                {onboardingPath && (
                    <Button asChild variant="outline" className="mt-4">
                        <Link href={onboardingPath}>
                            View Onboarding Status
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                )}
            </div>
        </div>
    );
}

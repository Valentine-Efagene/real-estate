'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Users, UserCircle, Loader2 } from 'lucide-react';
import { userApi } from '@/lib/api/client';

// Default password for all demo users
const DEMO_PASSWORD = 'password';

// Role color mapping
const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-500',
    user: 'bg-green-500',
    mortgage_ops: 'bg-blue-500',
    finance: 'bg-amber-500',
    legal: 'bg-indigo-500',
    agent: 'bg-teal-500',
    lender_ops: 'bg-orange-500',
};

interface UserRole {
    role: {
        id: string;
        name: string;
    };
}

interface UserFromApi {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    isActive: boolean;
    isEmailVerified: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
    userRoles: UserRole[];
}

interface UsersResponse {
    data: UserFromApi[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export function PersonaSwitcher() {
    const { user, login, logout, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [switching, setSwitching] = useState(false);
    const [switchingTo, setSwitchingTo] = useState<string | null>(null);

    // Fetch users from the API
    const { data: usersResponse, isLoading: usersLoading } = useQuery({
        queryKey: ['users-for-switcher'],
        queryFn: async () => {
            const response = await userApi.get<UsersResponse>('/users?limit=50');
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch users');
            }
            return response.data;
        },
        enabled: !!user, // Only fetch when logged in
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    const users = usersResponse?.data || [];

    const getPrimaryRole = (userRoles: UserRole[]): string => {
        if (!userRoles || userRoles.length === 0) return 'user';
        // Prefer 'admin' role, otherwise take the first one
        const adminRole = userRoles.find(ur => ur.role.name === 'admin');
        return adminRole ? 'admin' : userRoles[0].role.name;
    };

    const getRoleColor = (roleName: string): string => {
        return ROLE_COLORS[roleName] || 'bg-gray-500';
    };

    const formatRoleName = (roleName: string): string => {
        return roleName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleSwitch = async (targetUser: UserFromApi) => {
        if (targetUser.email === user?.email) return;

        setSwitching(true);
        setSwitchingTo(targetUser.firstName);

        try {
            // Logout current user (skipRedirect to avoid navigating to / during switch)
            if (user) {
                await logout({ skipRedirect: true });
            }

            // Login as new persona with the demo password
            await login(targetUser.email, DEMO_PASSWORD);

            // Redirect based on role
            const primaryRole = getPrimaryRole(targetUser.userRoles);
            if (primaryRole === 'admin') {
                router.push('/admin/applications');
            } else {
                router.push('/dashboard');
            }
        } catch (error) {
            console.error('Failed to switch persona:', error);
        } finally {
            setSwitching(false);
            setSwitchingTo(null);
        }
    };

    if (authLoading) {
        return null;
    }

    const currentUserName = user ? user.email : 'Personas';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={switching}>
                    {switching ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Switching to {switchingTo}...
                        </>
                    ) : (
                        <>
                            <Users className="h-4 w-4" />
                            {currentUserName}
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Switch Demo Persona</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {usersLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading users...</span>
                    </div>
                ) : users.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                        No users found. Create demo users to enable switching.
                    </div>
                ) : (
                    users.map(u => {
                        const isActive = u.email === user?.email;
                        const allRoles = u.userRoles?.map(ur => ur.role.name) || [];

                        return (
                            <DropdownMenuItem
                                key={u.id}
                                onClick={() => handleSwitch(u)}
                                disabled={isActive || switching}
                                className="flex items-start gap-3 py-2"
                            >
                                <UserCircle
                                    className={`h-5 w-5 mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                                />
                                <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`truncate ${isActive ? 'font-medium' : ''}`}>
                                            {u.firstName} {u.lastName}
                                        </span>
                                        {isActive && <span className="text-xs text-green-600 shrink-0">Active</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                        {allRoles.length > 0 ? (
                                            allRoles.map(roleName => (
                                                <Badge
                                                    key={roleName}
                                                    variant="secondary"
                                                    className={`${getRoleColor(roleName)} text-white text-[10px] leading-tight px-1.5 py-0`}
                                                >
                                                    {formatRoleName(roleName)}
                                                </Badge>
                                            ))
                                        ) : (
                                            <Badge variant="secondary" className="bg-gray-500 text-white text-[10px] leading-tight px-1.5 py-0">
                                                User
                                            </Badge>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</span>
                                </div>
                            </DropdownMenuItem>
                        );
                    })
                )}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Quick-switch between users. Default password: <code className="bg-muted px-1 rounded">{DEMO_PASSWORD}</code>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

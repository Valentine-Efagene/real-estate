'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { userApi } from '@/lib/api/client';
import { User, Lock, Mail, Phone, Shield, Loader2, Eye, EyeOff } from 'lucide-react';

interface PasswordFormData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

interface ProfileFormData {
    firstName: string;
    lastName: string;
    phone: string;
}

interface UserProfile {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatar: string | null;
    isActive: boolean;
    isEmailVerified: boolean;
    createdAt: string;
    updatedAt: string;
    userRoles: Array<{
        role: {
            id: string;
            name: string;
        };
    }>;
}

function ProfileContent() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Fetch full user profile from API
    const { data: profileResponse, isLoading: isLoadingProfile } = useQuery({
        queryKey: ['user-profile', user?.userId],
        queryFn: async () => {
            const response = await userApi.get<UserProfile>(`/users/${user?.userId}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch profile');
            }
            return response.data;
        },
        enabled: !!user?.userId,
    });

    const profile = profileResponse;
    const roles = profile?.userRoles?.map((ur) => ur.role.name) || [];

    // Profile form state
    const [profileData, setProfileData] = useState<ProfileFormData>({
        firstName: '',
        lastName: '',
        phone: '',
    });

    // Update form when profile loads
    useEffect(() => {
        if (profile) {
            setProfileData({
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                phone: profile.phone || '',
            });
        }
    }, [profile]);

    // Password form state
    const [passwordData, setPasswordData] = useState<PasswordFormData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Profile update mutation
    const updateProfileMutation = useMutation({
        mutationFn: async (data: ProfileFormData) => {
            const response = await userApi.patch('/users/profile', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to update profile');
            }
            return response.data;
        },
        onSuccess: () => {
            toast.success('Profile updated successfully');
            queryClient.invalidateQueries({ queryKey: ['user-profile'] });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update profile');
        },
    });

    // Password change mutation
    const changePasswordMutation = useMutation({
        mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
            const response = await userApi.post('/users/change-password', data);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to change password');
            }
            return response.data;
        },
        onSuccess: () => {
            toast.success('Password changed successfully');
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to change password');
        },
    });

    const handleProfileUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfileMutation.mutate(profileData);
    };

    const handlePasswordChange = (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 8) {
            toast.error('New password must be at least 8 characters');
            return;
        }

        changePasswordMutation.mutate({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword,
        });
    };

    const getRoleBadgeColor = (roleName: string) => {
        const colors: Record<string, string> = {
            admin: 'bg-purple-500',
            user: 'bg-green-500',
            mortgage_ops: 'bg-blue-500',
            finance: 'bg-amber-500',
            legal: 'bg-indigo-500',
            agent: 'bg-teal-500',
            lender_ops: 'bg-orange-500',
        };
        return colors[roleName] || 'bg-gray-500';
    };

    const formatRoleName = (roleName: string) => {
        return roleName
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
                <p className="text-muted-foreground">Manage your account settings and password</p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="profile" className="gap-2">
                        <User className="h-4 w-4" />
                        Profile
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-2">
                        <Lock className="h-4 w-4" />
                        Security
                    </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-6">
                    {/* Account Overview Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Account Overview
                            </CardTitle>
                            <CardDescription>Your account information and roles</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isLoadingProfile ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-6 w-48" />
                                    <Skeleton className="h-6 w-32" />
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label className="text-muted-foreground text-sm">Email</Label>
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{profile?.email}</span>
                                                {profile?.isEmailVerified && (
                                                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                                                        Verified
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-muted-foreground text-sm">Phone</Label>
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{profile?.phone || 'Not set'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-sm">Roles</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {roles.length > 0 ? (
                                                roles.map((role) => (
                                                    <Badge key={role} className={`${getRoleBadgeColor(role)} text-white`}>
                                                        {formatRoleName(role)}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-muted-foreground text-sm">No roles assigned</span>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Edit Profile Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Edit Profile</CardTitle>
                            <CardDescription>Update your personal information</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleProfileUpdate} className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First Name</Label>
                                        <Input
                                            id="firstName"
                                            value={profileData.firstName}
                                            onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                                            placeholder="Enter your first name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last Name</Label>
                                        <Input
                                            id="lastName"
                                            value={profileData.lastName}
                                            onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                                            placeholder="Enter your last name"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input
                                        id="phone"
                                        value={profileData.phone}
                                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                        placeholder="Enter your phone number"
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={updateProfileMutation.isPending}>
                                        {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security Tab */}
                <TabsContent value="security" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                Change Password
                            </CardTitle>
                            <CardDescription>
                                Update your password to keep your account secure
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordChange} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="currentPassword">Current Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="currentPassword"
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={passwordData.currentPassword}
                                            onChange={(e) =>
                                                setPasswordData({ ...passwordData, currentPassword: e.target.value })
                                            }
                                            placeholder="Enter your current password"
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        >
                                            {showCurrentPassword ? (
                                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="newPassword">New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="newPassword"
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={passwordData.newPassword}
                                            onChange={(e) =>
                                                setPasswordData({ ...passwordData, newPassword: e.target.value })
                                            }
                                            placeholder="Enter your new password"
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            {showNewPassword ? (
                                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Password must be at least 8 characters long
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={passwordData.confirmPassword}
                                            onChange={(e) =>
                                                setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                                            }
                                            placeholder="Confirm your new password"
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? (
                                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={
                                            changePasswordMutation.isPending ||
                                            !passwordData.currentPassword ||
                                            !passwordData.newPassword ||
                                            !passwordData.confirmPassword
                                        }
                                    >
                                        {changePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Change Password
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Security Tips */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Security Tips</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500">✓</span>
                                    Use a strong password with a mix of letters, numbers, and symbols
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500">✓</span>
                                    Never share your password with anyone
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500">✓</span>
                                    Use a unique password for each of your accounts
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500">✓</span>
                                    Change your password regularly
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <ProfileContent />
        </ProtectedRoute>
    );
}

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Clock, Building2 } from 'lucide-react';

interface InvitationDetails {
    email: string;
    firstName: string;
    lastName: string;
    organizationName: string;
    roleName: string;
    title?: string;
    department?: string;
    status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
    expiresAt: string;
    invitedByName?: string;
    tenantName: string;
}

function AcceptInvitationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
    const [isLoadingInvitation, setIsLoadingInvitation] = useState(true);
    const [invitationError, setInvitationError] = useState('');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // Fetch invitation details on mount
    useEffect(() => {
        if (!token) {
            setInvitationError('No invitation token provided');
            setIsLoadingInvitation(false);
            return;
        }

        const fetchInvitation = async () => {
            try {
                const response = await fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`);
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Failed to fetch invitation');
                }

                setInvitation(data.data);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load invitation';
                setInvitationError(message);
            } finally {
                setIsLoadingInvitation(false);
            }
        };

        fetchInvitation();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        // Validate passwords match
        if (password !== confirmPassword) {
            setSubmitError('Passwords do not match');
            return;
        }

        // Validate password strength
        if (password.length < 8) {
            setSubmitError('Password must be at least 8 characters');
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(`/api/invitations/accept?token=${encodeURIComponent(token!)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, phone: phone || undefined }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to accept invitation');
            }

            toast.success(`Welcome to ${invitation?.organizationName}!`);

            // Redirect to dashboard - user is now logged in
            router.push('/dashboard');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to accept invitation';
            setSubmitError(message);
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading state
    if (isLoadingInvitation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground">Loading invitation...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Error state - no token or fetch failed
    if (invitationError || !invitation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <XCircle className="h-12 w-12 text-destructive" />
                        </div>
                        <CardTitle className="text-xl text-center text-destructive">
                            Invalid Invitation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-muted-foreground">{invitationError || 'This invitation could not be found.'}</p>
                    </CardContent>
                    <CardFooter className="justify-center">
                        <Link href="/login">
                            <Button variant="outline">Go to Login</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // Already processed states
    if (invitation.status !== 'PENDING') {
        const statusConfig = {
            ACCEPTED: {
                icon: CheckCircle2,
                color: 'text-green-600',
                title: 'Invitation Already Accepted',
                message: 'This invitation has already been accepted. Please log in to continue.',
            },
            EXPIRED: {
                icon: Clock,
                color: 'text-amber-600',
                title: 'Invitation Expired',
                message: 'This invitation has expired. Please contact the person who invited you to request a new invitation.',
            },
            CANCELLED: {
                icon: XCircle,
                color: 'text-destructive',
                title: 'Invitation Cancelled',
                message: 'This invitation has been cancelled.',
            },
        };

        const config = statusConfig[invitation.status];
        const Icon = config.icon;

        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <Icon className={`h-12 w-12 ${config.color}`} />
                        </div>
                        <CardTitle className={`text-xl text-center ${config.color}`}>
                            {config.title}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-muted-foreground">{config.message}</p>
                    </CardContent>
                    <CardFooter className="justify-center">
                        <Link href="/login">
                            <Button variant="outline">Go to Login</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // Pending invitation - show acceptance form
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <Building2 className="h-12 w-12 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">
                        Join {invitation.organizationName}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {invitation.invitedByName ? (
                            <>
                                <span className="font-medium">{invitation.invitedByName}</span> has invited you to join as{' '}
                                <span className="font-medium">{invitation.roleName}</span>
                            </>
                        ) : (
                            <>You&apos;ve been invited to join as <span className="font-medium">{invitation.roleName}</span></>
                        )}
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {submitError && (
                            <Alert variant="destructive">
                                <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                        )}

                        {/* Invitation details */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Email</span>
                                <span className="font-medium">{invitation.email}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Name</span>
                                <span className="font-medium">{invitation.firstName} {invitation.lastName}</span>
                            </div>
                            {invitation.title && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Title</span>
                                    <span className="font-medium">{invitation.title}</span>
                                </div>
                            )}
                            {invitation.department && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Department</span>
                                    <span className="font-medium">{invitation.department}</span>
                                </div>
                            )}
                        </div>

                        {/* Password field */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Create Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter a secure password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </div>

                        {/* Confirm password field */}
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="Confirm your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                        </div>

                        {/* Phone field (optional) */}
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number (Optional)</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+234 xxx xxx xxxx"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Accept Invitation & Join
                        </Button>

                        <p className="text-sm text-muted-foreground text-center">
                            Already have an account?{' '}
                            <Link href="/login" className="text-primary hover:underline">
                                Log in instead
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}

export default function AcceptInvitationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground">Loading...</p>
                    </CardContent>
                </Card>
            </div>
        }>
            <AcceptInvitationContent />
        </Suspense>
    );
}

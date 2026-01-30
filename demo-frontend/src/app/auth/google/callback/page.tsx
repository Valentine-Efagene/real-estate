'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

function GoogleCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const errorParam = searchParams.get('error');

            if (errorParam) {
                setError(`Google authentication failed: ${errorParam}`);
                return;
            }

            if (!code || !state) {
                setError('Missing authentication parameters');
                return;
            }

            try {
                const response = await fetch('/api/auth/google/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, state }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Authentication failed');
                }

                // Successful login - redirect to dashboard
                router.push('/dashboard');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Authentication failed');
            }
        };

        handleCallback();
    }, [searchParams, router]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-center text-red-600">Authentication Failed</CardTitle>
                        <CardDescription className="text-center">
                            We couldn&apos;t complete your sign in with Google
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                        <div className="text-center">
                            <a href="/login" className="text-primary hover:underline">
                                Return to login
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-center">Completing sign in...</CardTitle>
                    <CardDescription className="text-center">
                        Please wait while we authenticate your account
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function GoogleCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-center">Loading...</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center py-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </CardContent>
                </Card>
            </div>
        }>
            <GoogleCallbackContent />
        </Suspense>
    );
}

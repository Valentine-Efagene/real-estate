'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

type VerificationStatus = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<VerificationStatus>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('No verification token provided');
            return;
        }

        const verifyEmail = async () => {
            try {
                const response = await fetch(`/api/proxy/user/auth/verify-email?token=${token}`);
                const data = await response.json();

                if (response.ok && data.success) {
                    setStatus('success');
                    setMessage(data.data?.message || 'Email verified successfully!');
                } else {
                    setStatus('error');
                    setMessage(data.error?.message || data.message || 'Failed to verify email');
                }
            } catch (error) {
                setStatus('error');
                setMessage(error instanceof Error ? error.message : 'An error occurred during verification');
            }
        };

        verifyEmail();
    }, [token]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    {status === 'loading' && (
                        <>
                            <div className="flex justify-center mb-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            </div>
                            <CardTitle className="text-2xl font-bold">
                                Verifying your email...
                            </CardTitle>
                            <CardDescription>
                                Please wait while we verify your email address
                            </CardDescription>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="flex justify-center mb-4">
                                <CheckCircle2 className="h-12 w-12 text-green-600" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-green-600">
                                Email Verified!
                            </CardTitle>
                            <CardDescription>
                                Your email has been successfully verified
                            </CardDescription>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="flex justify-center mb-4">
                                <XCircle className="h-12 w-12 text-red-600" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-red-600">
                                Verification Failed
                            </CardTitle>
                            <CardDescription>
                                We couldn&apos;t verify your email address
                            </CardDescription>
                        </>
                    )}
                </CardHeader>

                <CardContent>
                    {status === 'success' && (
                        <Alert className="bg-green-50 border-green-200">
                            <AlertDescription className="text-green-800">
                                {message}
                            </AlertDescription>
                        </Alert>
                    )}

                    {status === 'error' && (
                        <Alert variant="destructive">
                            <AlertDescription>
                                {message}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col space-y-3">
                    {status === 'success' && (
                        <Button
                            className="w-full"
                            onClick={() => router.push('/login')}
                        >
                            Continue to Login
                        </Button>
                    )}

                    {status === 'error' && (
                        <>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => router.push('/register')}
                            >
                                Back to Registration
                            </Button>
                            <p className="text-sm text-gray-500 text-center">
                                Need help?{' '}
                                <Link href="/contact" className="text-primary hover:underline">
                                    Contact Support
                                </Link>
                            </p>
                        </>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}

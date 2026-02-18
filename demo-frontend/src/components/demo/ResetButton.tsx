'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clearStoredTenantId } from '@/lib/hooks/use-tenant';

interface ResetResponse {
    success: boolean;
    message?: string;
    totalDeleted?: number;
    deleted?: Record<string, number>;
    error?: string;
}

export function ResetButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ResetResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [bootstrapSecret, setBootstrapSecret] = useState('');
    const [confirmText, setConfirmText] = useState('');

    const handleReset = async () => {
        if (!bootstrapSecret) {
            setError('Bootstrap secret is required');
            return;
        }

        if (confirmText !== 'RESET') {
            setError('Type RESET to confirm');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Bootstrap-Secret': bootstrapSecret,
                },
            });

            const data: ResetResponse = await response.json();

            if (!response.ok || !data.success) {
                setError(data.error || 'Reset failed');
                return;
            }

            // Clear all local state
            clearStoredTenantId();

            setResult(data);
            setConfirmText('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            // Reset state when dialog closes
            setResult(null);
            setError(null);
            setConfirmText('');
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-red-400 text-red-600 hover:bg-red-50">
                    🗑️ Reset Database
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-red-700">Reset Database</DialogTitle>
                    <DialogDescription>
                        This will <strong className="text-red-600">delete ALL data</strong> from
                        the database — tenants, users, properties, applications, everything.
                        Use this to start fresh for testing.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Bootstrap Secret */}
                    <div className="space-y-2">
                        <Label htmlFor="resetSecret">Bootstrap Secret *</Label>
                        <Input
                            id="resetSecret"
                            type="password"
                            value={bootstrapSecret}
                            onChange={(e) => setBootstrapSecret(e.target.value)}
                            placeholder="Get from SSM: /qshelter/staging/bootstrap-secret"
                        />
                    </div>

                    {/* Confirmation */}
                    <div className="space-y-2">
                        <Label htmlFor="confirmReset">
                            Type <span className="font-mono font-bold text-red-600">RESET</span> to confirm
                        </Label>
                        <Input
                            id="confirmReset"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="RESET"
                            className="font-mono"
                        />
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {/* Success Display */}
                    {result?.success && (
                        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-sm">
                            <p className="font-medium">✅ Database reset complete!</p>
                            <p className="mt-1">
                                Deleted <strong>{result.totalDeleted}</strong> records across all tables.
                            </p>
                            <p className="mt-2 text-green-700">
                                Local session cleared. You can now{' '}
                                <button
                                    onClick={() => { handleOpenChange(false); }}
                                    className="underline font-medium"
                                >
                                    run Bootstrap
                                </button>
                                {' '}to set up fresh data.
                            </p>
                        </div>
                    )}

                    <Button
                        onClick={handleReset}
                        disabled={isLoading || !bootstrapSecret || confirmText !== 'RESET'}
                        variant="destructive"
                        className="w-full"
                    >
                        {isLoading ? 'Resetting...' : '🗑️ Reset Everything'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

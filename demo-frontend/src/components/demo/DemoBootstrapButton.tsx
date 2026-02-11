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
import { setStoredTenantId, clearStoredTenantId } from '@/lib/hooks/use-tenant';

interface DemoActor {
    name: string;
    email: string;
    role: string;
    id: string;
}

interface DemoOrg {
    name: string;
    type: string;
    status: string;
    id: string;
}

interface DemoStepResult {
    step: string;
    status: 'success' | 'error';
    detail?: string;
}

interface DemoBootstrapResponse {
    success: boolean;
    steps: DemoStepResult[];
    summary?: {
        tenantId: string;
        actors: DemoActor[];
        organizations: DemoOrg[];
        property: { title: string; id: string; variant: string; unit: string };
        paymentMethod: { name: string; id: string; phases: number };
    };
    error?: string;
}

export function DemoBootstrapButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<DemoBootstrapResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [bootstrapSecret, setBootstrapSecret] = useState('');

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            // Reset state when closing
            setResult(null);
            setError(null);
        }
    };

    const handleDemoBootstrap = async () => {
        if (!bootstrapSecret) {
            setError('Bootstrap secret is required');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            // Clear any existing session data since we're resetting everything
            clearStoredTenantId();

            const response = await fetch('/api/demo-bootstrap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Bootstrap-Secret': bootstrapSecret,
                },
            });

            const data: DemoBootstrapResponse = await response.json();

            if (!response.ok || !data.success) {
                setError(data.error || 'Demo bootstrap failed');
                // Still show partial steps if available
                if (data.steps?.length) {
                    setResult(data);
                }
                return;
            }

            // Store tenantId for use in other pages
            if (data.summary?.tenantId) {
                setStoredTenantId(data.summary.tenantId);
                console.log('[Demo Bootstrap] Stored tenantId:', data.summary.tenantId);
            }

            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setIsLoading(false);
        }
    };

    const completedSteps = result?.steps?.filter((s) => s.status === 'success').length ?? 0;
    const totalExpectedSteps = 17; // approximate

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-purple-500 text-purple-600 hover:bg-purple-50">
                    🚀 Demo Bootstrap
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Demo Bootstrap</DialogTitle>
                    <DialogDescription>
                        Sets up the <strong>complete demo environment</strong> in one click: resets the database,
                        creates 5 actors, 3 organizations (with completed onboarding), a published property,
                        and the MREIF 10/90 mortgage payment method.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Bootstrap Secret */}
                    <div className="space-y-2">
                        <Label htmlFor="demoBootstrapSecret">Bootstrap Secret *</Label>
                        <Input
                            id="demoBootstrapSecret"
                            type="password"
                            value={bootstrapSecret}
                            onChange={(e) => setBootstrapSecret(e.target.value)}
                            placeholder="Get from SSM: /qshelter/staging/bootstrap-secret"
                        />
                        <p className="text-xs text-muted-foreground">
                            Run: <code className="bg-muted px-1 rounded">aws ssm get-parameter --name /qshelter/staging/bootstrap-secret --with-decryption --query Parameter.Value --output text</code>
                        </p>
                    </div>

                    {/* Warning */}
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm">
                        <strong>⚠️ Warning:</strong> This will <strong>reset the entire database</strong> first,
                        then create all demo data. Takes ~30–60 seconds.
                    </div>

                    {/* Loading Progress */}
                    {isLoading && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="animate-spin">⏳</span>
                                Setting up demo environment... ({completedSteps}/{totalExpectedSteps} steps)
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-purple-600 h-2 rounded-full transition-all"
                                    style={{ width: `${(completedSteps / totalExpectedSteps) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {/* Steps Log (shown after completion or on error with partial steps) */}
                    {result?.steps && result.steps.length > 0 && (
                        <div className="bg-gray-50 border rounded p-3 max-h-40 overflow-y-auto">
                            <p className="text-xs font-medium text-gray-500 mb-2">Setup Log:</p>
                            {result.steps.map((s, i) => (
                                <div key={i} className="text-xs flex gap-2 py-0.5">
                                    <span>{s.status === 'success' ? '✅' : '❌'}</span>
                                    <span className="font-medium">{s.step}</span>
                                    {s.detail && <span className="text-gray-500">— {s.detail}</span>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Success Summary */}
                    {result?.success && result.summary && (
                        <div className="space-y-3">
                            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded text-sm">
                                <p className="font-bold text-base mb-1">🎉 Demo Environment Ready!</p>
                                <p>All actors, organizations, property, and payment method created.</p>
                            </div>

                            {/* Actors Table */}
                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Actors (password: <code className="bg-muted px-1 rounded">password</code>):</p>
                                <div className="border rounded text-xs">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-2 py-1 text-left">Name</th>
                                                <th className="px-2 py-1 text-left">Email</th>
                                                <th className="px-2 py-1 text-left">Role</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.summary.actors.map((a) => (
                                                <tr key={a.id} className="border-t">
                                                    <td className="px-2 py-1">{a.name}</td>
                                                    <td className="px-2 py-1 font-mono">{a.email}</td>
                                                    <td className="px-2 py-1">
                                                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{a.role}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Organizations */}
                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Organizations:</p>
                                <div className="border rounded text-xs">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-2 py-1 text-left">Name</th>
                                                <th className="px-2 py-1 text-left">Type</th>
                                                <th className="px-2 py-1 text-left">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.summary.organizations.map((o) => (
                                                <tr key={o.id} className="border-t">
                                                    <td className="px-2 py-1">{o.name}</td>
                                                    <td className="px-2 py-1">
                                                        <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{o.type}</span>
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{o.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Property & Payment Method */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="border rounded p-2">
                                    <p className="font-medium text-gray-500 mb-1">🏠 Property</p>
                                    <p className="font-semibold">{result.summary.property.title}</p>
                                    <p className="text-gray-500">{result.summary.property.variant}</p>
                                    <p className="text-gray-500">Unit {result.summary.property.unit}</p>
                                </div>
                                <div className="border rounded p-2">
                                    <p className="font-medium text-gray-500 mb-1">💳 Payment Method</p>
                                    <p className="font-semibold">{result.summary.paymentMethod.name}</p>
                                    <p className="text-gray-500">{result.summary.paymentMethod.phases} phases</p>
                                </div>
                            </div>

                            <p className="text-sm text-center">
                                <a href="/login" className="text-purple-600 underline font-medium">
                                    Sign in as Adaeze (admin)
                                </a>{' '}
                                or{' '}
                                <a href="/register" className="text-purple-600 underline font-medium">
                                    Register as a new customer
                                </a>
                            </p>
                        </div>
                    )}

                    <Button
                        onClick={handleDemoBootstrap}
                        disabled={isLoading || !bootstrapSecret}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                        {isLoading ? 'Setting up demo environment...' : '🚀 Reset & Bootstrap Demo'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

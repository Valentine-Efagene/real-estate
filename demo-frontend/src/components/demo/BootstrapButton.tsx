'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
import { setStoredTenantId } from '@/lib/hooks/use-tenant';

interface BootstrapResponse {
    success?: boolean;
    // Direct response format from backend
    tenant?: { id: string; name: string };
    admin?: { id: string; email: string };
    platformOrg?: { id: string; name: string };
    roles?: Array<{ id: string; name: string }>;
    // Or wrapped format
    data?: {
        tenant: { id: string; name: string };
        admin: { id: string; email: string };
        platformOrg: { id: string; name: string };
    };
    error?: string;
}

export function BootstrapButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<BootstrapResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    // Form state
    const [bootstrapSecret, setBootstrapSecret] = useState('');
    const [tenantName, setTenantName] = useState('QShelter Demo');
    const [tenantSubdomain, setTenantSubdomain] = useState('qshelter-demo');
    const [adminEmail, setAdminEmail] = useState('adaeze@mailsac.com');
    const [adminFirstName, setAdminFirstName] = useState('Adaeze');
    const [adminLastName, setAdminLastName] = useState('Okonkwo');
    const [adminPassword, setAdminPassword] = useState('password');
    const [showPassword, setShowPassword] = useState(false);

    const handleBootstrap = async () => {
        if (!bootstrapSecret) {
            setError('Bootstrap secret is required');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            // Use local API route to avoid CORS issues
            const response = await fetch('/api/bootstrap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Bootstrap-Secret': bootstrapSecret,
                },
                body: JSON.stringify({
                    tenant: {
                        name: tenantName,
                        subdomain: tenantSubdomain,
                    },
                    admin: {
                        email: adminEmail,
                        firstName: adminFirstName,
                        lastName: adminLastName,
                        password: adminPassword,
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || data.message || 'Bootstrap failed');
                return;
            }

            // Store tenantId for use in registration and other API calls
            // Handle both direct format (data.tenant.id) and wrapped format (data.data.tenant.id)
            const tenantId = data.tenant?.id || data.data?.tenant?.id;
            if (tenantId) {
                setStoredTenantId(tenantId);
                console.log('[Bootstrap] Stored tenantId:', tenantId);
            } else {
                console.warn('[Bootstrap] No tenantId found in response:', data);
            }

            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50">
                    🔧 Bootstrap Project
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Bootstrap QShelter</DialogTitle>
                    <DialogDescription>
                        Initialize the platform with a tenant, admin user, and platform organization.
                        This creates the Chidi-Lekki demo scenario data.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Bootstrap Secret */}
                    <div className="space-y-2">
                        <Label htmlFor="bootstrapSecret">Bootstrap Secret *</Label>
                        <Input
                            id="bootstrapSecret"
                            type="password"
                            value={bootstrapSecret}
                            onChange={(e) => setBootstrapSecret(e.target.value)}
                            placeholder="Get from SSM: /qshelter/staging/bootstrap-secret"
                        />
                        <p className="text-xs text-muted-foreground">
                            Run: <code className="bg-muted px-1 rounded">aws ssm get-parameter --name /qshelter/staging/bootstrap-secret --with-decryption --query Parameter.Value --output text</code>
                        </p>
                    </div>

                    {/* Tenant Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="tenantName">Tenant Name</Label>
                            <Input
                                id="tenantName"
                                value={tenantName}
                                onChange={(e) => setTenantName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tenantSubdomain">Subdomain</Label>
                            <Input
                                id="tenantSubdomain"
                                value={tenantSubdomain}
                                onChange={(e) => setTenantSubdomain(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Admin Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="adminFirstName">Admin First Name</Label>
                            <Input
                                id="adminFirstName"
                                value={adminFirstName}
                                onChange={(e) => setAdminFirstName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adminLastName">Admin Last Name</Label>
                            <Input
                                id="adminLastName"
                                value={adminLastName}
                                onChange={(e) => setAdminLastName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="adminEmail">Admin Email</Label>
                            <Input
                                id="adminEmail"
                                type="email"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adminPassword">Admin Password</Label>
                            <div className="relative">
                                <Input
                                    id="adminPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {/* Success Display - handle both direct and wrapped response formats */}
                    {(result?.tenant || result?.data?.tenant) && (
                        <Card className="border-green-200 bg-green-50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-green-700 text-base">✅ Bootstrap Successful!</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-green-800">
                                <dl className="space-y-1">
                                    <div>
                                        <dt className="font-medium inline">Tenant:</dt>{' '}
                                        <dd className="inline">{result.tenant?.name || result.data?.tenant.name} ({result.tenant?.id || result.data?.tenant.id})</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium inline">Admin:</dt>{' '}
                                        <dd className="inline">{result.admin?.email || result.data?.admin.email}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-medium inline">Organization:</dt>{' '}
                                        <dd className="inline">{result.platformOrg?.name || result.data?.platformOrg?.name || 'Created'}</dd>
                                    </div>
                                </dl>
                                <p className="mt-3 font-medium">
                                    You can now <a href="/login" className="underline text-green-700">sign in</a> with the admin credentials!
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <Button
                        onClick={handleBootstrap}
                        disabled={isLoading || !bootstrapSecret}
                        className="w-full"
                    >
                        {isLoading ? 'Bootstrapping...' : 'Bootstrap Platform'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

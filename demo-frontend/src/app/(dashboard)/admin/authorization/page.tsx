'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
    useRoles,
    usePermissions,
    useCreateRole,
    useDeleteRole,
    useUpdateRole,
    Role,
    Permission,
} from '@/lib/hooks/use-authorization';
import { Plus, Trash2, Shield, Key, Check, X, ExternalLink, ArrowRight } from 'lucide-react';
import { useTenant } from '@/lib/hooks/use-tenant';
import Link from 'next/link';

// ============================================================================
// Create Role Dialog
// ============================================================================
function CreateRoleDialog({ onSuccess }: { onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);
    const createRole = useCreateRole();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createRole.mutateAsync(formData);
            toast.success('Role created successfully');
            setOpen(false);
            setFormData({ name: '', description: '' });
            onSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create role');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                    <DialogDescription>
                        Define a new role that can be assigned to users. You can add permissions after creation.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="roleName">Role Name *</Label>
                        <Input
                            id="roleName"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., property-manager, developer-staff"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Use lowercase with hyphens (e.g., mortgage-officer)
                        </p>
                    </div>

                    <div>
                        <Label htmlFor="roleDescription">Description</Label>
                        <Textarea
                            id="roleDescription"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe what this role is for..."
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createRole.isPending}>
                            {createRole.isPending ? 'Creating...' : 'Create Role'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Roles Table
// ============================================================================
function RolesTable({ tenantId }: { tenantId?: string }) {
    const { data: roles, isLoading, error } = useRoles(tenantId);
    const deleteRole = useDeleteRole();
    const updateRole = useUpdateRole();

    const handleDelete = async (role: Role) => {
        if (role.isSystem) {
            toast.error('Cannot delete system roles');
            return;
        }
        if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
        try {
            await deleteRole.mutateAsync(role.id);
            toast.success('Role deleted');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete role');
        }
    };

    const handleToggleActive = async (role: Role) => {
        try {
            await updateRole.mutateAsync({ id: role.id, data: { isActive: !role.isActive } });
            toast.success(`Role ${role.isActive ? 'deactivated' : 'activated'}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update role');
        }
    };

    if (error) {
        return <div className="text-red-500">Error loading roles: {error.message}</div>;
    }

    if (isLoading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {(roles || []).length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No roles found. Create one to get started.
                        </TableCell>
                    </TableRow>
                ) : (
                    (roles || []).map((role) => (
                        <TableRow key={role.id}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-gray-400" />
                                    {role.name}
                                </div>
                            </TableCell>
                            <TableCell className="text-gray-500">{role.description || '-'}</TableCell>
                            <TableCell>
                                {role.isSystem ? (
                                    <Badge variant="secondary">System</Badge>
                                ) : (
                                    <Badge variant="outline">Custom</Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline">
                                    {role._count?.permissions || 0} permissions
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant={role.isActive ? 'default' : 'secondary'}
                                    className="cursor-pointer"
                                    onClick={() => handleToggleActive(role)}
                                >
                                    {role.isActive ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                                    {role.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                    <Link href={`/admin/authorization/roles/${role.id}`}>
                                        <Button size="sm" variant="outline">
                                            Manage
                                            <ArrowRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    </Link>
                                    {!role.isSystem && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(role)}
                                            disabled={deleteRole.isPending}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );
}

// ============================================================================
// Permissions Summary Table (links to full page)
// ============================================================================
function PermissionsSummaryTable({ tenantId }: { tenantId?: string }) {
    const { data: permissions, isLoading, error } = usePermissions(tenantId);

    const getMethodBadgeColor = (method: string) => {
        switch (method) {
            case 'GET': return 'bg-green-100 text-green-800';
            case 'POST': return 'bg-blue-100 text-blue-800';
            case 'PUT':
            case 'PATCH': return 'bg-yellow-100 text-yellow-800';
            case 'DELETE': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (error) {
        return <div className="text-red-500">Error loading permissions: {error.message}</div>;
    }

    if (isLoading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    // Show only first 10 permissions as a preview
    const previewPermissions = (permissions || []).slice(0, 10);
    const remainingCount = (permissions || []).length - 10;

    return (
        <div className="space-y-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Permission</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead>Methods</TableHead>
                        <TableHead>Effect</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {previewPermissions.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                No permissions found. Create some to define API access.
                            </TableCell>
                        </TableRow>
                    ) : (
                        previewPermissions.map((permission) => (
                            <TableRow key={permission.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <Key className="h-4 w-4 text-gray-400" />
                                        {permission.name}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                        {permission.path}
                                    </code>
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-1 flex-wrap">
                                        {permission.methods.map((method, idx) => (
                                            <span
                                                key={idx}
                                                className={`px-1.5 py-0.5 rounded text-xs font-medium ${getMethodBadgeColor(method)}`}
                                            >
                                                {method}
                                            </span>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={permission.effect === 'ALLOW' ? 'default' : 'destructive'}>
                                        {permission.effect}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {remainingCount > 0 && (
                <div className="text-center text-sm text-gray-500">
                    ...and {remainingCount} more permissions
                </div>
            )}

            <div className="text-center pt-2">
                <Link href="/admin/authorization/permissions">
                    <Button variant="outline">
                        Manage All Permissions
                        <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}

// ============================================================================
// Main Page Component
// ============================================================================
function AuthorizationContent() {
    const { tenantId, isLoading: tenantLoading } = useTenant();
    const { data: roles } = useRoles(tenantId ?? undefined);
    const { data: permissions } = usePermissions(tenantId ?? undefined);

    if (tenantLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Authorization</h1>
                <p className="text-gray-500 mt-1">
                    Manage roles and permissions to control access to platform features
                </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Roles</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{roles?.length || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">System Roles</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {roles?.filter(r => r.isSystem).length || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Permissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{permissions?.length || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Custom Roles</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {roles?.filter(r => !r.isSystem).length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-blue-900">How Authorization Works</h3>
                            <p className="text-sm text-blue-700 mt-1">
                                <strong>Roles</strong> group permissions together (e.g., "agent", "mortgage_ops", "lender_ops").{' '}
                                <strong>Permissions</strong> define access to specific API paths and methods.{' '}
                                Click "Manage" on a role to configure its permissions.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs for Roles and Permissions */}
            <Tabs defaultValue="roles">
                <TabsList>
                    <TabsTrigger value="roles" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Roles
                    </TabsTrigger>
                    <TabsTrigger value="permissions" className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Permissions
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="roles" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Roles</CardTitle>
                                <CardDescription>
                                    Define roles and manage their permissions. Click "Manage" to configure a role.
                                </CardDescription>
                            </div>
                            <CreateRoleDialog />
                        </CardHeader>
                        <CardContent>
                            <RolesTable tenantId={tenantId ?? undefined} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="permissions" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Permissions</CardTitle>
                                <CardDescription>
                                    API path permissions that can be assigned to roles
                                </CardDescription>
                            </div>
                            <Link href="/admin/authorization/permissions">
                                <Button>
                                    <Key className="h-4 w-4 mr-2" />
                                    Manage Permissions
                                </Button>
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <PermissionsSummaryTable tenantId={tenantId ?? undefined} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function AuthorizationPage() {
    return (
        <ProtectedRoute roles={['admin']}>
            <AuthorizationContent />
        </ProtectedRoute>
    );
}

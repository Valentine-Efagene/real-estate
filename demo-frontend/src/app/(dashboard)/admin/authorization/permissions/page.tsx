'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
    usePermissions,
    useCreatePermission,
    useCreateCrudPermissions,
    useUpdatePermission,
    useDeletePermission,
    Permission,
    CreatePermissionInput,
} from '@/lib/hooks/use-authorization';
import { Plus, Trash2, Key, Edit, ArrowLeft, Search, Check, X } from 'lucide-react';
import { useTenant } from '@/lib/hooks/use-tenant';
import Link from 'next/link';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

// ============================================================================
// Create Permission Dialog
// ============================================================================
function CreatePermissionDialog({ onSuccess }: { onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'single' | 'crud'>('crud');
    const createPermission = useCreatePermission();
    const createCrudPermissions = useCreateCrudPermissions();

    const [singleFormData, setSingleFormData] = useState({
        name: '',
        description: '',
        path: '',
        methods: [] as string[],
        effect: 'ALLOW' as 'ALLOW' | 'DENY',
    });

    const [crudFormData, setCrudFormData] = useState({
        resourcePath: '',
        resourceName: '',
    });

    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createPermission.mutateAsync(singleFormData);
            toast.success('Permission created successfully');
            setOpen(false);
            setSingleFormData({ name: '', description: '', path: '', methods: [], effect: 'ALLOW' });
            onSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create permission');
        }
    };

    const handleCrudSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createCrudPermissions.mutateAsync(crudFormData);
            toast.success('CRUD permissions created successfully');
            setOpen(false);
            setCrudFormData({ resourcePath: '', resourceName: '' });
            onSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create CRUD permissions');
        }
    };

    const toggleMethod = (method: string) => {
        setSingleFormData(prev => ({
            ...prev,
            methods: prev.methods.includes(method)
                ? prev.methods.filter(m => m !== method)
                : [...prev.methods, method],
        }));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Permission
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create Permission</DialogTitle>
                    <DialogDescription>
                        Define API path permissions. Use CRUD mode to quickly create all standard operations.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'crud')}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="crud">CRUD (Quick)</TabsTrigger>
                        <TabsTrigger value="single">Single Permission</TabsTrigger>
                    </TabsList>

                    <TabsContent value="crud">
                        <form onSubmit={handleCrudSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="resourcePath">Resource Path *</Label>
                                <Input
                                    id="resourcePath"
                                    value={crudFormData.resourcePath}
                                    onChange={(e) => setCrudFormData({ ...crudFormData, resourcePath: e.target.value })}
                                    placeholder="/properties"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Base path for the resource (e.g., /properties, /applications)
                                </p>
                            </div>

                            <div>
                                <Label htmlFor="resourceName">Resource Name *</Label>
                                <Input
                                    id="resourceName"
                                    value={crudFormData.resourceName}
                                    onChange={(e) => setCrudFormData({ ...crudFormData, resourceName: e.target.value })}
                                    placeholder="Properties"
                                    required
                                />
                            </div>

                            <div className="bg-gray-50 p-3 rounded-md text-sm">
                                <p className="font-medium mb-2">Will create these permissions:</p>
                                <ul className="space-y-1 text-gray-600">
                                    <li>• List {crudFormData.resourceName || 'Resources'} (GET {crudFormData.resourcePath || '/path'})</li>
                                    <li>• Create {crudFormData.resourceName || 'Resource'} (POST {crudFormData.resourcePath || '/path'})</li>
                                    <li>• Read {crudFormData.resourceName || 'Resource'} (GET {crudFormData.resourcePath || '/path'}/:id)</li>
                                    <li>• Update {crudFormData.resourceName || 'Resource'} (PUT/PATCH {crudFormData.resourcePath || '/path'}/:id)</li>
                                    <li>• Delete {crudFormData.resourceName || 'Resource'} (DELETE {crudFormData.resourcePath || '/path'}/:id)</li>
                                </ul>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={createCrudPermissions.isPending}>
                                    {createCrudPermissions.isPending ? 'Creating...' : 'Create CRUD Permissions'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>

                    <TabsContent value="single">
                        <form onSubmit={handleSingleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="permissionName">Name *</Label>
                                <Input
                                    id="permissionName"
                                    value={singleFormData.name}
                                    onChange={(e) => setSingleFormData({ ...singleFormData, name: e.target.value })}
                                    placeholder="e.g., Create Property"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="permissionPath">Path *</Label>
                                <Input
                                    id="permissionPath"
                                    value={singleFormData.path}
                                    onChange={(e) => setSingleFormData({ ...singleFormData, path: e.target.value })}
                                    placeholder="/properties/:id"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Use :id for dynamic segments, * for wildcards
                                </p>
                            </div>

                            <div>
                                <Label>HTTP Methods *</Label>
                                <div className="flex gap-2 mt-1">
                                    {HTTP_METHODS.map(method => (
                                        <Button
                                            key={method}
                                            type="button"
                                            variant={singleFormData.methods.includes(method) ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => toggleMethod(method)}
                                        >
                                            {method}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="effect">Effect</Label>
                                <Select
                                    value={singleFormData.effect}
                                    onValueChange={(value) => setSingleFormData({ ...singleFormData, effect: value as 'ALLOW' | 'DENY' })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select effect" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALLOW">Allow</SelectItem>
                                        <SelectItem value="DENY">Deny</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={createPermission.isPending || singleFormData.methods.length === 0}>
                                    {createPermission.isPending ? 'Creating...' : 'Create Permission'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Edit Permission Dialog
// ============================================================================
function EditPermissionDialog({ permission, onSuccess }: { permission: Permission; onSuccess?: () => void }) {
    const [open, setOpen] = useState(false);
    const updatePermission = useUpdatePermission();

    const [formData, setFormData] = useState({
        name: permission.name,
        description: permission.description || '',
        path: permission.path,
        methods: [...permission.methods],
        effect: permission.effect,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updatePermission.mutateAsync({
                id: permission.id,
                data: formData,
            });
            toast.success('Permission updated successfully');
            setOpen(false);
            onSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update permission');
        }
    };

    const toggleMethod = (method: string) => {
        setFormData(prev => ({
            ...prev,
            methods: prev.methods.includes(method)
                ? prev.methods.filter(m => m !== method)
                : [...prev.methods, method],
        }));
    };

    // Reset form when dialog opens
    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            setFormData({
                name: permission.name,
                description: permission.description || '',
                path: permission.path,
                methods: [...permission.methods],
                effect: permission.effect,
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit Permission</DialogTitle>
                    <DialogDescription>
                        Update the permission details. Changes will affect all roles using this permission.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="editName">Name *</Label>
                        <Input
                            id="editName"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="editDescription">Description</Label>
                        <Input
                            id="editDescription"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Optional description"
                        />
                    </div>

                    <div>
                        <Label htmlFor="editPath">Path *</Label>
                        <Input
                            id="editPath"
                            value={formData.path}
                            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                            placeholder="/properties/:id"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Use :param for dynamic segments, /* for wildcards
                        </p>
                    </div>

                    <div>
                        <Label>HTTP Methods *</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {HTTP_METHODS.map(method => (
                                <Button
                                    key={method}
                                    type="button"
                                    variant={formData.methods.includes(method) ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => toggleMethod(method)}
                                >
                                    {method}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="editEffect">Effect</Label>
                        <Select
                            value={formData.effect}
                            onValueChange={(value) => setFormData({ ...formData, effect: value as 'ALLOW' | 'DENY' })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select effect" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALLOW">Allow</SelectItem>
                                <SelectItem value="DENY">Deny</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {permission.isSystem && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                            <strong>Warning:</strong> This is a system permission. Modifying it may affect core functionality.
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={updatePermission.isPending || formData.methods.length === 0}>
                            {updatePermission.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Permission Row Component
// ============================================================================
function PermissionRow({ permission }: { permission: Permission }) {
    const deletePermission = useDeletePermission();

    const handleDelete = async () => {
        if (permission.isSystem) {
            toast.error('Cannot delete system permissions');
            return;
        }
        if (!confirm(`Delete permission "${permission.name}"? This will remove it from all roles.`)) return;

        try {
            await deletePermission.mutateAsync(permission.id);
            toast.success('Permission deleted');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete');
        }
    };

    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col">
                    <span className="font-medium">{permission.name}</span>
                    {permission.description && (
                        <span className="text-xs text-gray-500">{permission.description}</span>
                    )}
                </div>
            </TableCell>
            <TableCell>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{permission.path}</code>
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-1">
                    {permission.methods.map(method => (
                        <Badge
                            key={method}
                            variant={
                                method === 'GET' ? 'secondary' :
                                    method === 'POST' ? 'default' :
                                        method === 'DELETE' ? 'destructive' :
                                            'outline'
                            }
                            className="text-xs"
                        >
                            {method}
                        </Badge>
                    ))}
                </div>
            </TableCell>
            <TableCell>
                <Badge variant={permission.effect === 'ALLOW' ? 'default' : 'destructive'}>
                    {permission.effect}
                </Badge>
            </TableCell>
            <TableCell>
                {permission.isSystem ? (
                    <Badge variant="outline">System</Badge>
                ) : (
                    <Badge variant="secondary">Custom</Badge>
                )}
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-1">
                    <EditPermissionDialog permission={permission} />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDelete}
                        disabled={deletePermission.isPending || permission.isSystem}
                    >
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

// ============================================================================
// Main Page Content
// ============================================================================
function PermissionsContent() {
    const { tenantId, isLoading: tenantLoading } = useTenant();
    const { data: permissions, isLoading, error } = usePermissions(tenantId ?? undefined);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMethod, setFilterMethod] = useState<string>('all');
    const [filterEffect, setFilterEffect] = useState<string>('all');

    if (tenantLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <span className="text-4xl">❌</span>
                <h2 className="text-xl font-semibold mt-4">Failed to load permissions</h2>
                <p className="text-gray-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
        );
    }

    // Filter permissions
    const filteredPermissions = permissions?.filter(p => {
        const matchesSearch = !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.path.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMethod = filterMethod === 'all' || p.methods.includes(filterMethod);
        const matchesEffect = filterEffect === 'all' || p.effect === filterEffect;
        return matchesSearch && matchesMethod && matchesEffect;
    }) || [];

    // Group by path prefix for stats
    const pathGroups = new Map<string, number>();
    permissions?.forEach(p => {
        const prefix = p.path.split('/').slice(0, 2).join('/') || '/';
        pathGroups.set(prefix, (pathGroups.get(prefix) || 0) + 1);
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/authorization">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Permissions</h1>
                        <p className="text-gray-500">
                            Manage API permissions that can be assigned to roles
                        </p>
                    </div>
                </div>
                <CreatePermissionDialog />
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
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
                        <CardTitle className="text-sm font-medium text-gray-500">Allow Rules</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {permissions?.filter(p => p.effect === 'ALLOW').length || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Deny Rules</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {permissions?.filter(p => p.effect === 'DENY').length || 0}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">System Permissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-600">
                            {permissions?.filter(p => p.isSystem).length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">All Permissions</CardTitle>
                    <CardDescription>
                        Click on a permission to edit its path, methods, and effect
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search by name or path..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Select value={filterMethod} onValueChange={setFilterMethod}>
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Methods</SelectItem>
                                {HTTP_METHODS.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterEffect} onValueChange={setFilterEffect}>
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="Effect" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Effects</SelectItem>
                                <SelectItem value="ALLOW">Allow</SelectItem>
                                <SelectItem value="DENY">Deny</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : filteredPermissions.length === 0 ? (
                        <div className="text-center py-12">
                            <Key className="h-12 w-12 mx-auto text-gray-300" />
                            <h3 className="mt-4 text-lg font-medium">No permissions found</h3>
                            <p className="text-gray-500 mt-1">
                                {searchQuery ? 'Try a different search term' : 'Create your first permission to get started'}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Path</TableHead>
                                        <TableHead>Methods</TableHead>
                                        <TableHead>Effect</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="w-24">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPermissions.map(permission => (
                                        <PermissionRow key={permission.id} permission={permission} />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Page Export
// ============================================================================
export default function PermissionsPage() {
    return (
        <ProtectedRoute>
            <PermissionsContent />
        </ProtectedRoute>
    );
}

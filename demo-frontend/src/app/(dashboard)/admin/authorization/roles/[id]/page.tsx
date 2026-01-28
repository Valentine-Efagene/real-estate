'use client';

import { useState, useEffect, use } from 'react';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
    useRole,
    useRolePermissions,
    usePermissions,
    useUpdateRole,
    useUpdatePermission,
    useAssignRolePermissions,
    Permission,
} from '@/lib/hooks/use-authorization';
import { ArrowLeft, Shield, Key, Save, Search, Edit, Pencil } from 'lucide-react';
import { useTenant } from '@/lib/hooks/use-tenant';
import Link from 'next/link';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

// ============================================================================
// Edit Permission Dialog (inline editing of permission fields)
// ============================================================================
function EditPermissionDialog({ permission }: { permission: Permission }) {
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
            toast.success('Permission updated');
            setOpen(false);
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
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Pencil className="h-3 w-3" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Edit Permission</DialogTitle>
                    <DialogDescription>
                        Update permission fields. Changes affect all roles using this permission.
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
// Edit Role Details Dialog
// ============================================================================
function EditRoleDialog({ roleId, currentName, currentDescription, isSystem }: {
    roleId: string;
    currentName: string;
    currentDescription?: string;
    isSystem?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const updateRole = useUpdateRole();

    const [formData, setFormData] = useState({
        name: currentName,
        description: currentDescription || '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateRole.mutateAsync({
                id: roleId,
                data: formData,
            });
            toast.success('Role updated successfully');
            setOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update role');
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            setFormData({
                name: currentName,
                description: currentDescription || '',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Role
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Role</DialogTitle>
                    <DialogDescription>
                        Update the role name and description
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="roleName">Name *</Label>
                        <Input
                            id="roleName"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            disabled={isSystem}
                            required
                        />
                        {isSystem && (
                            <p className="text-xs text-yellow-600 mt-1">
                                System role names cannot be changed
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="roleDescription">Description</Label>
                        <Textarea
                            id="roleDescription"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={updateRole.isPending}>
                            {updateRole.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Permission Selection Component
// ============================================================================
function PermissionSelector({
    allPermissions,
    selectedPermissionIds,
    onToggle,
}: {
    allPermissions: Permission[];
    selectedPermissionIds: Set<string>;
    onToggle: (permissionId: string) => void;
}) {
    const [searchQuery, setSearchQuery] = useState('');

    // Group permissions by path prefix (e.g., /properties, /applications)
    const groupedPermissions = allPermissions.reduce((groups, permission) => {
        // Extract the resource from the path (e.g., /properties -> properties)
        const pathParts = permission.path.split('/').filter(Boolean);
        const resource = pathParts[0] || 'other';
        const groupName = resource.charAt(0).toUpperCase() + resource.slice(1);

        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(permission);
        return groups;
    }, {} as Record<string, Permission[]>);

    // Filter based on search
    const filteredGroups = Object.entries(groupedPermissions).reduce((acc, [group, perms]) => {
        const filtered = perms.filter(p =>
            !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.path.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filtered.length > 0) {
            acc[group] = filtered;
        }
        return acc;
    }, {} as Record<string, Permission[]>);

    const sortedGroups = Object.keys(filteredGroups).sort();

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="Search permissions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {sortedGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    No permissions found
                </div>
            ) : (
                <Accordion type="multiple" defaultValue={sortedGroups} className="w-full">
                    {sortedGroups.map(group => (
                        <AccordionItem key={group} value={group}>
                            <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{group}</span>
                                    <Badge variant="secondary" className="text-xs">
                                        {filteredGroups[group].filter(p => selectedPermissionIds.has(p.id)).length} / {filteredGroups[group].length}
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-2 pl-2">
                                    {filteredGroups[group].map(permission => (
                                        <div
                                            key={permission.id}
                                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${selectedPermissionIds.has(permission.id)
                                                    ? 'bg-primary/5 border-primary'
                                                    : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <Checkbox
                                                checked={selectedPermissionIds.has(permission.id)}
                                                onCheckedChange={() => onToggle(permission.id)}
                                                className="mt-1 cursor-pointer"
                                            />
                                            <div
                                                className="flex-1 min-w-0 cursor-pointer"
                                                onClick={() => onToggle(permission.id)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{permission.name}</span>
                                                    {permission.isSystem && (
                                                        <Badge variant="outline" className="text-xs">System</Badge>
                                                    )}
                                                </div>
                                                {permission.description && (
                                                    <p className="text-xs text-gray-500 mt-0.5">{permission.description}</p>
                                                )}
                                                <div className="flex items-center gap-2 mt-1">
                                                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                                        {permission.path}
                                                    </code>
                                                    <div className="flex gap-1">
                                                        {permission.methods.map(method => (
                                                            <Badge
                                                                key={method}
                                                                variant={
                                                                    method === 'GET' ? 'secondary' :
                                                                        method === 'POST' ? 'default' :
                                                                            method === 'DELETE' ? 'destructive' :
                                                                                'outline'
                                                                }
                                                                className="text-xs px-1.5"
                                                            >
                                                                {method}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={permission.effect === 'ALLOW' ? 'default' : 'destructive'}
                                                    className="text-xs"
                                                >
                                                    {permission.effect}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </div>
    );
}

// ============================================================================
// Main Page Content
// ============================================================================
function RoleDetailContent({ roleId }: { roleId: string }) {
    const { tenantId, isLoading: tenantLoading } = useTenant();
    const { data: role, isLoading: roleLoading, error: roleError } = useRole(roleId);
    const { data: rolePermissions, isLoading: rolePermsLoading } = useRolePermissions(roleId);
    const { data: allPermissions, isLoading: allPermsLoading } = usePermissions(tenantId ?? undefined);
    const assignPermissions = useAssignRolePermissions();

    const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize selected permissions from role's current permissions
    useEffect(() => {
        if (rolePermissions) {
            setSelectedPermissionIds(new Set(rolePermissions.map(p => p.id)));
            setHasChanges(false);
        }
    }, [rolePermissions]);

    const togglePermission = (permissionId: string) => {
        setSelectedPermissionIds(prev => {
            const next = new Set(prev);
            if (next.has(permissionId)) {
                next.delete(permissionId);
            } else {
                next.add(permissionId);
            }
            return next;
        });
        setHasChanges(true);
    };

    const handleSavePermissions = async () => {
        try {
            await assignPermissions.mutateAsync({
                roleId,
                permissionIds: Array.from(selectedPermissionIds),
            });
            toast.success('Permissions updated successfully');
            setHasChanges(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update permissions');
        }
    };

    const isLoading = tenantLoading || roleLoading || rolePermsLoading || allPermsLoading;

    if (roleError) {
        return (
            <div className="text-center py-12">
                <span className="text-4xl">❌</span>
                <h2 className="text-xl font-semibold mt-4">Failed to load role</h2>
                <p className="text-gray-500">{roleError instanceof Error ? roleError.message : 'Unknown error'}</p>
                <Link href="/admin/authorization">
                    <Button className="mt-4">Back to Authorization</Button>
                </Link>
            </div>
        );
    }

    if (isLoading || !role) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

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
                        <div className="flex items-center gap-2">
                            <Shield className="h-6 w-6 text-primary" />
                            <h1 className="text-2xl font-bold tracking-tight">{role.name}</h1>
                            {role.isSystem && (
                                <Badge variant="outline">System Role</Badge>
                            )}
                        </div>
                        <p className="text-gray-500">{role.description || 'No description'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <EditRoleDialog
                        roleId={role.id}
                        currentName={role.name}
                        currentDescription={role.description}
                        isSystem={role.isSystem}
                    />
                    {hasChanges && (
                        <Button onClick={handleSavePermissions} disabled={assignPermissions.isPending}>
                            <Save className="h-4 w-4 mr-2" />
                            {assignPermissions.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Role Info Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Role Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <Badge variant={role.isActive ? 'default' : 'secondary'}>
                                {role.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Type</p>
                            <Badge variant={role.isSystem ? 'outline' : 'secondary'}>
                                {role.isSystem ? 'System' : 'Custom'}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Permissions</p>
                            <p className="font-medium">{selectedPermissionIds.size}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Users</p>
                            <p className="font-medium">{role._count?.memberships || 0}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Permissions Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Key className="h-5 w-5" />
                                Permissions
                            </CardTitle>
                            <CardDescription>
                                Select which permissions this role should have. Changes are saved when you click "Save Changes".
                            </CardDescription>
                        </div>
                        {hasChanges && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                Unsaved changes
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {allPermissions ? (
                        <PermissionSelector
                            allPermissions={allPermissions}
                            selectedPermissionIds={selectedPermissionIds}
                            onToggle={togglePermission}
                        />
                    ) : (
                        <div className="space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Currently Assigned Permissions Summary */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Currently Assigned ({selectedPermissionIds.size})</CardTitle>
                    <CardDescription>
                        Quick view of all permissions currently assigned to this role
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {selectedPermissionIds.size === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                            No permissions assigned. Select permissions above to grant access.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {allPermissions
                                ?.filter(p => selectedPermissionIds.has(p.id))
                                .map(p => (
                                    <Badge
                                        key={p.id}
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-gray-200"
                                        onClick={() => togglePermission(p.id)}
                                    >
                                        {p.name}
                                        <span className="ml-1 text-gray-400">×</span>
                                    </Badge>
                                ))
                            }
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
export default function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    return (
        <ProtectedRoute>
            <RoleDetailContent roleId={id} />
        </ProtectedRoute>
    );
}

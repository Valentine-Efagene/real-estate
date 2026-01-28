'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { Plus, UserPlus } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  isPlatformOrg: boolean;
  organizationTypes: {
    id: string;
    isPrimary: boolean;
    organizationType: {
      id: string;
      code: string;
      name: string;
    };
  }[];
  createdAt: string;
}

interface OrganizationMember {
  id: string;
  userId: string;
  title?: string;
  department?: string;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

const ORGANIZATION_TYPES = [
  { code: 'PLATFORM', name: 'Platform', description: 'QShelter platform organization' },
  { code: 'BANK', name: 'Bank', description: 'Financial institution providing mortgages' },
  { code: 'DEVELOPER', name: 'Developer', description: 'Property developer' },
  { code: 'LEGAL', name: 'Legal', description: 'Legal firm for conveyancing' },
  { code: 'INSURER', name: 'Insurer', description: 'Insurance company' },
  { code: 'GOVERNMENT', name: 'Government', description: 'Government agency' },
];

function useOrganizations() {
  return useQuery<Organization[]>({
    queryKey: queryKeys.organizations.all,
    queryFn: async () => {
      const res = await fetch('/api/proxy/user/organizations', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch organizations');
      const data = await res.json();
      // API returns { success, data: { items: [], pagination: {} } }
      return data.data?.items || data.data?.data || data.data || [];
    },
  });
}

function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      typeCodes: string[];
      primaryTypeCode?: string;
      email?: string;
      phone?: string;
      address?: string;
    }) => {
      const res = await fetch('/api/proxy/user/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error?.message || 'Failed to create organization');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all });
      toast.success('Organization created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

function useOrganizationMembers(orgId: string | null) {
  return useQuery<OrganizationMember[]>({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: async () => {
      if (!orgId) return [];
      const res = await fetch(`/api/proxy/user/organizations/${orgId}/members`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      return data.data?.items || data.data || [];
    },
    enabled: !!orgId,
  });
}

function useAddMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, data }: { orgId: string; data: { userId: string; title?: string; department?: string } }) => {
      const res = await fetch(`/api/proxy/user/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error?.message || 'Failed to add member');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', variables.orgId, 'members'] });
      toast.success('Member added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const res = await fetch('/api/proxy/user/users', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      return data.data?.data || data.data || [];
    },
  });
}

// Create Organization Dialog
function CreateOrganizationDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [primaryType, setPrimaryType] = useState<string>('');

  const createOrg = useCreateOrganization();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || selectedTypes.length === 0) {
      toast.error('Name and at least one organization type are required');
      return;
    }

    await createOrg.mutateAsync({
      name,
      typeCodes: selectedTypes,
      primaryTypeCode: primaryType || selectedTypes[0],
      email: email || undefined,
      phone: phone || undefined,
      address: address || undefined,
    });

    setOpen(false);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setSelectedTypes([]);
    setPrimaryType('');
  };

  const toggleType = (code: string) => {
    setSelectedTypes(prev =>
      prev.includes(code)
        ? prev.filter(t => t !== code)
        : [...prev, code]
    );
    // Reset primary type if it was deselected
    if (primaryType === code) {
      setPrimaryType('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Add a new partner organization to the ecosystem (bank, developer, etc.)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name *</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Access Bank PLC"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Organization Types * (select at least one)</Label>
            <div className="grid grid-cols-2 gap-2">
              {ORGANIZATION_TYPES.map((type) => (
                <div key={type.code} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type.code}`}
                    checked={selectedTypes.includes(type.code)}
                    onCheckedChange={() => toggleType(type.code)}
                  />
                  <Label htmlFor={`type-${type.code}`} className="text-sm cursor-pointer">
                    {type.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {selectedTypes.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="primary-type">Primary Type</Label>
              <Select value={primaryType} onValueChange={setPrimaryType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select primary type" />
                </SelectTrigger>
                <SelectContent>
                  {selectedTypes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {ORGANIZATION_TYPES.find(t => t.code === code)?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="org-email">Email</Label>
            <Input
              id="org-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@organization.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-phone">Phone</Label>
            <Input
              id="org-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-address">Address</Label>
            <Input
              id="org-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Organization address"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrg.isPending}>
              {createOrg.isPending ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Add Member Dialog
function AddMemberDialog({ organization }: { organization: Organization }) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');

  const { data: users = [] } = useUsers();
  const { data: existingMembers = [] } = useOrganizationMembers(organization.id);
  const addMember = useAddMember();

  // Filter out users who are already members
  const existingMemberIds = existingMembers.map((m: OrganizationMember) => m.userId);
  const availableUsers = users.filter((u: { id: string }) => !existingMemberIds.includes(u.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    await addMember.mutateAsync({
      orgId: organization.id,
      data: {
        userId: selectedUserId,
        title: title || undefined,
        department: department || undefined,
      },
    });

    setOpen(false);
    setSelectedUserId('');
    setTitle('');
    setDepartment('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-1" />
          Add Staff
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Staff to {organization.name}</DialogTitle>
          <DialogDescription>
            Invite a user to join this organization as a staff member
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-select">Select User *</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a user to add" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No available users
                  </SelectItem>
                ) : (
                  availableUsers.map((user: { id: string; email: string; firstName?: string; lastName?: string }) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName} (${user.email})`
                        : user.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-title">Job Title</Label>
            <Input
              id="member-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Loan Officer, Operations Manager"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-department">Department</Label>
            <Input
              id="member-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g., Mortgages, Sales"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMember.isPending || !selectedUserId}>
              {addMember.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getOrgTypeColor(code: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (code) {
    case 'PLATFORM':
      return 'default';
    case 'BANK':
      return 'secondary';
    case 'DEVELOPER':
      return 'outline';
    default:
      return 'outline';
  }
}

function OrganizationsTable({
  organizations,
  filter,
}: {
  organizations: Organization[];
  filter: string;
}) {
  const filteredOrgs = organizations.filter((org) => {
    if (filter === 'all') return true;
    return org.organizationTypes?.some((ot) => ot.organizationType?.code === filter);
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Types</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredOrgs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
              No organizations found
            </TableCell>
          </TableRow>
        ) : (
          filteredOrgs.map((org) => (
            <TableRow key={org.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {org.name}
                  {org.isPlatformOrg && (
                    <Badge variant="default" className="text-xs">
                      Platform
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{org.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(org.organizationTypes || []).map((ot) => (
                    <Badge
                      key={ot.id}
                      variant={getOrgTypeColor(ot.organizationType?.code || '')}
                      className="text-xs"
                    >
                      {ot.organizationType?.name || 'Unknown'}
                      {ot.isPrimary && ' ★'}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <AddMemberDialog organization={org} />
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{org.name}</DialogTitle>
                        <DialogDescription>Organization details</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-gray-500">Email:</div>
                          <div className="font-medium">{org.email}</div>
                          {org.phone && (
                            <>
                              <div className="text-gray-500">Phone:</div>
                              <div className="font-medium">{org.phone}</div>
                            </>
                          )}
                          {org.address && (
                            <>
                              <div className="text-gray-500">Address:</div>
                              <div className="font-medium">{org.address}</div>
                            </>
                          )}
                          <div className="text-gray-500">Organization ID:</div>
                          <div className="font-medium text-xs">{org.id}</div>
                        </div>
                        <div className="space-y-2">
                          <Label>Organization Types</Label>
                          <div className="flex flex-wrap gap-2">
                            {(org.organizationTypes || []).map((ot) => (
                              <Badge key={ot.id} variant="secondary" className="text-sm">
                                {ot.organizationType?.name || 'Unknown'}
                                {ot.isPrimary && ' (Primary)'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline">Close</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function AdminOrganizationsContent() {
  const { data: organizations, isLoading, error } = useOrganizations();
  const [search, setSearch] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl">❌</span>
        <h2 className="text-xl font-semibold mt-4">Failed to load organizations</h2>
        <p className="text-gray-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }

  const allOrgs = organizations || [];
  const filteredBySearch = allOrgs.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase()) ||
    (org.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: allOrgs.length,
    platform: allOrgs.filter((o) =>
      o.organizationTypes?.some((ot) => ot.organizationType?.code === 'PLATFORM')
    ).length,
    banks: allOrgs.filter((o) =>
      o.organizationTypes?.some((ot) => ot.organizationType?.code === 'BANK')
    ).length,
    developers: allOrgs.filter((o) =>
      o.organizationTypes?.some((ot) => ot.organizationType?.code === 'DEVELOPER')
    ).length,
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <CreateOrganizationDialog />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.platform}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Banks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.banks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Developers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.developers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
          <CardDescription>Partner organizations in the ecosystem</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="PLATFORM">Platform ({stats.platform})</TabsTrigger>
              <TabsTrigger value="BANK">Banks ({stats.banks})</TabsTrigger>
              <TabsTrigger value="DEVELOPER">Developers ({stats.developers})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <OrganizationsTable organizations={filteredBySearch} filter="all" />
            </TabsContent>
            <TabsContent value="PLATFORM" className="mt-4">
              <OrganizationsTable organizations={filteredBySearch} filter="PLATFORM" />
            </TabsContent>
            <TabsContent value="BANK" className="mt-4">
              <OrganizationsTable organizations={filteredBySearch} filter="BANK" />
            </TabsContent>
            <TabsContent value="DEVELOPER" className="mt-4">
              <OrganizationsTable organizations={filteredBySearch} filter="DEVELOPER" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminOrganizationsPage() {
  return (
    <ProtectedRoute roles={['admin']}>
      <AdminOrganizationsContent />
    </ProtectedRoute>
  );
}

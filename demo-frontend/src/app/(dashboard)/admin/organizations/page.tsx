'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { Plus, UserPlus, Mail, RefreshCw, X, Clock, User, Pencil, ClipboardCheck } from 'lucide-react';
import { useOnboarding, useCreateOnboarding, type OnboardingStatus } from '@/lib/hooks/use-onboarding';

interface Organization {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  isPlatformOrg: boolean;
  // Backend returns `types` with `orgType` inside
  types: {
    id: string;
    isPrimary: boolean;
    orgType: {
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

function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { typeCodes: string[]; primaryTypeCode?: string } }) => {
      const res = await fetch(`/api/proxy/user/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error?.message || 'Failed to update organization');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all });
      toast.success('Organization types updated successfully');
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
    mutationFn: async ({ orgId, data }: { orgId: string; data: { userId: string; roleId?: string; title?: string; department?: string } }) => {
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

interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
}

function useRoles() {
  return useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await fetch('/api/proxy/user/roles', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch roles');
      const data = await res.json();
      return data.data || [];
    },
  });
}

// Invitation types
interface OrganizationInvitation {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
  role: {
    id: string;
    name: string;
  } | null;
  invitedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

function useOrganizationInvitations(orgId: string | null) {
  return useQuery<OrganizationInvitation[]>({
    queryKey: ['organizations', orgId, 'invitations'],
    queryFn: async () => {
      if (!orgId) return [];
      const res = await fetch(`/api/proxy/user/organizations/${orgId}/invitations`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch invitations');
      const data = await res.json();
      return data.data?.items || data.data || [];
    },
    enabled: !!orgId,
  });
}

function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      data,
    }: {
      orgId: string;
      data: {
        email: string;
        firstName: string;
        lastName: string;
        roleId?: string;
        title?: string;
        department?: string;
      };
    }) => {
      const res = await fetch(`/api/proxy/user/organizations/${orgId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error?.message || 'Failed to send invitation');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', variables.orgId, 'invitations'] });
      toast.success('Invitation sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

function useCancelInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invitationId, orgId }: { invitationId: string; orgId: string }) => {
      const res = await fetch(`/api/proxy/user/invitations/${invitationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error?.message || 'Failed to cancel invitation');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', variables.orgId, 'invitations'] });
      toast.success('Invitation cancelled');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

function useResendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invitationId, orgId }: { invitationId: string; orgId: string }) => {
      const res = await fetch(`/api/proxy/user/invitations/${invitationId}/resend`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error?.message || 'Failed to resend invitation');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', variables.orgId, 'invitations'] });
      toast.success('Invitation resent');
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');

  const { data: users = [] } = useUsers();
  const { data: roles = [] } = useRoles();
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
        roleId: selectedRoleId || undefined,
        title: title || undefined,
        department: department || undefined,
      },
    });

    setOpen(false);
    setSelectedUserId('');
    setSelectedRoleId('');
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
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
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
            <Label htmlFor="role-select">Role</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent className="max-w-[300px]">
                {roles.map((role: Role) => (
                  <SelectItem key={role.id} value={role.id} className="truncate">
                    {role.name}
                  </SelectItem>
                ))}
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

// Invite Staff Dialog (for users who don't have an account yet)
function InviteStaffDialog({ organization }: { organization: Organization }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');

  const { data: roles = [] } = useRoles();
  const createInvitation = useCreateInvitation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !firstName || !lastName || !selectedRoleId) {
      toast.error('Please fill in all required fields');
      return;
    }

    await createInvitation.mutateAsync({
      orgId: organization.id,
      data: {
        email,
        firstName,
        lastName,
        roleId: selectedRoleId,
        title: title || undefined,
        department: department || undefined,
      },
    });

    setOpen(false);
    setEmail('');
    setFirstName('');
    setLastName('');
    setSelectedRoleId('');
    setTitle('');
    setDepartment('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-1" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Staff to {organization.name}</DialogTitle>
          <DialogDescription>
            Send an invitation email to someone who doesn't have an account yet
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email *</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., john@company.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invite-firstName">First Name *</Label>
              <Input
                id="invite-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g., John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-lastName">Last Name *</Label>
              <Input
                id="invite-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g., Doe"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role *</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role: Role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-title">Job Title</Label>
            <Input
              id="invite-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Loan Officer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-department">Department</Label>
            <Input
              id="invite-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g., Mortgages"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createInvitation.isPending}>
              {createInvitation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Pending Invitations List
function PendingInvitationsList({ organization }: { organization: Organization }) {
  const { data: invitations = [], isLoading } = useOrganizationInvitations(organization.id);
  const cancelInvitation = useCancelInvitation();
  const resendInvitation = useResendInvitation();

  const pendingInvitations = invitations.filter((i) => i.status === 'PENDING');

  if (isLoading) {
    return <Skeleton className="h-20" />;
  }

  if (pendingInvitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No pending invitations</p>
    );
  }

  return (
    <div className="space-y-2">
      {pendingInvitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">
                {invitation.firstName} {invitation.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{invitation.email}</p>
              <p className="text-xs text-muted-foreground">
                Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                resendInvitation.mutate({
                  invitationId: invitation.id,
                  orgId: organization.id,
                })
              }
              disabled={resendInvitation.isPending}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                cancelInvitation.mutate({
                  invitationId: invitation.id,
                  orgId: organization.id,
                })
              }
              disabled={cancelInvitation.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Staff Members List Component
function StaffMembersList({ organization }: { organization: Organization }) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: queryKeys.organizations.members(organization.id),
    queryFn: async () => {
      const response = await fetch(`/api/proxy/user/organizations/${organization.id}/members`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch members');
      const json = await response.json();
      return json.data || [];
    },
  });

  if (isLoading) {
    return <Skeleton className="h-20" />;
  }

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No staff members yet</p>
    );
  }

  return (
    <div className="space-y-2 max-h-[200px] overflow-y-auto">
      {members.map((member: OrganizationMember) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">
                {member.user?.firstName && member.user?.lastName
                  ? `${member.user.firstName} ${member.user.lastName}`
                  : member.user?.email || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">{member.user?.email}</p>
              {member.title && (
                <p className="text-xs text-muted-foreground">{member.title}</p>
              )}
            </div>
          </div>
          <Badge variant={member.isActive ? 'default' : 'outline'} className="text-xs">
            {member.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// Edit Organization Types Dialog
function EditTypesDialog({ organization }: { organization: Organization }) {
  const [open, setOpen] = useState(false);
  const currentCodes = (organization.types || []).map((t) => t.orgType?.code).filter(Boolean) as string[];
  const currentPrimary = organization.types?.find((t) => t.isPrimary)?.orgType?.code || currentCodes[0] || '';
  const [selectedTypes, setSelectedTypes] = useState<string[]>(currentCodes);
  const [primaryType, setPrimaryType] = useState<string>(currentPrimary);

  const updateOrg = useUpdateOrganization();

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const codes = (organization.types || []).map((t) => t.orgType?.code).filter(Boolean) as string[];
      setSelectedTypes(codes);
      setPrimaryType(organization.types?.find((t) => t.isPrimary)?.orgType?.code || codes[0] || '');
    }
    setOpen(isOpen);
  };

  const toggleType = (code: string) => {
    setSelectedTypes((prev) =>
      prev.includes(code) ? prev.filter((t) => t !== code) : [...prev, code]
    );
    if (primaryType === code) {
      setPrimaryType('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTypes.length === 0) {
      toast.error('At least one organization type is required');
      return;
    }

    await updateOrg.mutateAsync({
      id: organization.id,
      data: {
        typeCodes: selectedTypes,
        primaryTypeCode: primaryType || selectedTypes[0],
      },
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Types — {organization.name}</DialogTitle>
          <DialogDescription>
            Select which types apply to this organization
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Types *</Label>
            <div className="grid grid-cols-2 gap-2">
              {ORGANIZATION_TYPES.map((type) => (
                <div key={type.code} className="flex items-center space-x-2">
                  <Checkbox
                    id={`edit-type-${organization.id}-${type.code}`}
                    checked={selectedTypes.includes(type.code)}
                    onCheckedChange={() => toggleType(type.code)}
                  />
                  <Label
                    htmlFor={`edit-type-${organization.id}-${type.code}`}
                    className="text-sm cursor-pointer"
                  >
                    {type.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {selectedTypes.length > 1 && (
            <div className="space-y-2">
              <Label>Primary Type</Label>
              <Select value={primaryType} onValueChange={setPrimaryType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select primary type" />
                </SelectTrigger>
                <SelectContent>
                  {selectedTypes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {ORGANIZATION_TYPES.find((t) => t.code === code)?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateOrg.isPending || selectedTypes.length === 0}>
              {updateOrg.isPending ? 'Saving...' : 'Save Types'}
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

function getOnboardingBadgeVariant(status: OnboardingStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'COMPLETED': return 'default';
    case 'IN_PROGRESS': return 'secondary';
    case 'REJECTED': return 'destructive';
    case 'EXPIRED': return 'destructive';
    case 'PENDING': return 'outline';
    default: return 'outline';
  }
}

function OnboardingStatusCell({ organizationId }: { organizationId: string }) {
  const { data: onboarding, isLoading, error } = useOnboarding(organizationId);
  const createOnboarding = useCreateOnboarding();

  if (isLoading) {
    return <Skeleton className="h-5 w-20" />;
  }

  if (error && !(error instanceof Error && error.message.includes('not found'))) {
    return <span className="text-xs text-destructive">Error</span>;
  }

  if (!onboarding) {
    return (
      <div className="flex items-center gap-1">
        <Link href={`/admin/organizations/${organizationId}/onboarding`}>
          <Badge variant="outline" className="text-xs cursor-pointer hover:opacity-80 text-amber-600 border-amber-300">
            Not Created
          </Badge>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          title="Create onboarding"
          disabled={createOnboarding.isPending}
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await createOnboarding.mutateAsync({ organizationId });
              toast.success('Onboarding created successfully');
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to create onboarding');
            }
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  const needsAssignee = !onboarding.assignee && onboarding.status === 'PENDING';

  return (
    <Link href={`/admin/organizations/${organizationId}/onboarding`} className="group block space-y-1">
      <div className="flex items-center gap-1.5">
        <Badge variant={getOnboardingBadgeVariant(onboarding.status)} className="text-xs cursor-pointer group-hover:opacity-80">
          {onboarding.status.replace('_', ' ')}
        </Badge>
        {needsAssignee && (
          <span className="text-xs text-amber-600" title="No staff assigned — click to assign">⚠</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground group-hover:text-foreground truncate max-w-[160px]">
        {onboarding.onboardingFlow.name}
      </p>
      {needsAssignee ? (
        <p className="text-xs text-amber-600 font-medium">Needs staff →</p>
      ) : onboarding.assignee ? (
        <p className="text-xs text-muted-foreground truncate max-w-[160px]">
          👤 {[onboarding.assignee.firstName, onboarding.assignee.lastName].filter(Boolean).join(' ') || onboarding.assignee.email}
        </p>
      ) : null}
    </Link>
  );
}

/** Returns true if the org has any type that would trigger onboarding (BANK, DEVELOPER, etc.) */
function hasOnboardableType(org: Organization): boolean {
  const onboardableTypes = ['BANK', 'DEVELOPER'];
  return org.types?.some((ot) => onboardableTypes.includes(ot.orgType?.code || '')) ?? false;
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
    return org.types?.some((ot) => ot.orgType?.code === filter);
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Types</TableHead>
          <TableHead>Onboarding</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredOrgs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
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
                  {(org.types || []).map((ot) => (
                    <Badge
                      key={ot.id}
                      variant={getOrgTypeColor(ot.orgType?.code || '')}
                      className="text-xs"
                    >
                      {ot.orgType?.name || 'Unknown'}
                      {ot.isPrimary && ' ★'}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                {hasOnboardableType(org) ? (
                  <OnboardingStatusCell organizationId={org.id} />
                ) : (
                  <span className="text-xs text-muted-foreground">N/A</span>
                )}
              </TableCell>
              <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {hasOnboardableType(org) && (
                    <Link href={`/admin/organizations/${org.id}/onboarding`}>
                      <Button variant="outline" size="sm" title="View Onboarding">
                        <ClipboardCheck className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                  <AddMemberDialog organization={org} />
                  <InviteStaffDialog organization={org} />
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
                          <div className="flex items-center justify-between">
                            <Label>Organization Types</Label>
                            <EditTypesDialog organization={org} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(org.types || []).map((ot) => (
                              <Badge key={ot.id} variant="secondary" className="text-sm">
                                {ot.orgType?.name || 'Unknown'}
                                {ot.isPrimary && ' (Primary)'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {hasOnboardableType(org) && (
                          <div className="space-y-2">
                            <Label>Onboarding</Label>
                            <div className="flex items-center gap-2">
                              <OnboardingStatusCell organizationId={org.id} />
                              <Link href={`/admin/organizations/${org.id}/onboarding`}>
                                <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                                  View full onboarding →
                                </Button>
                              </Link>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Pending Invitations</Label>
                          <PendingInvitationsList organization={org} />
                        </div>
                        <div className="space-y-2">
                          <Label>Staff Members</Label>
                          <StaffMembersList organization={org} />
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Close</Button>
                        </DialogClose>
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
      o.types?.some((ot) => ot.orgType?.code === 'PLATFORM')
    ).length,
    banks: allOrgs.filter((o) =>
      o.types?.some((ot) => ot.orgType?.code === 'BANK')
    ).length,
    developers: allOrgs.filter((o) =>
      o.types?.some((ot) => ot.orgType?.code === 'DEVELOPER')
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

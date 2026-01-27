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
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  roles: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: string;
}

function useUsers() {
  return useQuery<User[]>({
    queryKey: queryKeys.users.all,
    queryFn: async () => {
      const res = await fetch('/api/proxy/users', {
        headers: { 'x-service': 'user' },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      return data.users || data.data || [];
    },
  });
}

function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const res = await fetch(`/api/proxy/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-service': 'user',
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update user status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const res = await fetch(`/api/proxy/users/${userId}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service': 'user',
        },
        body: JSON.stringify({ roleId }),
      });
      if (!res.ok) throw new Error('Failed to assign role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

function UsersTable({ users, filter }: { users: User[]; filter: string }) {
  const updateStatus = useUpdateUserStatus();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filteredUsers = users.filter((user) => {
    if (filter === 'all') return true;
    return user.status === filter.toUpperCase();
  });

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ userId, status: newStatus });
      toast.success('User status updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <Badge key={role} variant="outline" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      user.status === 'ACTIVE'
                        ? 'default'
                        : user.status === 'SUSPENDED'
                        ? 'destructive'
                        : 'outline'
                    }
                  >
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        Manage
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Manage User</DialogTitle>
                        <DialogDescription>{user.name} ({user.email})</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Current Status</Label>
                          <div className="flex gap-2">
                            <Button
                              variant={user.status === 'ACTIVE' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleStatusChange(user.id, 'ACTIVE')}
                              disabled={updateStatus.isPending}
                            >
                              Active
                            </Button>
                            <Button
                              variant={user.status === 'INACTIVE' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleStatusChange(user.id, 'INACTIVE')}
                              disabled={updateStatus.isPending}
                            >
                              Inactive
                            </Button>
                            <Button
                              variant={user.status === 'SUSPENDED' ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={() => handleStatusChange(user.id, 'SUSPENDED')}
                              disabled={updateStatus.isPending}
                            >
                              Suspended
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Roles</Label>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <Badge key={role} variant="secondary">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedUser(null)}>
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}

function AdminUsersContent() {
  const { data: users, isLoading, error } = useUsers();
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
        <h2 className="text-xl font-semibold mt-4">Failed to load users</h2>
        <p className="text-gray-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    );
  }

  const allUsers = users || [];
  const filteredBySearch = allUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: allUsers.length,
    active: allUsers.filter((u) => u.status === 'ACTIVE').length,
    inactive: allUsers.filter((u) => u.status === 'INACTIVE').length,
    suspended: allUsers.filter((u) => u.status === 'SUSPENDED').length,
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Suspended</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.suspended}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage user accounts and roles</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
              <TabsTrigger value="inactive">Inactive ({stats.inactive})</TabsTrigger>
              <TabsTrigger value="suspended">Suspended ({stats.suspended})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <UsersTable users={filteredBySearch} filter="all" />
            </TabsContent>
            <TabsContent value="active" className="mt-4">
              <UsersTable users={filteredBySearch} filter="active" />
            </TabsContent>
            <TabsContent value="inactive" className="mt-4">
              <UsersTable users={filteredBySearch} filter="inactive" />
            </TabsContent>
            <TabsContent value="suspended" className="mt-4">
              <UsersTable users={filteredBySearch} filter="suspended" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <ProtectedRoute roles={['admin']}>
      <AdminUsersContent />
    </ProtectedRoute>
  );
}

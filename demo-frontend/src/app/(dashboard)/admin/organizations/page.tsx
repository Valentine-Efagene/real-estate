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

function useOrganizations() {
  return useQuery<Organization[]>({
    queryKey: queryKeys.organizations.all,
    queryFn: async () => {
      const res = await fetch('/api/proxy/organizations', {
        headers: { 'x-service': 'user' },
      });
      if (!res.ok) throw new Error('Failed to fetch organizations');
      const data = await res.json();
      return data.organizations || data.data || [];
    },
  });
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
    return org.organizationTypes.some((ot) => ot.organizationType.code === filter);
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
                  {org.organizationTypes.map((ot) => (
                    <Badge
                      key={ot.id}
                      variant={getOrgTypeColor(ot.organizationType.code)}
                      className="text-xs"
                    >
                      {ot.organizationType.name}
                      {ot.isPrimary && ' ★'}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
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
                          {org.organizationTypes.map((ot) => (
                            <Badge key={ot.id} variant="secondary" className="text-sm">
                              {ot.organizationType.name}
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
    org.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: allOrgs.length,
    platform: allOrgs.filter((o) =>
      o.organizationTypes.some((ot) => ot.organizationType.code === 'PLATFORM')
    ).length,
    banks: allOrgs.filter((o) =>
      o.organizationTypes.some((ot) => ot.organizationType.code === 'BANK')
    ).length,
    developers: allOrgs.filter((o) =>
      o.organizationTypes.some((ot) => ot.organizationType.code === 'DEVELOPER')
    ).length,
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
        <Input
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
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

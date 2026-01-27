'use client';

import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApplications } from '@/lib/hooks';

function formatCurrency(amount: number, currency: string = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'default';
    case 'ACTIVE':
      return 'secondary';
    case 'PENDING':
      return 'outline';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'outline';
  }
}

function AdminApplicationsContent() {
  const { data, isLoading, error } = useApplications();
  const applications = data?.items || [];

  const pendingApps = applications.filter((a) => a.status === 'PENDING');
  const activeApps = applications.filter((a) => a.status === 'ACTIVE');
  const completedApps = applications.filter((a) => a.status === 'COMPLETED');

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600">Error loading applications</h2>
        <p className="text-gray-500 mt-2">{error.message}</p>
      </div>
    );
  }

  const ApplicationsTable = ({ apps }: { apps: typeof applications }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Application</TableHead>
          <TableHead>Applicant</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {apps.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
              No applications found
            </TableCell>
          </TableRow>
        ) : (
          apps.map((application) => (
            <TableRow key={application.id}>
              <TableCell>
                <div>
                  <p className="font-medium line-clamp-1">{application.title}</p>
                  <p className="text-xs text-gray-500">
                    {application.id.slice(0, 12)}...
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <p className="text-sm">User: {application.userId.slice(0, 8)}...</p>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{application.applicationType}</Badge>
              </TableCell>
              <TableCell>
                {formatCurrency(application.totalAmount, application.currency)}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(application.status)}>
                  {application.status}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(application.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/admin/applications/${application.id}`}>
                  <Button variant="ghost" size="sm">
                    Review
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Application Management</h1>
        <p className="text-gray-500 mt-1">
          Review and manage all property purchase applications
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Applications</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? <Skeleton className="h-9 w-16" /> : applications.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {isLoading ? <Skeleton className="h-9 w-16" /> : pendingApps.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {isLoading ? <Skeleton className="h-9 w-16" /> : activeApps.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {isLoading ? <Skeleton className="h-9 w-16" /> : completedApps.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Applications Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>All Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">
                  All ({applications.length})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({pendingApps.length})
                </TabsTrigger>
                <TabsTrigger value="active">
                  Active ({activeApps.length})
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed ({completedApps.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <ApplicationsTable apps={applications} />
              </TabsContent>
              <TabsContent value="pending">
                <ApplicationsTable apps={pendingApps} />
              </TabsContent>
              <TabsContent value="active">
                <ApplicationsTable apps={activeApps} />
              </TabsContent>
              <TabsContent value="completed">
                <ApplicationsTable apps={completedApps} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminApplicationsPage() {
  return (
    <ProtectedRoute roles={['admin', 'mortgage_ops', 'finance', 'legal']}>
      <AdminApplicationsContent />
    </ProtectedRoute>
  );
}

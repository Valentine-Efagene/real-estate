'use client';

import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

function ApplicationsContent() {
  const { data, isLoading, error } = useApplications();
  const applications = data?.items || [];

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600">Error loading applications</h2>
        <p className="text-gray-500 mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Applications</h1>
          <p className="text-gray-500 mt-1">
            Track your property purchase applications
          </p>
        </div>
        <Link href="/properties">
          <Button>New Application</Button>
        </Link>
      </div>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Applications</CardTitle>
          <CardDescription>
            {applications.length} application{applications.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold">No applications yet</h3>
              <p className="text-gray-500 mt-2">
                Start by browsing available properties
              </p>
              <Link href="/properties">
                <Button className="mt-4">Browse Properties</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{application.title}</p>
                        <p className="text-sm text-gray-500">
                          ID: {application.id.slice(0, 8)}...
                        </p>
                      </div>
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
                      <Link href={`/applications/${application.id}`}>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <ProtectedRoute>
      <ApplicationsContent />
    </ProtectedRoute>
  );
}

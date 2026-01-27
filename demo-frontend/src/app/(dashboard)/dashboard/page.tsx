'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminOnly, StaffOnly } from '@/components/auth';
import { useApplications } from '@/lib/hooks';

function DashboardContent() {
  const { user } = useAuth();
  const { data: applicationsData, isLoading } = useApplications();

  const applications = applicationsData?.items || [];
  const recentApplications = applications.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
        </h1>
        <p className="text-gray-500 mt-1">
          Here&apos;s what&apos;s happening with your account today.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Applications</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : applications.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Total applications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading
                ? '...'
                : applications.filter((a) => a.status === 'ACTIVE').length}
            </div>
            <p className="text-xs text-muted-foreground">
              In progress
            </p>
          </CardContent>
        </Card>

        <StaffOnly>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading
                  ? '...'
                  : applications.filter((a) => a.status === 'PENDING').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting action
              </p>
            </CardContent>
          </Card>
        </StaffOnly>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading
                ? '...'
                : applications.filter((a) => a.status === 'COMPLETED').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Finished
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you can perform</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link href="/properties">
              <Button variant="outline" className="w-full justify-start">
                🏠 Browse Properties
              </Button>
            </Link>
            <Link href="/applications">
              <Button variant="outline" className="w-full justify-start">
                📋 View My Applications
              </Button>
            </Link>
            <AdminOnly>
              <Link href="/admin/applications">
                <Button variant="outline" className="w-full justify-start">
                  📊 Review All Applications
                </Button>
              </Link>
            </AdminOnly>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>Your latest application activity</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : recentApplications.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-4">
                  No applications yet
                </p>
                <Link href="/properties">
                  <Button>Start Your First Application</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{app.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        app.status === 'COMPLETED'
                          ? 'default'
                          : app.status === 'ACTIVE'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {app.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin Section */}
      <AdminOnly>
        <Card>
          <CardHeader>
            <CardTitle>Admin Dashboard</CardTitle>
            <CardDescription>
              Platform management and oversight tools
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Link href="/admin/users">
              <Button variant="outline" className="w-full h-20 flex-col">
                <span className="text-2xl mb-1">👥</span>
                <span>Manage Users</span>
              </Button>
            </Link>
            <Link href="/admin/applications">
              <Button variant="outline" className="w-full h-20 flex-col">
                <span className="text-2xl mb-1">📋</span>
                <span>All Applications</span>
              </Button>
            </Link>
            <Link href="/admin/organizations">
              <Button variant="outline" className="w-full h-20 flex-col">
                <span className="text-2xl mb-1">🏢</span>
                <span>Organizations</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </AdminOnly>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

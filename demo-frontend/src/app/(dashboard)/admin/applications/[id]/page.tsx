'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useApplication, useCurrentAction, useReviewDocument } from '@/lib/hooks';
import { PhaseProgress } from '@/components/applications/phase-progress';

function formatCurrency(amount: number, currency: string = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function AdminApplicationDetailContent({ applicationId }: { applicationId: string }) {
  const { data: application, isLoading: appLoading } = useApplication(applicationId);
  const { data: currentAction, isLoading: actionLoading } = useCurrentAction(applicationId);
  const reviewDocument = useReviewDocument();

  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  const handleReviewDocument = async (
    documentId: string,
    status: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
  ) => {
    try {
      await reviewDocument.mutateAsync({
        applicationId,
        documentId,
        status,
        organizationTypeCode: 'PLATFORM',
        comment: reviewComment,
      });
      toast.success(`Document ${status.toLowerCase()}`);
      setReviewingDocId(null);
      setReviewComment('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to review document');
    }
  };

  if (appLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Application not found</h2>
        <Link href="/admin/applications">
          <Button className="mt-4">Back to Applications</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <Link href="/admin/applications">
        <Button variant="ghost">← Back to Applications</Button>
      </Link>

      {/* Application Header */}
      <div className="flex justify-between items-start">
        <div>
          <Badge variant="outline" className="mb-2">Admin Review</Badge>
          <h1 className="text-3xl font-bold tracking-tight">{application.title}</h1>
          <p className="text-gray-500 mt-1">
            Application ID: {application.id}
          </p>
        </div>
        <Badge
          variant={
            application.status === 'COMPLETED'
              ? 'default'
              : application.status === 'ACTIVE'
                ? 'secondary'
                : 'outline'
          }
          className="text-lg px-4 py-1"
        >
          {application.status}
        </Badge>
      </div>

      {/* Application Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="text-gray-500">Applicant ID:</div>
              <div className="font-medium">{application.userId}</div>
              <div className="text-gray-500">Type:</div>
              <div className="font-medium">{application.applicationType}</div>
              <div className="text-gray-500">Total Amount:</div>
              <div className="font-medium">
                {formatCurrency(application.totalAmount, application.currency)}
              </div>
              <div className="text-gray-500">Created:</div>
              <div className="font-medium">
                {new Date(application.createdAt).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {application.monthlyIncome && (
                <>
                  <div className="text-gray-500">Monthly Income:</div>
                  <div className="font-medium">
                    {formatCurrency(application.monthlyIncome, application.currency)}
                  </div>
                </>
              )}
              {application.monthlyExpenses && (
                <>
                  <div className="text-gray-500">Monthly Expenses:</div>
                  <div className="font-medium">
                    {formatCurrency(application.monthlyExpenses, application.currency)}
                  </div>
                </>
              )}
              {application.monthlyIncome && application.monthlyExpenses && (
                <>
                  <div className="text-gray-500">DTI Ratio:</div>
                  <div className="font-medium">
                    {((application.monthlyExpenses / application.monthlyIncome) * 100).toFixed(1)}%
                  </div>
                </>
              )}
              {application.applicantAge && (
                <>
                  <div className="text-gray-500">Applicant Age:</div>
                  <div className="font-medium">{application.applicantAge} years</div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Phase Progress */}
      <PhaseProgress applicationId={applicationId} phases={application.phases || []} />

      <Separator />

      {/* Document Review Section */}
      {actionLoading ? (
        <Skeleton className="h-48" />
      ) : currentAction?.phase.category === 'DOCUMENTATION' && currentAction.requiredDocuments ? (
        <Card>
          <CardHeader>
            <CardTitle>Document Review</CardTitle>
            <CardDescription>
              Review uploaded documents for this phase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentAction.requiredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-sm text-gray-500">{doc.description}</p>
                    <Badge
                      variant={
                        doc.status === 'APPROVED'
                          ? 'default'
                          : doc.status === 'REJECTED'
                            ? 'destructive'
                            : 'outline'
                      }
                      className="mt-2"
                    >
                      {doc.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {doc.status === 'UPLOADED' && (
                      <>
                        <Dialog
                          open={reviewingDocId === doc.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setReviewingDocId(null);
                              setReviewComment('');
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReviewingDocId(doc.id)}
                            >
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Review Document</DialogTitle>
                              <DialogDescription>
                                {doc.name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="comment">Comment (optional)</Label>
                                <Input
                                  id="comment"
                                  placeholder="Add a comment..."
                                  value={reviewComment}
                                  onChange={(e) => setReviewComment(e.target.value)}
                                />
                              </div>
                            </div>
                            <DialogFooter className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => handleReviewDocument(doc.id, 'CHANGES_REQUESTED')}
                                disabled={reviewDocument.isPending}
                              >
                                Request Changes
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleReviewDocument(doc.id, 'REJECTED')}
                                disabled={reviewDocument.isPending}
                              >
                                Reject
                              </Button>
                              <Button
                                onClick={() => handleReviewDocument(doc.id, 'APPROVED')}
                                disabled={reviewDocument.isPending}
                              >
                                Approve
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <span className="text-4xl">📋</span>
            <h3 className="text-lg font-semibold mt-4">No documents to review</h3>
            <p className="text-gray-500">
              {currentAction
                ? `Current phase: ${currentAction.phase.name} (${currentAction.phase.category})`
                : 'Application is awaiting the next phase'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedRoute roles={['admin', 'mortgage_ops', 'finance', 'legal']}>
      <AdminApplicationDetailContent applicationId={id} />
    </ProtectedRoute>
  );
}

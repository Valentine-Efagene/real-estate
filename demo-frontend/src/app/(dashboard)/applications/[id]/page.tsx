'use client';

import { use } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useApplication, useCurrentAction } from '@/lib/hooks';
import { DocumentUploadSection } from '@/components/applications/document-upload-section';
import { PhaseProgress } from '@/components/applications/phase-progress';

function formatCurrency(amount: number, currency: string = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function ApplicationDetailContent({ applicationId }: { applicationId: string }) {
  const { data: application, isLoading: appLoading } = useApplication(applicationId);
  const { data: currentAction, isLoading: actionLoading } = useCurrentAction(applicationId);

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
        <Link href="/applications">
          <Button className="mt-4">Back to Applications</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <Link href="/applications">
        <Button variant="ghost">← Back to Applications</Button>
      </Link>

      {/* Application Header */}
      <div className="flex justify-between items-start">
        <div>
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
              <div className="text-gray-500">Last Updated:</div>
              <div className="font-medium">
                {new Date(application.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
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
              {application.applicantAge && (
                <>
                  <div className="text-gray-500">Applicant Age:</div>
                  <div className="font-medium">{application.applicantAge} years</div>
                </>
              )}
              {application.selectedMortgageTermMonths && (
                <>
                  <div className="text-gray-500">Mortgage Term:</div>
                  <div className="font-medium">
                    {application.selectedMortgageTermMonths / 12} years
                  </div>
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

      {/* Current Action Required */}
      {actionLoading ? (
        <Skeleton className="h-48" />
      ) : currentAction ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <div>
                <CardTitle>Action Required</CardTitle>
                <CardDescription>{currentAction.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentAction.phase.category === 'DOCUMENTATION' && currentAction.requiredDocuments && (
              <DocumentUploadSection
                applicationId={applicationId}
                phaseId={currentAction.phase.id}
                requiredDocuments={currentAction.requiredDocuments}
              />
            )}

            {currentAction.phase.category === 'QUESTIONNAIRE' && currentAction.pendingQuestions && (
              <div className="space-y-4">
                <h4 className="font-semibold">Complete the following questions:</h4>
                <ul className="list-disc pl-6 space-y-2">
                  {currentAction.pendingQuestions.map((q) => (
                    <li key={q.id}>{q.question}</li>
                  ))}
                </ul>
                <Button>Answer Questions</Button>
              </div>
            )}

            {currentAction.phase.category === 'PAYMENT' && currentAction.pendingPayments && (
              <div className="space-y-4">
                <h4 className="font-semibold">Pending Payments:</h4>
                {currentAction.pendingPayments.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center p-4 bg-white rounded-lg">
                    <div>
                      <p className="font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Due: {new Date(payment.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Button>Make Payment</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <span className="text-4xl">✅</span>
            <h3 className="text-lg font-semibold mt-4">No action required</h3>
            <p className="text-gray-500">
              Your application is being processed. You&apos;ll be notified when action is needed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedRoute>
      <ApplicationDetailContent applicationId={id} />
    </ProtectedRoute>
  );
}

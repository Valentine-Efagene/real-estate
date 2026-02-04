'use client';

import { use } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useApplication, useCurrentAction, useApplicationPhases, type Phase } from '@/lib/hooks';
import { DocumentUploadSection } from '@/components/applications/document-upload-section';
import { PhaseProgress } from '@/components/applications/phase-progress';
import { QuestionnaireForm, type QuestionnaireField } from '@/components/applications/questionnaire-form';
import { PaymentSection } from '@/components/applications/payment-section';

function formatCurrency(amount: number, currency: string = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function ApplicationDetailContent({ applicationId }: { applicationId: string }) {
  const { data: application, isLoading: appLoading, refetch: refetchApplication } = useApplication(applicationId);
  const { data: currentAction, isLoading: actionLoading } = useCurrentAction(applicationId);
  const { data: phases } = useApplicationPhases(applicationId);

  // Get current phase details
  const currentPhase = phases?.find(
    (p) => p.id === currentAction?.currentPhase?.id
  );

  // Extract questionnaire fields from the phase's fieldsSnapshot
  const questionnaireFields: QuestionnaireField[] | undefined = currentPhase?.questionnairePhase?.fieldsSnapshot?.questions?.map(q => ({
    id: q.questionKey,
    name: q.questionKey,
    label: q.questionText,
    description: q.helpText,
    placeholder: null,
    fieldType: q.questionType,
    isRequired: q.isRequired,
    order: q.order,
    validation: q.validationRules,
    displayCondition: null,
    defaultValue: null,
    answer: q.answer,
    options: q.options,
  }));

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
      ) : currentAction && currentAction.currentPhase ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <div>
                <CardTitle>Action Required</CardTitle>
                <CardDescription>
                  {currentAction.actionMessage}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentAction.currentPhase.phaseCategory === 'DOCUMENTATION' && currentAction.currentStep?.requiredDocuments && (
              <DocumentUploadSection
                applicationId={applicationId}
                phaseId={currentAction.currentPhase.id}
                requiredDocuments={currentAction.currentStep.requiredDocuments.map(doc => ({
                  id: doc.documentType,
                  name: doc.documentType,
                  description: doc.documentType,
                  status: 'PENDING',
                }))}
              />
            )}

            {currentAction.actionRequired === 'QUESTIONNAIRE' && questionnaireFields && questionnaireFields.length > 0 && (
              <QuestionnaireForm
                applicationId={applicationId}
                phaseId={currentAction.currentPhase.id}
                fields={questionnaireFields}
                phaseName={currentAction.currentPhase.name}
                onSubmitSuccess={() => refetchApplication()}
              />
            )}

            {currentAction.actionRequired === 'QUESTIONNAIRE' && (!questionnaireFields || questionnaireFields.length === 0) && (
              <div className="text-center py-4">
                <p className="text-gray-500">No questions to answer for this phase.</p>
              </div>
            )}

            {currentAction.currentPhase.phaseCategory === 'QUESTIONNAIRE' && currentAction.actionRequired === 'WAIT_FOR_REVIEW' && (
              <div className="text-center py-4">
                <p className="text-gray-500">Your questionnaire answers have been submitted and are under review.</p>
              </div>
            )}

            {currentAction.currentPhase.phaseCategory === 'PAYMENT' && currentPhase && (
              <PaymentSection
                applicationId={applicationId}
                phaseId={currentAction.currentPhase.id}
                phaseName={currentAction.currentPhase.name}
                totalAmount={currentPhase.totalAmount || 0}
                paidAmount={currentPhase.paidAmount || 0}
                currency={application.currency}
                installments={currentPhase.installments || []}
                onPaymentSuccess={() => refetchApplication()}
              />
            )}
          </CardContent>
        </Card>
      ) : currentAction && currentAction.actionRequired !== 'NONE' ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <div>
                <CardTitle>Action Required</CardTitle>
                <CardDescription>{currentAction.actionMessage}</CardDescription>
              </div>
            </div>
          </CardHeader>
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

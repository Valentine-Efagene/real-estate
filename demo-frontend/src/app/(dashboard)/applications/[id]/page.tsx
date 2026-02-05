'use client';

import { use } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth';
import { useAuth } from '@/lib/auth';
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

// Staff roles that can review applications
const STAFF_ROLES = ['admin', 'mortgage_ops', 'finance', 'legal', 'lender_ops', 'agent'];

function ApplicationDetailContent({ applicationId }: { applicationId: string }) {
  const { user } = useAuth();
  const { data: application, isLoading: appLoading, refetch: refetchApplication } = useApplication(applicationId);
  const { data: currentAction, isLoading: actionLoading } = useCurrentAction(applicationId);
  const { data: phases } = useApplicationPhases(applicationId);

  // Check if user is staff
  const isStaff = user?.roles?.some(role => STAFF_ROLES.includes(role)) ?? false;

  // Check if user is the actual applicant (owner) of this application
  const isApplicant = application?.buyerId === user?.userId;

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

  // Staff members who are NOT the applicant should be redirected to the review page
  // This prevents staff from accidentally using customer controls on someone else's application
  if (isStaff && !isApplicant) {
    redirect(`/admin/applications/${applicationId}`);
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Applicant Info */}
        <Card>
          <CardHeader>
            <CardTitle>Applicant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {application.buyer
                    ? `${application.buyer.firstName?.[0] || ''}${application.buyer.lastName?.[0] || ''}`.toUpperCase()
                    : '?'}
                </span>
              </div>
              <div>
                <p className="font-medium">
                  {application.buyer
                    ? `${application.buyer.firstName} ${application.buyer.lastName}`
                    : 'Unknown Applicant'}
                </p>
                {application.buyer?.email && (
                  <p className="text-sm text-gray-500">{application.buyer.email}</p>
                )}
              </div>
            </div>
            {application.applicantAge && (
              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                <div className="text-gray-500">Age:</div>
                <div className="font-medium">{application.applicantAge} years</div>
              </div>
            )}
          </CardContent>
        </Card>

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
        (() => {
          const phase = currentAction.currentPhase!;
          // For documentation phases, check if the current stage is for the customer
          const isDocPhase = phase.phaseCategory === 'DOCUMENTATION';
          const currentStepType = currentAction.currentStep?.stepType;
          // Stage is customer-facing if stepType is CUSTOMER or not set
          const isCustomerStage = !currentStepType || currentStepType === 'CUSTOMER';
          // Filter documents that the customer needs to upload
          const customerDocs = currentAction.currentStep?.requiredDocuments?.filter(
            (doc: any) => !doc.uploadedBy || doc.uploadedBy === 'CUSTOMER'
          ) || [];
          // Customer has action only if: not a doc phase, OR it's a customer stage with customer docs
          const hasCustomerAction = !isDocPhase || (isCustomerStage && customerDocs.length > 0);
          // Get a friendly name for the current party (but not "customer" since user IS customer)
          const currentParty = currentStepType && currentStepType !== 'CUSTOMER'
            ? currentStepType.toLowerCase().replace('_', ' ')
            : 'the reviewing team';

          // Determine the right message for the header
          const getHeaderMessage = () => {
            if (hasCustomerAction) {
              return currentAction.actionMessage;
            }
            // Customer stage with no docs = all docs submitted, awaiting review
            if (isCustomerStage && customerDocs.length === 0) {
              return 'Your documents have been submitted. Awaiting review.';
            }
            // Non-customer stage = waiting for other party
            return `Waiting for ${currentParty} to complete: ${currentAction.currentStep?.name || 'their tasks'}`;
          };

          return (
            <Card className={hasCustomerAction ? "bg-primary/5 border-primary/20" : "bg-gray-50 border-gray-200"}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{hasCustomerAction ? '⚡' : '⏳'}</span>
                  <div>
                    <CardTitle>{hasCustomerAction ? 'Action Required' : 'In Progress'}</CardTitle>
                    <CardDescription>
                      {getHeaderMessage()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Show uploaded documents for customer to review/accept */}
                {isDocPhase && currentAction.uploadedDocuments && currentAction.uploadedDocuments.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium mb-3">Documents for Review</h4>
                    <div className="space-y-3">
                      {currentAction.uploadedDocuments.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-blue-100 flex items-center justify-center">
                              <span className="text-blue-600">📄</span>
                            </div>
                            <div>
                              <p className="font-medium">{doc.name || doc.type}</p>
                              <p className="text-sm text-gray-500">
                                {doc.uploadedBy && doc.uploadedBy !== 'CUSTOMER'
                                  ? `Uploaded by ${doc.uploadedBy.toLowerCase()}`
                                  : 'Your document'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={doc.status === 'APPROVED' ? 'default' : doc.status === 'PENDING' ? 'secondary' : 'outline'}>
                              {doc.status}
                            </Badge>
                            {doc.url && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                  View
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {isCustomerStage && customerDocs.length === 0 && currentAction.uploadedDocuments.some((d: any) => d.uploadedBy !== 'CUSTOMER' && d.status === 'PENDING') && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-amber-800 font-medium">Action Required</p>
                        <p className="text-amber-700 text-sm mt-1">
                          Please review the documents above. Once reviewed, you can proceed with acceptance.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isDocPhase && !isCustomerStage && (
                  <div className="text-center py-4">
                    <p className="text-gray-600">Waiting for {currentParty} to upload their documents.</p>
                    <p className="text-sm text-gray-500 mt-2">You will be notified when action is required from you.</p>
                  </div>
                )}

                {isDocPhase && isCustomerStage && customerDocs.length > 0 && (
                  <DocumentUploadSection
                    applicationId={applicationId}
                    phaseId={phase.id}
                    requiredDocuments={customerDocs.map((doc: any) => ({
                      id: doc.documentType,
                      name: doc.name || doc.documentType,
                      description: doc.documentType,
                      status: 'PENDING',
                    }))}
                  />
                )}

                {isDocPhase && isCustomerStage && customerDocs.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-gray-500">All required documents for this stage have been submitted.</p>
                    <p className="text-sm text-gray-400 mt-2">The review team will process your application shortly.</p>
                  </div>
                )}

                {currentAction.actionRequired === 'QUESTIONNAIRE' && questionnaireFields && questionnaireFields.length > 0 && (
                  <QuestionnaireForm
                    applicationId={applicationId}
                    phaseId={phase.id}
                    fields={questionnaireFields}
                    phaseName={phase.name}
                    onSubmitSuccess={() => refetchApplication()}
                  />
                )}

                {currentAction.actionRequired === 'QUESTIONNAIRE' && (!questionnaireFields || questionnaireFields.length === 0) && (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No questions to answer for this phase.</p>
                  </div>
                )}

                {phase.phaseCategory === 'QUESTIONNAIRE' && currentAction.actionRequired === 'WAIT_FOR_REVIEW' && (
                  <div className="text-center py-4">
                    {isStaff ? (
                      <>
                        <p className="text-gray-600 mb-4">The applicant&apos;s questionnaire is awaiting review.</p>
                        <Link href={`/admin/applications/${applicationId}`}>
                          <Button>Review Questionnaire</Button>
                        </Link>
                      </>
                    ) : (
                      <p className="text-gray-500">Your questionnaire answers have been submitted and are under review.</p>
                    )}
                  </div>
                )}

                {phase.phaseCategory === 'PAYMENT' && currentPhase && (
                  <PaymentSection
                    applicationId={applicationId}
                    phaseId={phase.id}
                    phaseName={phase.name}
                    totalAmount={currentPhase.totalAmount || 0}
                    paidAmount={currentPhase.paidAmount || 0}
                    currency={application.currency}
                    installments={currentPhase.installments || []}
                    buyerEmail={application.buyer?.email}
                    onPaymentSuccess={() => refetchApplication()}
                  />
                )}
              </CardContent>
            </Card>
          );
        })()
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

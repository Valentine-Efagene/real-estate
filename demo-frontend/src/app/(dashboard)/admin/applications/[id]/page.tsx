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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  useApplication,
  useCurrentAction,
  useReviewDocument,
  useApplicationPhases,
  useReviewQuestionnaire,
  useApplicationOrganizations,
  useBindOrganization,
  type QuestionnaireField
} from '@/lib/hooks';
import { useOrganizations } from '@/lib/hooks/use-organizations';
import { PhaseProgress } from '@/components/applications/phase-progress';
import { PartnerDocumentUpload } from '@/components/applications/partner-document-upload';

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
  const { data: phases } = useApplicationPhases(applicationId);
  const { data: boundOrganizations, isLoading: orgsLoading } = useApplicationOrganizations(applicationId);
  const { data: allOrganizations } = useOrganizations();
  const reviewDocument = useReviewDocument();
  const reviewQuestionnaire = useReviewQuestionnaire();
  const bindOrganization = useBindOrganization();

  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [questionnaireReviewNotes, setQuestionnaireReviewNotes] = useState('');
  const [showQuestionnaireReview, setShowQuestionnaireReview] = useState(false);
  const [showBindOrgDialog, setShowBindOrgDialog] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedOrgType, setSelectedOrgType] = useState('BANK');
  const [slaHours, setSlaHours] = useState('48');

  // Get current phase with questionnaire fields
  type Phase = NonNullable<typeof phases>[number];
  const currentPhaseWithFields = phases?.find(
    (p) => p.id === currentAction?.currentPhase?.id
  ) as (Phase & { fields?: QuestionnaireField[] }) | undefined;

  // Filter out already bound organizations
  const boundOrgIds = new Set(boundOrganizations?.map(bo => bo.organizationId) || []);
  const availableOrganizations = allOrganizations?.filter(org => !boundOrgIds.has(org.id)) || [];

  const handleBindOrganization = async () => {
    if (!selectedOrgId || !selectedOrgType) {
      toast.error('Please select an organization and type');
      return;
    }

    try {
      await bindOrganization.mutateAsync({
        applicationId,
        organizationId: selectedOrgId,
        organizationTypeCode: selectedOrgType,
        isPrimary: true,
        slaHours: parseInt(slaHours) || 48,
      });
      toast.success('Organization bound successfully');
      setShowBindOrgDialog(false);
      setSelectedOrgId('');
      setSelectedOrgType('BANK');
      setSlaHours('48');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to bind organization');
    }
  };

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

  const handleReviewQuestionnaire = async (decision: 'APPROVE' | 'REJECT') => {
    if (!currentAction?.currentPhase?.id) return;

    try {
      await reviewQuestionnaire.mutateAsync({
        applicationId,
        phaseId: currentAction.currentPhase.id,
        decision,
        notes: questionnaireReviewNotes,
      });
      toast.success(`Questionnaire ${decision.toLowerCase()}d successfully`);
      setShowQuestionnaireReview(false);
      setQuestionnaireReviewNotes('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to review questionnaire');
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
              <div className="text-gray-500">Applicant:</div>
              <div className="font-medium">
                {application.buyer
                  ? `${application.buyer.firstName} ${application.buyer.lastName}`
                  : application.buyerId?.slice(0, 8) + '...'}
              </div>
              {application.buyer?.email && (
                <>
                  <div className="text-gray-500">Email:</div>
                  <div className="font-medium">{application.buyer.email}</div>
                </>
              )}
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

      {/* Bound Organizations Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Bound Organizations</CardTitle>
              <CardDescription>
                Organizations participating in this application
              </CardDescription>
            </div>
            <Dialog open={showBindOrgDialog} onOpenChange={setShowBindOrgDialog}>
              <DialogTrigger asChild>
                <Button size="sm">+ Bind Organization</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bind Organization</DialogTitle>
                  <DialogDescription>
                    Add an organization (e.g., bank, developer) to this application
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOrganizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role Type</Label>
                    <Select value={selectedOrgType} onValueChange={setSelectedOrgType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BANK">Bank / Lender</SelectItem>
                        <SelectItem value="DEVELOPER">Developer</SelectItem>
                        <SelectItem value="LEGAL">Legal</SelectItem>
                        <SelectItem value="INSURER">Insurer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sla">SLA Hours</Label>
                    <Input
                      id="sla"
                      type="number"
                      value={slaHours}
                      onChange={(e) => setSlaHours(e.target.value)}
                      placeholder="48"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleBindOrganization}
                    disabled={bindOrganization.isPending || !selectedOrgId}
                  >
                    {bindOrganization.isPending ? 'Binding...' : 'Bind Organization'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {orgsLoading ? (
            <Skeleton className="h-24" />
          ) : boundOrganizations && boundOrganizations.length > 0 ? (
            <div className="space-y-3">
              {boundOrganizations.map((binding) => (
                <div
                  key={binding.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{binding.organization?.name || 'Unknown'}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{binding.assignedAsType?.code || 'N/A'}</Badge>
                      <Badge
                        variant={binding.status === 'ACTIVE' ? 'default' : 'secondary'}
                      >
                        {binding.status}
                      </Badge>
                      {binding.isPrimary && <Badge variant="secondary">Primary</Badge>}
                    </div>
                    {binding.slaHours && (
                      <p className="text-sm text-gray-500 mt-1">SLA: {binding.slaHours} hours</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No organizations bound yet</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Document Review Section */}
      {actionLoading ? (
        <Skeleton className="h-48" />
      ) : currentAction?.currentPhase?.phaseCategory === 'DOCUMENTATION' && currentAction.uploadedDocuments?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Document Review</CardTitle>
            <CardDescription>
              Review uploaded documents for this phase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentAction.uploadedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-sm text-gray-500">{doc.type}</p>
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
                    {doc.status === 'PENDING' && (
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
      ) : currentAction?.currentPhase?.phaseCategory === 'QUESTIONNAIRE' && currentPhaseWithFields?.fields ? (
        <Card>
          <CardHeader>
            <CardTitle>Questionnaire Review</CardTitle>
            <CardDescription>
              Review the applicant&apos;s submitted answers for {currentAction.currentPhase.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Display submitted answers */}
            <div className="space-y-4 mb-6">
              {currentPhaseWithFields.fields
                .filter((field) => field.answer !== null && field.answer !== undefined)
                .sort((a, b) => a.order - b.order)
                .map((field) => (
                  <div key={field.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-700">{field.label}</p>
                        {field.description && (
                          <p className="text-sm text-gray-500">{field.description}</p>
                        )}
                      </div>
                      <Badge variant="outline">{field.fieldType}</Badge>
                    </div>
                    <div className="mt-2 p-3 bg-gray-50 rounded">
                      <p className="font-medium">
                        {field.fieldType === 'CURRENCY' && '₦'}
                        {String(field.answer)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>

            {/* No answers submitted yet */}
            {currentPhaseWithFields.fields.every(
              (field) => field.answer === null || field.answer === undefined
            ) && (
                <div className="text-center py-8 text-gray-500">
                  <p>The applicant has not submitted their answers yet.</p>
                </div>
              )}

            {/* Review actions */}
            {currentPhaseWithFields.fields.some(
              (field) => field.answer !== null && field.answer !== undefined
            ) && currentAction.currentPhase?.status === 'AWAITING_APPROVAL' && (
                <Dialog open={showQuestionnaireReview} onOpenChange={setShowQuestionnaireReview}>
                  <DialogTrigger asChild>
                    <Button className="w-full">Review Questionnaire</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Review Questionnaire</DialogTitle>
                      <DialogDescription>
                        Approve or reject the applicant&apos;s submitted answers
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="notes">Review Notes (optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Add notes about your decision..."
                          value={questionnaireReviewNotes}
                          onChange={(e) => setQuestionnaireReviewNotes(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleReviewQuestionnaire('REJECT')}
                        disabled={reviewQuestionnaire.isPending}
                      >
                        Reject
                      </Button>
                      <Button
                        onClick={() => handleReviewQuestionnaire('APPROVE')}
                        disabled={reviewQuestionnaire.isPending}
                      >
                        Approve
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <span className="text-4xl">📋</span>
            <h3 className="text-lg font-semibold mt-4">No action required</h3>
            <p className="text-gray-500">
              {currentAction?.currentPhase
                ? `Current phase: ${currentAction.currentPhase.name} (${currentAction.currentPhase.phaseCategory})`
                : 'Application is awaiting the next phase'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Partner Document Upload Section */}
      {currentAction?.currentPhase?.phaseCategory === 'DOCUMENTATION' && (
        <>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            {/* Developer uploads */}
            {boundOrganizations?.some(org => org.assignedAsType?.code === 'DEVELOPER') && (
              <PartnerDocumentUpload
                applicationId={applicationId}
                phaseId={currentAction.currentPhase.id}
                phaseName={currentAction.currentPhase.name}
                role="DEVELOPER"
              />
            )}
            {/* Lender uploads */}
            {boundOrganizations?.some(org => org.assignedAsType?.code === 'BANK') && (
              <PartnerDocumentUpload
                applicationId={applicationId}
                phaseId={currentAction.currentPhase.id}
                phaseName={currentAction.currentPhase.name}
                role="LENDER"
              />
            )}
            {/* Platform admin uploads */}
            <PartnerDocumentUpload
              applicationId={applicationId}
              phaseId={currentAction.currentPhase.id}
              phaseName={currentAction.currentPhase.name}
              role="PLATFORM"
            />
          </div>
        </>
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

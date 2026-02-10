'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute, AdminOnly } from '@/components/auth';
import { useAuth } from '@/lib/auth';
import { getPresignedGetUrl } from '@/lib/hooks/use-documents';
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
  useCancelApplication,
  type QuestionnaireField
} from '@/lib/hooks';
import { useOrganizations, useUserProfile, getUserOrganizationTypeCode } from '@/lib/hooks/use-organizations';
import { useUserWallet, useCreateUserWallet, useCreditWallet } from '@/lib/hooks/use-wallet';
import { PhaseProgress } from '@/components/applications/phase-progress';
import { PartnerDocumentUpload } from '@/components/applications/partner-document-upload';

// Role mappings for determining which uploads to show (fallback when no org membership)
const ROLE_TO_UPLOAD_TYPE: Record<string, 'PLATFORM' | 'LENDER' | 'DEVELOPER' | null> = {
  admin: 'PLATFORM',
  mortgage_ops: 'PLATFORM',
  finance: 'PLATFORM',
  legal: 'PLATFORM',
  lender_ops: 'LENDER',
  agent: 'DEVELOPER',
};

function formatCurrency(amount: number, currency: string = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function AdminApplicationDetailContent({ applicationId }: { applicationId: string }) {
  const { user } = useAuth();
  const { data: userProfile } = useUserProfile();
  const { data: application, isLoading: appLoading } = useApplication(applicationId);
  const { data: currentAction, isLoading: actionLoading } = useCurrentAction(applicationId);
  const { data: phases } = useApplicationPhases(applicationId);
  const { data: boundOrganizations, isLoading: orgsLoading } = useApplicationOrganizations(applicationId);
  const { data: allOrganizations } = useOrganizations();
  const reviewDocument = useReviewDocument();
  const reviewQuestionnaire = useReviewQuestionnaire();
  const bindOrganization = useBindOrganization();
  const cancelApplication = useCancelApplication();
  const { data: buyerWallet, isLoading: walletLoading, error: walletError } = useUserWallet(application?.buyerId);
  const createUserWallet = useCreateUserWallet();
  const creditWallet = useCreditWallet();

  // Cancel application state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Get user's organization type from their membership (dynamic from backend)
  const userOrgTypeCode = getUserOrganizationTypeCode(userProfile);

  // Determine what upload type this user can perform based on their organization or roles (fallback)
  const userUploadType = userOrgTypeCode
    ? (userOrgTypeCode === 'BANK' ? 'LENDER' : userOrgTypeCode === 'DEVELOPER' ? 'DEVELOPER' : 'PLATFORM') as 'PLATFORM' | 'LENDER' | 'DEVELOPER'
    : user?.roles?.map(role => ROLE_TO_UPLOAD_TYPE[role]).find(t => t) || null;
  const isAdmin = user?.roles?.includes('admin') ?? false;

  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [questionnaireReviewNotes, setQuestionnaireReviewNotes] = useState('');
  const [showQuestionnaireReview, setShowQuestionnaireReview] = useState(false);
  const [showBindOrgDialog, setShowBindOrgDialog] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedOrgType, setSelectedOrgType] = useState('BANK');
  const [slaHours, setSlaHours] = useState('48');
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [presignedUrls, setPresignedUrls] = useState<Record<string, string>>({});
  const [loadingPresignedUrl, setLoadingPresignedUrl] = useState<string | null>(null);

  // Get presigned URL for viewing a document
  const getDocumentViewUrl = useCallback(async (docId: string, s3Key: string) => {
    // Check cache first
    if (presignedUrls[docId]) {
      return presignedUrls[docId];
    }

    setLoadingPresignedUrl(docId);
    try {
      const presignedUrl = await getPresignedGetUrl(s3Key);
      setPresignedUrls(prev => ({ ...prev, [docId]: presignedUrl }));
      return presignedUrl;
    } catch (error) {
      toast.error('Failed to get document URL');
      throw error;
    } finally {
      setLoadingPresignedUrl(null);
    }
  }, [presignedUrls]);

  // Handle View button click
  const handleViewDocument = async (docId: string, s3Key: string) => {
    try {
      const url = await getDocumentViewUrl(docId, s3Key);
      window.open(url, '_blank');
    } catch {
      // Error already shown in toast
    }
  };

  // Preload presigned URL when opening review dialog
  const handleOpenReviewDialog = async (docId: string, s3Key: string | null) => {
    setReviewingDocId(docId);
    if (s3Key && !presignedUrls[docId]) {
      try {
        await getDocumentViewUrl(docId, s3Key);
      } catch {
        // Non-fatal, preview just won't work
      }
    }
  };

  // Get current phase with questionnaire fields
  type Phase = NonNullable<typeof phases>[number];
  const currentPhase = phases?.find(
    (p) => p.id === currentAction?.currentPhase?.id
  ) as Phase | undefined;

  // Extract questionnaire fields from the flattened fields array (QuestionnaireField records)
  // The backend flattens questionnairePhase.fields to phase.fields
  const questionnaireFields: QuestionnaireField[] | undefined = currentPhase?.fields?.map(f => ({
    id: f.id,
    name: f.name,
    label: f.label,
    description: f.description,
    placeholder: f.placeholder,
    fieldType: f.fieldType,
    isRequired: f.isRequired,
    order: f.order,
    validation: f.validation,
    displayCondition: f.displayCondition,
    defaultValue: f.defaultValue,
    answer: f.answer,
    options: f.options,
  }));

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
    // Use organization type from user's profile, fallback to PLATFORM for admins without org membership
    const orgTypeCode = userOrgTypeCode || 'PLATFORM';

    try {
      await reviewDocument.mutateAsync({
        applicationId,
        documentId,
        status,
        organizationTypeCode: orgTypeCode,
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
        <div className="flex items-center gap-3">
          {application.status !== 'CANCELLED' && application.status !== 'COMPLETED' && (
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">Cancel Application</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Application</DialogTitle>
                  <DialogDescription>
                    This will cancel the application permanently. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="cancel-reason">Reason for cancellation</Label>
                    <Textarea
                      id="cancel-reason"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g., Customer requested cancellation, duplicate application..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Go Back</Button>
                  <Button
                    variant="destructive"
                    disabled={cancelApplication.isPending}
                    onClick={async () => {
                      try {
                        await cancelApplication.mutateAsync({
                          applicationId,
                          reason: cancelReason || undefined,
                        });
                        toast.success('Application cancelled');
                        setShowCancelDialog(false);
                        setCancelReason('');
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Failed to cancel application');
                      }
                    }}
                  >
                    {cancelApplication.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Badge
            variant={
              application.status === 'COMPLETED'
                ? 'default'
                : application.status === 'ACTIVE'
                  ? 'secondary'
                  : application.status === 'CANCELLED'
                    ? 'destructive'
                    : 'outline'
            }
            className="text-lg px-4 py-1"
          >
            {application.status}
          </Badge>
        </div>
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
            <AdminOnly>
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
            </AdminOnly>
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

      {/* Buyer Wallet Management */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Buyer Wallet</CardTitle>
              <CardDescription>
                {application.buyer
                  ? `${application.buyer.firstName} ${application.buyer.lastName}'s wallet`
                  : 'Buyer wallet'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {walletLoading ? (
            <Skeleton className="h-16" />
          ) : buyerWallet && !walletError ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50">
                <div>
                  <p className="text-sm text-gray-500">Balance</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(buyerWallet.balance, application.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{buyerWallet.currency}</Badge>
                  <Link href="/admin/transactions">
                    <Button variant="outline" size="sm">View Transactions</Button>
                  </Link>
                  <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">Credit Wallet</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Credit Buyer Wallet</DialogTitle>
                        <DialogDescription>
                          Add funds to the buyer&apos;s wallet. Funds will be auto-allocated to pending installments.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            Current balance: <span className="font-semibold">{formatCurrency(buyerWallet.balance, application.currency)}</span>
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-credit-amount">Amount</Label>
                          <Input
                            id="admin-credit-amount"
                            type="number"
                            placeholder="Enter amount..."
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-credit-desc">Description (optional)</Label>
                          <Input
                            id="admin-credit-desc"
                            placeholder="e.g. Bank transfer received"
                            value={creditDescription}
                            onChange={(e) => setCreditDescription(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          disabled={creditWallet.isPending || !creditAmount}
                          onClick={async () => {
                            const amount = parseFloat(creditAmount);
                            if (isNaN(amount) || amount <= 0) {
                              toast.error('Enter a valid positive amount');
                              return;
                            }
                            try {
                              await creditWallet.mutateAsync({
                                walletId: buyerWallet.id,
                                amount,
                                reference: `ADMIN-${applicationId.slice(0, 8)}-${Date.now()}`,
                                description: creditDescription || `Admin credit for application ${applicationId.slice(0, 8)}`,
                              });
                              toast.success('Wallet credited — funds will auto-allocate to installments');
                              setShowCreditDialog(false);
                              setCreditAmount('');
                              setCreditDescription('');
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : 'Failed to credit wallet');
                            }
                          }}
                        >
                          {creditWallet.isPending ? 'Processing...' : `Credit ${creditAmount ? formatCurrency(parseFloat(creditAmount) || 0, application.currency) : 'Wallet'}`}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50">
              <div>
                <p className="text-sm text-gray-500">No wallet created yet</p>
                <p className="text-xs text-gray-400">A wallet is auto-created when a payment phase starts. You can also create one manually.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={createUserWallet.isPending}
                onClick={async () => {
                  try {
                    await createUserWallet.mutateAsync({ userId: application.buyerId, currency: application.currency || 'NGN' });
                    toast.success('Wallet created successfully');
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Failed to create wallet');
                  }
                }}
              >
                {createUserWallet.isPending ? 'Creating...' : 'Create Wallet'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      {actionLoading ? (
        <Skeleton className="h-48" />
      ) : currentAction?.partyActions && Object.keys(currentAction.partyActions).length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Action Status</CardTitle>
                <CardDescription>
                  Current phase: {currentAction.currentPhase?.name || 'N/A'}
                </CardDescription>
              </div>
              {currentAction.userPartyType && (
                <Badge variant="outline" className="text-sm">
                  You are: {currentAction.userPartyType}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(currentAction.partyActions).map(([party, actionInfo]) => {
                const isUserParty = party === currentAction.userPartyType;
                const actionColors: Record<string, string> = {
                  UPLOAD: 'bg-blue-50 border-blue-200 text-blue-800',
                  REVIEW: 'bg-purple-50 border-purple-200 text-purple-800',
                  WAIT: 'bg-gray-50 border-gray-200 text-gray-600',
                  PAYMENT: 'bg-green-50 border-green-200 text-green-800',
                  QUESTIONNAIRE: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                  NONE: 'bg-gray-50 border-gray-200 text-gray-500',
                };
                const actionIcons: Record<string, string> = {
                  UPLOAD: '📤',
                  REVIEW: '👀',
                  WAIT: '⏳',
                  PAYMENT: '💳',
                  QUESTIONNAIRE: '📝',
                  NONE: '✓',
                };

                return (
                  <div
                    key={party}
                    className={`p-4 rounded-lg border-2 ${actionColors[actionInfo.action] || 'bg-gray-50 border-gray-200'} ${isUserParty ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{actionIcons[actionInfo.action] || '❓'}</span>
                        <span className="font-semibold">{party}</span>
                      </div>
                      <Badge variant={actionInfo.action === 'WAIT' || actionInfo.action === 'NONE' ? 'secondary' : 'default'}>
                        {actionInfo.action}
                      </Badge>
                    </div>
                    <p className="text-sm mb-2">{actionInfo.message}</p>
                    {actionInfo.pendingDocuments.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium">Pending: </span>
                        {actionInfo.pendingDocuments.join(', ')}
                      </div>
                    )}
                    {isUserParty && actionInfo.canCurrentUserAct && (
                      <div className="mt-2 pt-2 border-t border-current/20">
                        <span className="text-xs font-medium">✓ You can take this action</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Separator />

      {/* Document Review Section */}
      {actionLoading ? (
        <Skeleton className="h-48" />
      ) : currentAction?.currentPhase?.phaseCategory === 'DOCUMENTATION' && currentAction.uploadedDocuments?.length > 0 ? (
        (() => {
          // Check if current user's party action is REVIEW
          const userPartyType = currentAction.userPartyType;
          const userPartyAction = userPartyType && currentAction.partyActions
            ? currentAction.partyActions[userPartyType]
            : null;
          const canReview = userPartyAction && userPartyAction.action === 'REVIEW' && userPartyAction.canCurrentUserAct;

          return (
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Documents</CardTitle>
                <CardDescription>
                  {canReview
                    ? 'Review uploaded documents for this phase'
                    : 'Documents uploaded for this phase'}
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
                        {doc.uploadedBy && (
                          <p className="text-xs text-gray-400">Uploaded by: {doc.uploadedBy}</p>
                        )}
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
                        {/* View Document Button */}
                        {doc.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDocument(doc.id, doc.url!)}
                            disabled={loadingPresignedUrl === doc.id}
                          >
                            {loadingPresignedUrl === doc.id ? 'Loading...' : 'View'}
                          </Button>
                        )}
                        {/* Only show Review button if user's party action is REVIEW */}
                        {doc.status === 'PENDING' && canReview && (
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
                                  onClick={() => handleOpenReviewDialog(doc.id, doc.url)}
                                >
                                  Review
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Review Document</DialogTitle>
                                  <DialogDescription>
                                    {doc.name} ({doc.type})
                                  </DialogDescription>
                                </DialogHeader>

                                {/* Document Preview */}
                                {doc.url && (
                                  <div className="border rounded-lg overflow-hidden bg-gray-100">
                                    {presignedUrls[doc.id] ? (
                                      doc.url.match(/\.(pdf)$/i) || doc.type?.toLowerCase().includes('pdf') ? (
                                        <iframe
                                          src={presignedUrls[doc.id]}
                                          className="w-full h-[500px]"
                                          title={`Preview: ${doc.name}`}
                                        />
                                      ) : doc.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || doc.type?.toLowerCase().includes('image') ? (
                                        <div className="flex items-center justify-center p-4">
                                          <img
                                            src={presignedUrls[doc.id]}
                                            alt={doc.name}
                                            className="max-w-full max-h-[500px] object-contain"
                                          />
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                                          <span className="text-4xl mb-2">📄</span>
                                          <p>Preview not available for this file type</p>
                                          <Button
                                            variant="link"
                                            onClick={() => window.open(presignedUrls[doc.id], '_blank')}
                                          >
                                            Open in new tab →
                                          </Button>
                                        </div>
                                      )
                                    ) : (
                                      <div className="flex items-center justify-center p-8 text-gray-500">
                                        <span>Loading preview...</span>
                                      </div>
                                    )}
                                  </div>
                                )}

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
                {/* Show message if user cannot review */}
                {!canReview && currentAction.uploadedDocuments.some(d => d.status === 'PENDING') && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-gray-600">
                      {userPartyAction?.action === 'WAIT'
                        ? userPartyAction.message
                        : 'Waiting for the reviewer to process these documents'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()
      ) : currentAction?.currentPhase?.phaseCategory === 'DOCUMENTATION' && (!currentAction.uploadedDocuments || currentAction.uploadedDocuments.length === 0) ? (
        (() => {
          // Find which party needs to upload
          const uploadingParty = currentAction.partyActions
            ? Object.entries(currentAction.partyActions).find(([, info]) => info.action === 'UPLOAD')
            : null;
          const partyName = uploadingParty ? uploadingParty[0] : 'the relevant party';
          const pendingDocs = uploadingParty ? uploadingParty[1].pendingDocuments : [];
          const isUserAction = currentAction.userPartyType && currentAction.partyActions?.[currentAction.userPartyType]?.action === 'UPLOAD';

          return (
            <Card className={isUserAction ? 'border-primary/50 bg-primary/5' : ''}>
              <CardHeader>
                <CardTitle>{isUserAction ? 'Document Upload Required' : 'Document Review'}</CardTitle>
                <CardDescription>
                  {currentAction.currentPhase.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="py-8 text-center">
                <span className="text-4xl">{isUserAction ? '📤' : '⏳'}</span>
                <h3 className="text-lg font-semibold mt-4">
                  {isUserAction ? 'You Need to Upload Documents' : `Waiting for ${partyName} to Upload`}
                </h3>
                <p className="text-gray-500 mt-2">
                  {isUserAction
                    ? 'Please upload the required documents to proceed with this phase.'
                    : `No documents have been uploaded for this phase yet.`}
                </p>
                {pendingDocs.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    Required: <span className="font-medium">{pendingDocs.join(', ')}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()
      ) : currentAction?.currentPhase?.phaseCategory === 'QUESTIONNAIRE' && questionnaireFields && questionnaireFields.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Questionnaire Review</CardTitle>
            <CardDescription>
              Review the applicant&apos;s submitted answers for {currentAction.currentPhase.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Score Summary */}
            {currentPhase?.questionnairePhase?.totalScore !== null && currentPhase?.questionnairePhase?.totalScore !== undefined && (
              <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                <h4 className="font-semibold mb-3">Score Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{currentPhase.questionnairePhase.totalScore}</p>
                    <p className="text-sm text-gray-500">Total Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{currentPhase.questionnairePhase.passingScore ?? 'N/A'}</p>
                    <p className="text-sm text-gray-500">Passing Score</p>
                  </div>
                  <div className="text-center">
                    <Badge
                      variant={currentPhase.questionnairePhase.passed ? 'default' : 'destructive'}
                      className="text-lg px-3 py-1"
                    >
                      {currentPhase.questionnairePhase.passed ? '✓ PASSED' : '✗ FAILED'}
                    </Badge>
                    <p className="text-sm text-gray-500 mt-1">Result</p>
                  </div>
                </div>
              </div>
            )}

            {/* Display submitted answers */}
            <div className="space-y-4 mb-6">
              {questionnaireFields
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
            {questionnaireFields.every(
              (field) => field.answer === null || field.answer === undefined
            ) && (
                <div className="text-center py-8 text-gray-500">
                  <p>The applicant has not submitted their answers yet.</p>
                </div>
              )}

            {/* Review actions */}
            {questionnaireFields.some(
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

      {/* Partner Document Upload Section - Only show if user's party needs to upload */}
      {currentAction?.currentPhase?.phaseCategory === 'DOCUMENTATION' && userUploadType && (() => {
        // Check if user's party action is UPLOAD based on the new party-based response
        const userPartyType = currentAction.userPartyType;
        if (!userPartyType || !currentAction.partyActions) {
          return null;
        }
        const userPartyAction = currentAction.partyActions[userPartyType];
        if (!userPartyAction || userPartyAction.action !== 'UPLOAD' || !userPartyAction.canCurrentUserAct) {
          return null;
        }
        const pendingDocs = userPartyAction.pendingDocuments || [];

        return (
          <>
            <Separator />
            <div className="grid gap-4 md:grid-cols-1">
              {/* Show upload section with pending documents from party actions */}
              {userUploadType === 'DEVELOPER' && boundOrganizations?.some(org => org.assignedAsType?.code === 'DEVELOPER') && (
                <PartnerDocumentUpload
                  applicationId={applicationId}
                  phaseId={currentAction.currentPhase!.id}
                  phaseName={currentAction.currentPhase!.name}
                  role="DEVELOPER"
                  pendingDocuments={pendingDocs}
                />
              )}
              {userUploadType === 'LENDER' && boundOrganizations?.some(org => org.assignedAsType?.code === 'BANK') && (
                <PartnerDocumentUpload
                  applicationId={applicationId}
                  phaseId={currentAction.currentPhase!.id}
                  phaseName={currentAction.currentPhase!.name}
                  role="LENDER"
                  pendingDocuments={pendingDocs}
                />
              )}
              {userUploadType === 'PLATFORM' && (
                <PartnerDocumentUpload
                  applicationId={applicationId}
                  phaseId={currentAction.currentPhase!.id}
                  phaseName={currentAction.currentPhase!.name}
                  role="PLATFORM"
                  pendingDocuments={pendingDocs}
                />
              )}
            </div>
          </>
        );
      })()}
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
    <ProtectedRoute roles={['admin', 'mortgage_ops', 'finance', 'legal', 'lender_ops', 'agent']}>
      <AdminApplicationDetailContent applicationId={id} />
    </ProtectedRoute>
  );
}

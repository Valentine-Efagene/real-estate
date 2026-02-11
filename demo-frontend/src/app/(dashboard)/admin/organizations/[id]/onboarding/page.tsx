'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute, AdminOnly } from '@/components/auth';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
    useOnboarding,
    useStartOnboarding,
    useSubmitOnboardingQuestionnaire,
    useReviewGatePhase,
    useReassignOnboarder,
    type OnboardingPhase,
    type PhaseCategory,
    type OnboardingStatus,
    type PhaseStatus,
    type ReviewDecision,
} from '@/lib/hooks/use-onboarding';
import { useOrganizationMembers } from '@/lib/hooks/use-organizations';

// ============================================================================
// Helpers
// ============================================================================

function getOnboardingStatusVariant(status: OnboardingStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'COMPLETED': return 'default';
        case 'IN_PROGRESS': return 'secondary';
        case 'REJECTED': return 'destructive';
        case 'EXPIRED': return 'destructive';
        case 'PENDING': return 'outline';
        default: return 'outline';
    }
}

function getPhaseStatusVariant(status: PhaseStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'COMPLETED': return 'default';
        case 'IN_PROGRESS': return 'secondary';
        case 'AWAITING_APPROVAL': return 'secondary';
        case 'FAILED': return 'destructive';
        case 'PENDING': return 'outline';
        case 'SKIPPED': return 'outline';
        case 'SUPERSEDED': return 'outline';
        default: return 'outline';
    }
}

function getPhaseCategoryIcon(category: PhaseCategory): string {
    switch (category) {
        case 'QUESTIONNAIRE': return '📝';
        case 'DOCUMENTATION': return '📄';
        case 'GATE': return '✅';
        default: return '📋';
    }
}

function getPhaseCategoryLabel(category: PhaseCategory): string {
    switch (category) {
        case 'QUESTIONNAIRE': return 'Questionnaire';
        case 'DOCUMENTATION': return 'Documentation';
        case 'GATE': return 'Gate Review';
        default: return category;
    }
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getUserDisplayName(user: { firstName: string | null; lastName: string | null; email?: string } | null): string {
    if (!user) return 'Unassigned';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name || user.email || 'Unknown';
}

// ============================================================================
// Phase Stepper
// ============================================================================

function PhaseStepper({ phases, currentPhaseId }: { phases: OnboardingPhase[]; currentPhaseId?: string }) {
    const sorted = [...phases].sort((a, b) => a.order - b.order);

    return (
        <div className="flex items-center gap-1 w-full">
            {sorted.map((phase, idx) => {
                const isCurrent = phase.id === currentPhaseId;
                const isCompleted = phase.status === 'COMPLETED';
                const isFailed = phase.status === 'FAILED';

                return (
                    <div key={phase.id} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                            <div
                                className={`
                                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors
                                    ${isCompleted ? 'bg-green-100 border-green-500 text-green-700' : ''}
                                    ${isCurrent ? 'bg-blue-100 border-blue-500 text-blue-700 ring-2 ring-blue-200' : ''}
                                    ${isFailed ? 'bg-red-100 border-red-500 text-red-700' : ''}
                                    ${!isCompleted && !isCurrent && !isFailed ? 'bg-muted border-muted-foreground/30 text-muted-foreground' : ''}
                                `}
                            >
                                {isCompleted ? '✓' : isFailed ? '✗' : getPhaseCategoryIcon(phase.phaseCategory)}
                            </div>
                            <span className={`text-xs mt-1.5 text-center max-w-[100px] truncate ${isCurrent ? 'font-semibold text-blue-700' : 'text-muted-foreground'}`}>
                                {phase.name}
                            </span>
                        </div>
                        {idx < sorted.length - 1 && (
                            <div className={`h-0.5 flex-1 mx-1 ${isCompleted ? 'bg-green-400' : 'bg-muted-foreground/20'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================================
// Questionnaire Phase Component
// ============================================================================

function QuestionnairePhaseCard({
    phase,
    organizationId,
    isEditable,
}: {
    phase: OnboardingPhase;
    organizationId: string;
    isEditable: boolean;
}) {
    const qp = phase.questionnairePhase;
    const submitMutation = useSubmitOnboardingQuestionnaire();
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

    if (!qp) return null;

    const completedCount = qp.completedFieldsCount;
    const totalCount = qp.totalFieldsCount;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Merge fields from materialized fields and snapshot
    const questions = qp.fieldsSnapshot?.questions || [];
    const fields = qp.fields || [];

    const handleSubmit = async () => {
        const entries = Object.entries(fieldValues).filter(([, v]) => v.trim() !== '');
        if (entries.length === 0) {
            toast.error('Please fill in at least one field');
            return;
        }

        try {
            await submitMutation.mutateAsync({
                organizationId,
                phaseId: phase.id,
                fields: entries.map(([fieldId, value]) => ({ fieldId, value })),
            });
            toast.success('Questionnaire submitted successfully');
            setFieldValues({});
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to submit');
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            📝 {phase.name}
                            <Badge variant={getPhaseStatusVariant(phase.status)}>{phase.status.replace('_', ' ')}</Badge>
                        </CardTitle>
                        <CardDescription>{phase.description || 'Complete the questionnaire fields below.'}</CardDescription>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                        {completedCount}/{totalCount} fields completed
                    </div>
                </div>
                <Progress value={progressPercent} className="mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
                {fields.length > 0 ? (
                    fields.sort((a, b) => a.order - b.order).map((field) => {
                        // Find matching question from snapshot for richer data
                        const snapshot = questions.find(q => q.questionKey === field.name);
                        const isAnswered = field.answer !== null;
                        const canEdit = isEditable && phase.status === 'IN_PROGRESS';

                        return (
                            <div key={field.id} className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Label className="font-medium">
                                        {field.label || snapshot?.questionText || field.name}
                                        {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                                    </Label>
                                    {isAnswered && (
                                        <Badge variant="default" className="text-xs">Answered</Badge>
                                    )}
                                </div>
                                {(field.description || snapshot?.helpText) && (
                                    <p className="text-xs text-muted-foreground">{field.description || snapshot?.helpText}</p>
                                )}
                                {isAnswered && !canEdit ? (
                                    <div className="p-2 bg-muted rounded-md text-sm">{String(field.answer)}</div>
                                ) : canEdit ? (
                                    renderFieldInput(field, snapshot, fieldValues[field.id] ?? '', (val) => {
                                        setFieldValues(prev => ({ ...prev, [field.id]: val }));
                                    })
                                ) : (
                                    <div className="p-2 bg-muted rounded-md text-sm text-muted-foreground italic">
                                        {isAnswered ? String(field.answer) : 'Not yet answered'}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <p className="text-sm text-muted-foreground">No fields have been created for this questionnaire.</p>
                )}

                {isEditable && phase.status === 'IN_PROGRESS' && fields.length > 0 && (
                    <>
                        <Separator />
                        <Button
                            onClick={handleSubmit}
                            disabled={submitMutation.isPending || Object.keys(fieldValues).length === 0}
                        >
                            {submitMutation.isPending ? 'Submitting...' : 'Submit Answers'}
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function renderFieldInput(
    field: { fieldType: string; name: string },
    snapshot: { questionType: string; options: string[] | null } | undefined,
    value: string,
    onChange: (val: string) => void,
) {
    const questionType = snapshot?.questionType || field.fieldType;

    switch (questionType) {
        case 'SELECT':
            return (
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select an option..." />
                    </SelectTrigger>
                    <SelectContent>
                        {(snapshot?.options || []).map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        case 'BOOLEAN':
            return (
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                </Select>
            );
        case 'TEXTAREA':
            return (
                <Textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={`Enter ${field.name}...`}
                    rows={3}
                />
            );
        case 'NUMBER':
            return (
                <Input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={`Enter ${field.name}...`}
                />
            );
        default:
            return (
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={`Enter ${field.name}...`}
                />
            );
    }
}

// ============================================================================
// Documentation Phase Component
// ============================================================================

function DocumentationPhaseCard({ phase }: { phase: OnboardingPhase }) {
    const dp = phase.documentationPhase;
    if (!dp) return null;

    const progressPercent = dp.requiredDocumentsCount > 0
        ? Math.round((dp.approvedDocumentsCount / dp.requiredDocumentsCount) * 100)
        : 0;

    const docDefs = dp.documentDefinitionsSnapshot || [];

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            📄 {phase.name}
                            <Badge variant={getPhaseStatusVariant(phase.status)}>{phase.status.replace('_', ' ')}</Badge>
                        </CardTitle>
                        <CardDescription>{phase.description || 'Upload and review required documents.'}</CardDescription>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                        {dp.approvedDocumentsCount}/{dp.requiredDocumentsCount} approved
                    </div>
                </div>
                <Progress value={progressPercent} className="mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Stage progress */}
                {dp.stageProgress.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Approval Stages</h4>
                        {dp.stageProgress.sort((a, b) => a.order - b.order).map((stage) => (
                            <div key={stage.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Stage {stage.order}</span>
                                    <span className="text-sm font-medium">{stage.name}</span>
                                </div>
                                <Badge variant={stage.status === 'COMPLETED' ? 'default' : stage.status === 'IN_PROGRESS' ? 'secondary' : 'outline'}>
                                    {stage.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}

                {/* Required documents from snapshot */}
                {docDefs.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Required Documents</h4>
                        {docDefs.sort((a, b) => a.order - b.order).map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 border rounded-md">
                                <div>
                                    <p className="text-sm font-medium">{doc.documentName}</p>
                                    {doc.description && <p className="text-xs text-muted-foreground">{doc.description}</p>}
                                    <p className="text-xs text-muted-foreground">
                                        Uploaded by: {doc.uploadedBy} · Type: {doc.documentType}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {doc.isRequired && <Badge variant="outline" className="text-xs">Required</Badge>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {docDefs.length === 0 && dp.stageProgress.length === 0 && (
                    <p className="text-sm text-muted-foreground">No documentation requirements defined.</p>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Gate Phase Component
// ============================================================================

function GatePhaseCard({
    phase,
    organizationId,
    isAdmin,
}: {
    phase: OnboardingPhase;
    organizationId: string;
    isAdmin: boolean;
}) {
    const gp = phase.gatePhase;
    const reviewMutation = useReviewGatePhase();
    const [showReviewDialog, setShowReviewDialog] = useState(false);
    const [decision, setDecision] = useState<ReviewDecision>('APPROVED');
    const [notes, setNotes] = useState('');

    if (!gp) return null;

    const canReview = isAdmin && phase.status === 'IN_PROGRESS';

    const handleReview = async () => {
        try {
            await reviewMutation.mutateAsync({
                organizationId,
                phaseId: phase.id,
                decision,
                notes: notes.trim() || undefined,
            });
            toast.success(
                decision === 'APPROVED' ? 'Gate phase approved!' :
                    decision === 'REJECTED' ? 'Gate phase rejected.' :
                        'Changes requested.'
            );
            setShowReviewDialog(false);
            setNotes('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to submit review');
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            ✅ {phase.name}
                            <Badge variant={getPhaseStatusVariant(phase.status)}>{phase.status.replace('_', ' ')}</Badge>
                        </CardTitle>
                        <CardDescription>{phase.description || 'Platform review and approval gate.'}</CardDescription>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                        {gp.approvalCount}/{gp.requiredApprovals} approvals
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Reviewer instructions */}
                {gp.reviewerInstructions && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                        <strong>Instructions:</strong> {gp.reviewerInstructions}
                    </div>
                )}

                {/* Rejection reason */}
                {gp.rejectionReason && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                        <strong>Rejection Reason:</strong> {gp.rejectionReason}
                    </div>
                )}

                {/* Previous reviews */}
                {gp.reviews.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Reviews</h4>
                        {gp.reviews.map((review) => (
                            <div key={review.id} className="flex items-start justify-between p-3 border rounded-md">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                            {getUserDisplayName(review.reviewer)}
                                        </span>
                                        <Badge
                                            variant={
                                                review.decision === 'APPROVED' ? 'default' :
                                                    review.decision === 'REJECTED' ? 'destructive' : 'secondary'
                                            }
                                        >
                                            {review.decision}
                                        </Badge>
                                    </div>
                                    {review.notes && (
                                        <p className="text-sm text-muted-foreground mt-1">{review.notes}</p>
                                    )}
                                </div>
                                <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                            </div>
                        ))}
                    </div>
                )}

                {gp.reviews.length === 0 && phase.status !== 'IN_PROGRESS' && (
                    <p className="text-sm text-muted-foreground">No reviews yet.</p>
                )}

                {/* Review action */}
                {canReview && (
                    <>
                        <Separator />
                        <Button onClick={() => setShowReviewDialog(true)}>
                            Submit Review
                        </Button>

                        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Review Gate Phase</DialogTitle>
                                    <DialogDescription>
                                        Submit your review decision for this onboarding gate.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Decision</Label>
                                        <Select value={decision} onValueChange={(v) => setDecision(v as ReviewDecision)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="APPROVED">✅ Approve</SelectItem>
                                                <SelectItem value="REJECTED">❌ Reject</SelectItem>
                                                <SelectItem value="CHANGES_REQUESTED">🔄 Request Changes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Notes (optional)</Label>
                                        <Textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Add review notes..."
                                            rows={3}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleReview}
                                        disabled={reviewMutation.isPending}
                                        variant={decision === 'REJECTED' ? 'destructive' : 'default'}
                                    >
                                        {reviewMutation.isPending ? 'Submitting...' : `Submit ${decision.replace('_', ' ')}`}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Reassign Onboarder Dialog
// ============================================================================

function ReassignOnboarderDialog({
    organizationId,
    open,
    onOpenChange,
}: {
    organizationId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { data: members } = useOrganizationMembers(organizationId);
    const reassignMutation = useReassignOnboarder();
    const [selectedMemberId, setSelectedMemberId] = useState('');

    const handleReassign = async () => {
        if (!selectedMemberId) {
            toast.error('Select a member to reassign to');
            return;
        }
        try {
            await reassignMutation.mutateAsync({
                organizationId,
                newAssigneeId: selectedMemberId,
            });
            toast.success('Onboarder reassigned successfully');
            onOpenChange(false);
            setSelectedMemberId('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to reassign');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reassign Onboarder</DialogTitle>
                    <DialogDescription>
                        Select a member of this organization to take over the onboarding process.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label>New Assignee</Label>
                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                        <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select a member..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(members || []).map((member: { userId: string; user: { firstName: string | null; lastName: string | null; email: string } }) => (
                                <SelectItem key={member.userId} value={member.userId}>
                                    {getUserDisplayName(member.user)} ({member.user.email})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {(!members || members.length === 0) && (
                        <p className="text-sm text-muted-foreground mt-2">
                            No members found. Invite staff to this organization first.
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleReassign} disabled={reassignMutation.isPending || !selectedMemberId}>
                        {reassignMutation.isPending ? 'Reassigning...' : 'Reassign'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Main Page Component
// ============================================================================

function OnboardingDetailContent({ organizationId }: { organizationId: string }) {
    const { user } = useAuth();
    const { data: onboarding, isLoading, error } = useOnboarding(organizationId);
    const startMutation = useStartOnboarding();
    const [showReassignDialog, setShowReassignDialog] = useState(false);

    const isAdmin = user?.roles?.includes('admin') ?? false;

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <p className="text-destructive">Failed to load onboarding: {error instanceof Error ? error.message : 'Unknown error'}</p>
                    <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!onboarding) {
        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">No onboarding workflow found for this organization.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Onboarding is automatically created for BANK and DEVELOPER organizations when they have a configured onboarding method.
                    </p>
                    <Link href="/admin/organizations">
                        <Button variant="outline" className="mt-4">← Back to Organizations</Button>
                    </Link>
                </CardContent>
            </Card>
        );
    }

    const handleStart = async () => {
        try {
            await startMutation.mutateAsync({ organizationId });
            toast.success('Onboarding started!');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to start onboarding');
        }
    };

    const sortedPhases = [...onboarding.phases].sort((a, b) => a.order - b.order);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{onboarding.organization.name} — Onboarding</h1>
                    <p className="text-muted-foreground mt-1">
                        {onboarding.onboardingMethod.name}
                    </p>
                </div>
                <Link href="/admin/organizations">
                    <Button variant="outline">← Back</Button>
                </Link>
            </div>

            {/* Status Overview Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <Badge variant={getOnboardingStatusVariant(onboarding.status)} className="mt-1">
                                {onboarding.status.replace('_', ' ')}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Organization Status</p>
                            <Badge variant={onboarding.organization.status === 'ACTIVE' ? 'default' : 'secondary'} className="mt-1">
                                {onboarding.organization.status}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Assigned To</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-medium">{getUserDisplayName(onboarding.assignee)}</span>
                                {isAdmin && (
                                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setShowReassignDialog(true)}>
                                        Reassign
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Current Phase</p>
                            <p className="text-sm font-medium mt-1">
                                {onboarding.currentPhase
                                    ? `${getPhaseCategoryIcon(onboarding.currentPhase.phaseCategory)} ${onboarding.currentPhase.name}`
                                    : onboarding.status === 'COMPLETED' ? '✅ All Complete' : '—'
                                }
                            </p>
                        </div>
                    </div>

                    {/* Timeline */}
                    <Separator className="my-4" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Started</p>
                            <p>{formatDate(onboarding.startedAt)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Completed</p>
                            <p>{formatDate(onboarding.completedAt)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Approved</p>
                            <p>{formatDate(onboarding.approvedAt)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Expires</p>
                            <p>{formatDate(onboarding.expiresAt)}</p>
                        </div>
                    </div>

                    {onboarding.approvedBy && (
                        <p className="text-sm text-muted-foreground mt-2">
                            Approved by: <strong>{getUserDisplayName(onboarding.approvedBy)}</strong>
                        </p>
                    )}

                    {onboarding.rejectionReason && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                            <strong>Rejection reason:</strong> {onboarding.rejectionReason}
                        </div>
                    )}

                    {/* Start button for PENDING onboarding */}
                    {onboarding.status === 'PENDING' && (isAdmin || onboarding.assignee) && (
                        <div className="mt-4">
                            <Button onClick={handleStart} disabled={startMutation.isPending}>
                                {startMutation.isPending ? 'Starting...' : 'Start Onboarding'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Phase Stepper */}
            {sortedPhases.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PhaseStepper phases={sortedPhases} currentPhaseId={onboarding.currentPhase?.id} />
                    </CardContent>
                </Card>
            )}

            {/* Phase Details */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Phases</h2>
                {sortedPhases.map((phase) => {
                    switch (phase.phaseCategory) {
                        case 'QUESTIONNAIRE':
                            return (
                                <QuestionnairePhaseCard
                                    key={phase.id}
                                    phase={phase}
                                    organizationId={organizationId}
                                    isEditable={isAdmin || onboarding.assignee?.id === user?.userId}
                                />
                            );
                        case 'DOCUMENTATION':
                            return <DocumentationPhaseCard key={phase.id} phase={phase} />;
                        case 'GATE':
                            return (
                                <GatePhaseCard
                                    key={phase.id}
                                    phase={phase}
                                    organizationId={organizationId}
                                    isAdmin={isAdmin}
                                />
                            );
                        default:
                            return (
                                <Card key={phase.id}>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            📋 {phase.name}
                                            <Badge variant={getPhaseStatusVariant(phase.status)}>{phase.status}</Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">Unknown phase type: {phase.phaseCategory}</p>
                                    </CardContent>
                                </Card>
                            );
                    }
                })}
            </div>

            {/* Reassign Dialog */}
            <ReassignOnboarderDialog
                organizationId={organizationId}
                open={showReassignDialog}
                onOpenChange={setShowReassignDialog}
            />
        </div>
    );
}

// ============================================================================
// Page Export
// ============================================================================

export default function OrganizationOnboardingPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);

    return (
        <ProtectedRoute>
            <AdminOnly>
                <div className="container mx-auto py-6 max-w-5xl">
                    <OnboardingDetailContent organizationId={resolvedParams.id} />
                </div>
            </AdminOnly>
        </ProtectedRoute>
    );
}

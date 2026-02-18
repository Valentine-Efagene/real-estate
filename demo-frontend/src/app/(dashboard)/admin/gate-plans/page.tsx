'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, ShieldCheck } from 'lucide-react';
import {
    useGatePlans,
    useCreateGatePlan,
    useUpdateGatePlan,
    useDeleteGatePlan,
    type GatePlan,
} from '@/lib/hooks/use-gate-plans';
import { useReferencePlans, type OrgTypeRef } from '@/lib/hooks/use-onboarding-flows';

// ============================================================================
// Create Gate Plan Dialog
// ============================================================================

function CreateGatePlanDialog({ orgTypes }: { orgTypes: OrgTypeRef[] }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [requiredApprovals, setRequiredApprovals] = useState('1');
    const [reviewerOrgTypeCode, setReviewerOrgTypeCode] = useState('');
    const [reviewerInstructions, setReviewerInstructions] = useState('');
    const createMutation = useCreateGatePlan();

    const handleCreate = async () => {
        if (!name.trim()) { toast.error('Name is required'); return; }
        if (!reviewerOrgTypeCode) { toast.error('Reviewer organization type is required'); return; }
        try {
            await createMutation.mutateAsync({
                name: name.trim(),
                description: description.trim() || undefined,
                requiredApprovals: parseInt(requiredApprovals) || 1,
                reviewerOrganizationTypeCode: reviewerOrgTypeCode,
                reviewerInstructions: reviewerInstructions.trim() || undefined,
            });
            toast.success('Gate plan created');
            setOpen(false);
            setName('');
            setDescription('');
            setRequiredApprovals('1');
            setReviewerOrgTypeCode('');
            setReviewerInstructions('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Create Gate Plan</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Gate Plan</DialogTitle>
                    <DialogDescription>
                        A gate plan defines an approval checkpoint where designated reviewers must approve before proceeding.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="gatePlanName">Name *</Label>
                        <Input id="gatePlanName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Developer Approval Gate" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gatePlanDesc">Description</Label>
                        <Textarea id="gatePlanDesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what this gate approves..." rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Required Approvals</Label>
                            <Input type="number" min="1" value={requiredApprovals} onChange={(e) => setRequiredApprovals(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Reviewer Org Type *</Label>
                            <Select value={reviewerOrgTypeCode} onValueChange={setReviewerOrgTypeCode}>
                                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                <SelectContent>
                                    {orgTypes.map(ot => (
                                        <SelectItem key={ot.id} value={ot.code}>{ot.name} ({ot.code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gatePlanInstructions">Reviewer Instructions</Label>
                        <Textarea id="gatePlanInstructions" value={reviewerInstructions} onChange={(e) => setReviewerInstructions(e.target.value)} placeholder="Instructions for the reviewer..." rows={2} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Edit Gate Plan Dialog
// ============================================================================

function EditGatePlanDialog({ plan, orgTypes }: { plan: GatePlan; orgTypes: OrgTypeRef[] }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(plan.name);
    const [description, setDescription] = useState(plan.description || '');
    const [requiredApprovals, setRequiredApprovals] = useState(String(plan.requiredApprovals));
    const [reviewerOrgTypeCode, setReviewerOrgTypeCode] = useState(plan.reviewerOrganizationType?.code || '');
    const [reviewerInstructions, setReviewerInstructions] = useState(plan.reviewerInstructions || '');
    const updateMutation = useUpdateGatePlan();

    const handleUpdate = async () => {
        try {
            await updateMutation.mutateAsync({
                id: plan.id,
                name: name.trim(),
                description: description.trim() || undefined,
                requiredApprovals: parseInt(requiredApprovals) || 1,
                reviewerOrganizationTypeCode: reviewerOrgTypeCode || undefined,
                reviewerInstructions: reviewerInstructions.trim() || undefined,
            });
            toast.success('Gate plan updated');
            setOpen(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Gate Plan</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Required Approvals</Label>
                            <Input type="number" min="1" value={requiredApprovals} onChange={(e) => setRequiredApprovals(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Reviewer Org Type</Label>
                            <Select value={reviewerOrgTypeCode} onValueChange={setReviewerOrgTypeCode}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {orgTypes.map(ot => (
                                        <SelectItem key={ot.id} value={ot.code}>{ot.name} ({ot.code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Reviewer Instructions</Label>
                        <Textarea value={reviewerInstructions} onChange={(e) => setReviewerInstructions(e.target.value)} rows={2} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Main Page
// ============================================================================

function GatePlansContent() {
    const { data: plans, isLoading, error } = useGatePlans();
    const { data: reference } = useReferencePlans();
    const deleteMutation = useDeleteGatePlan();

    const orgTypes = reference?.orgTypes || [];

    const handleDelete = async (plan: GatePlan) => {
        if (!confirm(`Delete gate plan "${plan.name}"?`)) return;
        try {
            await deleteMutation.mutateAsync(plan.id);
            toast.success('Gate plan deleted');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete');
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <span className="text-4xl">❌</span>
                <h2 className="text-xl font-semibold mt-4">Failed to load gate plans</h2>
                <p className="text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
        );
    }

    const allPlans = plans || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gate Plans</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure approval gates used in onboarding and qualification workflows.
                    </p>
                </div>
                <CreateGatePlanDialog orgTypes={orgTypes} />
            </div>

            {/* Table */}
            {allPlans.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">No gate plans</h3>
                        <p className="text-muted-foreground mt-1">
                            Create an approval gate plan to define review checkpoints in workflows.
                        </p>
                        <div className="mt-4">
                            <CreateGatePlanDialog orgTypes={orgTypes} />
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>All Gate Plans ({allPlans.length})</CardTitle>
                        <CardDescription>Approval checkpoints for onboarding and qualification workflows</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Reviewer</TableHead>
                                    <TableHead>Required Approvals</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-24">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allPlans.map((plan) => (
                                    <TableRow key={plan.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{plan.name}</p>
                                                {plan.description && (
                                                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {plan.reviewerOrganizationType ? (
                                                <Badge variant="outline">
                                                    {plan.reviewerOrganizationType.name} ({plan.reviewerOrganizationType.code})
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{plan.requiredApprovals}</TableCell>
                                        <TableCell>
                                            <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                                                {plan.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <EditGatePlanDialog plan={plan} orgTypes={orgTypes} />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(plan)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function GatePlansPage() {
    return (
        <ProtectedRoute roles={['admin']}>
            <div className="container mx-auto py-6">
                <GatePlansContent />
            </div>
        </ProtectedRoute>
    );
}

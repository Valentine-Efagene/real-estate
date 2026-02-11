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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
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
import { Plus, Trash2, Settings2, Link2, Unlink, Pencil } from 'lucide-react';
import {
    useOnboardingMethods,
    useCreateOnboardingMethod,
    useUpdateOnboardingMethod,
    useDeleteOnboardingMethod,
    useAddMethodPhase,
    useRemoveMethodPhase,
    useReferencePlans,
    useLinkOrgType,
    useUnlinkOrgType,
    type OnboardingMethod,
    type PhaseCategory,
    type AddPhaseInput,
    type PlanRef,
    type OrgTypeRef,
} from '@/lib/hooks/use-onboarding-methods';

// ============================================================================
// Constants
// ============================================================================

const PHASE_CATEGORIES: { value: PhaseCategory; label: string; icon: string }[] = [
    { value: 'QUESTIONNAIRE', label: 'Questionnaire', icon: '📝' },
    { value: 'DOCUMENTATION', label: 'Documentation', icon: '📄' },
    { value: 'GATE', label: 'Gate (Approval)', icon: '✅' },
];

const PHASE_TYPES: Record<PhaseCategory, { value: string; label: string }[]> = {
    QUESTIONNAIRE: [
        { value: 'ORG_KYB', label: 'Organization KYB' },
        { value: 'ORG_VERIFICATION', label: 'Organization Verification' },
        { value: 'KYC', label: 'KYC' },
        { value: 'CUSTOM', label: 'Custom' },
    ],
    DOCUMENTATION: [
        { value: 'ORG_VERIFICATION', label: 'Organization Verification' },
        { value: 'ORG_KYB', label: 'Organization KYB' },
        { value: 'VERIFICATION', label: 'Verification' },
        { value: 'CUSTOM', label: 'Custom' },
    ],
    GATE: [
        { value: 'APPROVAL_GATE', label: 'Approval Gate' },
        { value: 'CUSTOM', label: 'Custom' },
    ],
};

// ============================================================================
// Create Method Dialog
// ============================================================================

function CreateMethodDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [expiresInDays, setExpiresInDays] = useState('30');
    const [autoActivatePhases, setAutoActivatePhases] = useState(true);
    const createMutation = useCreateOnboardingMethod();

    const handleCreate = async () => {
        if (!name.trim()) {
            toast.error('Name is required');
            return;
        }
        try {
            await createMutation.mutateAsync({
                name: name.trim(),
                description: description.trim() || undefined,
                expiresInDays: expiresInDays ? parseInt(expiresInDays) : null,
                autoActivatePhases,
            });
            toast.success('Onboarding method created');
            setOpen(false);
            setName('');
            setDescription('');
            setExpiresInDays('30');
            setAutoActivatePhases(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> New Method</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Onboarding Method</DialogTitle>
                    <DialogDescription>
                        Define a new onboarding template that can be assigned to organization types.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bank Onboarding" />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the onboarding workflow..." rows={2} />
                    </div>
                    <div className="space-y-2">
                        <Label>Expires In (days)</Label>
                        <Input type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} placeholder="30" />
                        <p className="text-xs text-muted-foreground">Leave empty for no expiry</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch checked={autoActivatePhases} onCheckedChange={setAutoActivatePhases} />
                        <Label>Auto-activate phases</Label>
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
// Edit Method Dialog
// ============================================================================

function EditMethodDialog({ method }: { method: OnboardingMethod }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(method.name);
    const [description, setDescription] = useState(method.description || '');
    const [expiresInDays, setExpiresInDays] = useState(method.expiresInDays?.toString() || '');
    const [isActive, setIsActive] = useState(method.isActive);
    const [autoActivatePhases, setAutoActivatePhases] = useState(method.autoActivatePhases);
    const updateMutation = useUpdateOnboardingMethod();

    const handleUpdate = async () => {
        try {
            await updateMutation.mutateAsync({
                id: method.id,
                name: name.trim(),
                description: description.trim() || undefined,
                expiresInDays: expiresInDays ? parseInt(expiresInDays) : null,
                isActive,
                autoActivatePhases,
            });
            toast.success('Method updated');
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
                    <DialogTitle>Edit Onboarding Method</DialogTitle>
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
                    <div className="space-y-2">
                        <Label>Expires In (days)</Label>
                        <Input type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                        <Label>Active</Label>
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch checked={autoActivatePhases} onCheckedChange={setAutoActivatePhases} />
                        <Label>Auto-activate phases</Label>
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
// Add Phase Dialog
// ============================================================================

function AddPhaseDialog({ method }: { method: OnboardingMethod }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [phaseCategory, setPhaseCategory] = useState<PhaseCategory>('QUESTIONNAIRE');
    const [phaseType, setPhaseType] = useState('ORG_KYB');
    const [planId, setPlanId] = useState('');
    const { data: reference } = useReferencePlans();
    const addMutation = useAddMethodPhase();

    const nextOrder = method.phases.length > 0
        ? Math.max(...method.phases.map(p => p.order)) + 1
        : 1;

    const getAvailablePlans = (): PlanRef[] => {
        if (!reference) return [];
        switch (phaseCategory) {
            case 'QUESTIONNAIRE': return reference.questionnairePlans;
            case 'DOCUMENTATION': return reference.documentationPlans;
            case 'GATE': return reference.gatePlans;
            default: return [];
        }
    };

    const getPlanFieldName = () => {
        switch (phaseCategory) {
            case 'QUESTIONNAIRE': return 'Questionnaire Plan';
            case 'DOCUMENTATION': return 'Documentation Plan';
            case 'GATE': return 'Gate Plan';
        }
    };

    const handleAdd = async () => {
        if (!name.trim()) { toast.error('Name is required'); return; }
        if (!planId) { toast.error(`${getPlanFieldName()} is required`); return; }

        const data: AddPhaseInput & { methodId: string } = {
            methodId: method.id,
            name: name.trim(),
            description: description.trim() || undefined,
            phaseCategory,
            phaseType,
            order: nextOrder,
        };
        if (phaseCategory === 'QUESTIONNAIRE') data.questionnairePlanId = planId;
        if (phaseCategory === 'DOCUMENTATION') data.documentationPlanId = planId;
        if (phaseCategory === 'GATE') data.gatePlanId = planId;

        try {
            await addMutation.mutateAsync(data);
            toast.success('Phase added');
            setOpen(false);
            setName('');
            setDescription('');
            setPlanId('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to add phase');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Add Phase</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Phase</DialogTitle>
                    <DialogDescription>
                        Add a new phase to &quot;{method.name}&quot;. It will be placed at order {nextOrder}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bank KYB Questionnaire" />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select value={phaseCategory} onValueChange={(v) => {
                                setPhaseCategory(v as PhaseCategory);
                                setPhaseType(PHASE_TYPES[v as PhaseCategory][0].value);
                                setPlanId('');
                            }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PHASE_CATEGORIES.map(c => (
                                        <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Phase Type *</Label>
                            <Select value={phaseType} onValueChange={setPhaseType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PHASE_TYPES[phaseCategory].map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{getPlanFieldName()} *</Label>
                        <Select value={planId} onValueChange={setPlanId}>
                            <SelectTrigger><SelectValue placeholder="Select a plan..." /></SelectTrigger>
                            <SelectContent>
                                {getAvailablePlans().map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {getAvailablePlans().length === 0 && (
                            <p className="text-xs text-muted-foreground">No {phaseCategory.toLowerCase()} plans available. Create one first.</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleAdd} disabled={addMutation.isPending}>
                        {addMutation.isPending ? 'Adding...' : 'Add Phase'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Link Org Type Dialog
// ============================================================================

function LinkOrgTypeDialog({ method }: { method: OnboardingMethod }) {
    const [open, setOpen] = useState(false);
    const [selectedOrgTypeId, setSelectedOrgTypeId] = useState('');
    const { data: reference } = useReferencePlans();
    const linkMutation = useLinkOrgType();

    // Filter to org types that are not already linked to any method (or linked to this one)
    const availableTypes = (reference?.orgTypes || []).filter(
        t => !t.onboardingMethodId || t.onboardingMethodId === method.id
    );
    const unlinkedTypes = availableTypes.filter(
        t => !method.organizationTypes.some(ot => ot.id === t.id)
    );

    const handleLink = async () => {
        if (!selectedOrgTypeId) { toast.error('Select an organization type'); return; }
        try {
            await linkMutation.mutateAsync({ methodId: method.id, organizationTypeId: selectedOrgTypeId });
            toast.success('Organization type linked');
            setOpen(false);
            setSelectedOrgTypeId('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to link');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Link2 className="h-4 w-4 mr-1" /> Link Org Type</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Link Organization Type</DialogTitle>
                    <DialogDescription>
                        Organizations of the linked type will be required to complete this onboarding workflow.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label>Organization Type</Label>
                    <Select value={selectedOrgTypeId} onValueChange={setSelectedOrgTypeId}>
                        <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                        <SelectContent>
                            {unlinkedTypes.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {unlinkedTypes.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            All available organization types are already linked.
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleLink} disabled={linkMutation.isPending || !selectedOrgTypeId}>
                        {linkMutation.isPending ? 'Linking...' : 'Link'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Method Detail Card
// ============================================================================

function MethodDetailCard({ method }: { method: OnboardingMethod }) {
    const deleteMutation = useDeleteOnboardingMethod();
    const removePhaseMutation = useRemoveMethodPhase();
    const unlinkMutation = useUnlinkOrgType();
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleDelete = async () => {
        try {
            await deleteMutation.mutateAsync(method.id);
            toast.success('Method deleted');
            setConfirmDelete(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete');
        }
    };

    const handleRemovePhase = async (phaseId: string, phaseName: string) => {
        if (!confirm(`Remove phase "${phaseName}"?`)) return;
        try {
            await removePhaseMutation.mutateAsync({ methodId: method.id, phaseId });
            toast.success('Phase removed');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to remove phase');
        }
    };

    const handleUnlinkOrgType = async (orgType: OrgTypeRef) => {
        if (!confirm(`Unlink "${orgType.code}" from this method?`)) return;
        try {
            await unlinkMutation.mutateAsync({ methodId: method.id, orgTypeId: orgType.id });
            toast.success(`${orgType.code} unlinked`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to unlink');
        }
    };

    const sortedPhases = [...method.phases].sort((a, b) => a.order - b.order);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                {method.name}
                                <Badge variant={method.isActive ? 'default' : 'secondary'}>
                                    {method.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                            </CardTitle>
                            <CardDescription>{method.description || 'No description'}</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <EditMethodDialog method={method} />
                        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Delete &quot;{method.name}&quot;?</DialogTitle>
                                    <DialogDescription>
                                        This will permanently delete this onboarding method and all its phase definitions.
                                        {method._count.onboardings > 0 && (
                                            <span className="block mt-2 text-destructive font-medium">
                                                ⚠️ {method._count.onboardings} active onboarding instance(s) use this method. Deletion will be blocked.
                                            </span>
                                        )}
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                                    <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Meta Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Expires In</p>
                        <p className="font-medium">{method.expiresInDays ? `${method.expiresInDays} days` : 'Never'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Auto-Activate</p>
                        <p className="font-medium">{method.autoActivatePhases ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Phases</p>
                        <p className="font-medium">{method.phases.length}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Active Instances</p>
                        <p className="font-medium">{method._count.onboardings}</p>
                    </div>
                </div>

                <Separator />

                {/* Linked Organization Types */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold">Linked Organization Types</h4>
                        <LinkOrgTypeDialog method={method} />
                    </div>
                    {method.organizationTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No organization types linked. Link one to enable automatic onboarding for that type.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {method.organizationTypes.map(ot => (
                                <Badge key={ot.id} variant="secondary" className="text-sm flex items-center gap-1.5">
                                    {ot.name} ({ot.code})
                                    <button
                                        onClick={() => handleUnlinkOrgType(ot)}
                                        className="hover:text-destructive transition-colors"
                                        title="Unlink"
                                    >
                                        <Unlink className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                <Separator />

                {/* Phases */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold">Phases ({sortedPhases.length})</h4>
                        <AddPhaseDialog method={method} />
                    </div>
                    {sortedPhases.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No phases defined. Add phases to define the onboarding workflow.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Linked Plan</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedPhases.map((phase) => {
                                    const catInfo = PHASE_CATEGORIES.find(c => c.value === phase.phaseCategory);
                                    const linkedPlan = phase.questionnairePlan || phase.documentationPlan || phase.gatePlan;
                                    return (
                                        <TableRow key={phase.id}>
                                            <TableCell className="font-mono text-muted-foreground">{phase.order}</TableCell>
                                            <TableCell className="font-medium">{phase.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {catInfo?.icon} {catInfo?.label || phase.phaseCategory}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {phase.phaseType.replace(/_/g, ' ')}
                                            </TableCell>
                                            <TableCell>
                                                {linkedPlan ? (
                                                    <span className="text-sm">{linkedPlan.name}</span>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground italic">None</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => handleRemovePhase(phase.id, phase.name)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Main Page
// ============================================================================

function OnboardingMethodsContent() {
    const { data: methods, isLoading, error } = useOnboardingMethods();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <span className="text-4xl">❌</span>
                <h2 className="text-xl font-semibold mt-4">Failed to load onboarding methods</h2>
                <p className="text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
        );
    }

    const allMethods = methods || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Onboarding Methods</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure onboarding templates that define the workflow for new partner organizations.
                    </p>
                </div>
                <CreateMethodDialog />
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Methods</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{allMethods.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{allMethods.filter(m => m.isActive).length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Onboarding Instances</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{allMethods.reduce((sum, m) => sum + m._count.onboardings, 0)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Method Cards */}
            {allMethods.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Settings2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">No onboarding methods</h3>
                        <p className="text-muted-foreground mt-1">
                            Create your first onboarding method to define how partner organizations are verified.
                        </p>
                        <div className="mt-4">
                            <CreateMethodDialog />
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {allMethods.map(method => (
                        <MethodDetailCard key={method.id} method={method} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OnboardingMethodsPage() {
    return (
        <ProtectedRoute roles={['admin']}>
            <div className="container mx-auto py-6">
                <OnboardingMethodsContent />
            </div>
        </ProtectedRoute>
    );
}

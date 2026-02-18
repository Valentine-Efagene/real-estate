'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    useQualificationFlows,
    useCreateQualificationFlow,
    useDeleteQualificationFlow,
    type QualificationFlow,
    type CreateQualificationFlowInput,
    type QualFlowPhaseCategory,
    type QualFlowPhaseType,
    type CreateQualificationFlowPhaseInput,
} from '@/lib/hooks/use-qualification-flows';
import {
    useQuestionnairePlans,
    useDocumentationPlans,
    type QuestionnairePlan,
    type DocumentationPlan,
} from '@/lib/hooks/use-payment-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
    Plus,
    Trash2,
    MoreVertical,
    Pencil,
    ClipboardList,
    FileText,
    ShieldCheck,
    ChevronUp,
    ChevronDown,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const PHASE_CATEGORIES: { value: QualFlowPhaseCategory; label: string; icon: React.ReactNode }[] = [
    { value: 'QUESTIONNAIRE', label: 'Questionnaire', icon: <ClipboardList className="h-4 w-4" /> },
    { value: 'DOCUMENTATION', label: 'Documentation', icon: <FileText className="h-4 w-4" /> },
    { value: 'GATE', label: 'Approval Gate', icon: <ShieldCheck className="h-4 w-4" /> },
];

const PHASE_TYPES: Record<QualFlowPhaseCategory, { value: QualFlowPhaseType; label: string }[]> = {
    QUESTIONNAIRE: [
        { value: 'PRE_APPROVAL', label: 'Pre-Approval' },
        { value: 'UNDERWRITING', label: 'Underwriting' },
    ],
    DOCUMENTATION: [
        { value: 'KYC', label: 'KYC Verification' },
        { value: 'VERIFICATION', label: 'Document Verification' },
        { value: 'ORG_KYB', label: 'Organization KYB' },
    ],
    GATE: [
        { value: 'APPROVAL_GATE', label: 'Approval Gate' },
    ],
};

function getCategoryColor(category: QualFlowPhaseCategory) {
    switch (category) {
        case 'QUESTIONNAIRE': return 'bg-purple-100 text-purple-800';
        case 'DOCUMENTATION': return 'bg-blue-100 text-blue-800';
        case 'GATE': return 'bg-amber-100 text-amber-800';
    }
}

function getCategoryIcon(category: QualFlowPhaseCategory) {
    switch (category) {
        case 'QUESTIONNAIRE': return <ClipboardList className="h-4 w-4" />;
        case 'DOCUMENTATION': return <FileText className="h-4 w-4" />;
        case 'GATE': return <ShieldCheck className="h-4 w-4" />;
    }
}

// Phase Editor for the create dialog
function PhaseEditor({
    phases,
    onChange,
    questionnairePlans,
    documentationPlans,
}: {
    phases: CreateQualificationFlowPhaseInput[];
    onChange: (phases: CreateQualificationFlowPhaseInput[]) => void;
    questionnairePlans: QuestionnairePlan[];
    documentationPlans: DocumentationPlan[];
}) {
    const addPhase = () => {
        onChange([
            ...phases,
            {
                name: '',
                phaseCategory: 'DOCUMENTATION',
                phaseType: 'KYC',
                order: phases.length + 1,
            },
        ]);
    };

    const removePhase = (index: number) => {
        const newPhases = phases.filter((_, i) => i !== index);
        onChange(newPhases.map((p, i) => ({ ...p, order: i + 1 })));
    };

    const updatePhase = (index: number, updates: Partial<CreateQualificationFlowPhaseInput>) => {
        const newPhases = [...phases];
        newPhases[index] = { ...newPhases[index], ...updates };
        onChange(newPhases);
    };

    const movePhase = (index: number, direction: 'up' | 'down') => {
        const newPhases = [...phases];
        const swapIdx = direction === 'up' ? index - 1 : index + 1;
        if (swapIdx < 0 || swapIdx >= newPhases.length) return;
        [newPhases[index], newPhases[swapIdx]] = [newPhases[swapIdx], newPhases[index]];
        onChange(newPhases.map((p, i) => ({ ...p, order: i + 1 })));
    };

    return (
        <div className="space-y-3">
            {phases.map((phase, idx) => (
                <Card key={idx} className="p-3">
                    <div className="flex items-start gap-2">
                        <div className="flex flex-col gap-0.5 pt-1">
                            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => movePhase(idx, 'up')}>
                                <ChevronUp className="h-3 w-3" />
                            </Button>
                            <span className="text-center text-xs font-bold text-muted-foreground w-5">{phase.order}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === phases.length - 1} onClick={() => movePhase(idx, 'down')}>
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="flex-1 space-y-2">
                            <Input
                                placeholder="Phase name"
                                value={phase.name}
                                onChange={(e) => updatePhase(idx, { name: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Select
                                    value={phase.phaseCategory}
                                    onValueChange={(value: QualFlowPhaseCategory) =>
                                        updatePhase(idx, {
                                            phaseCategory: value,
                                            phaseType: PHASE_TYPES[value][0].value,
                                            questionnairePlanId: undefined,
                                            documentationPlanId: undefined,
                                        })
                                    }
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PHASE_CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                <div className="flex items-center gap-1">{cat.icon}{cat.label}</div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={phase.phaseType}
                                    onValueChange={(value: QualFlowPhaseType) => updatePhase(idx, { phaseType: value })}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PHASE_TYPES[phase.phaseCategory].map((type) => (
                                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {phase.phaseCategory === 'QUESTIONNAIRE' && (
                                <Select
                                    value={phase.questionnairePlanId || ''}
                                    onValueChange={(value) => updatePhase(idx, { questionnairePlanId: value || undefined })}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select questionnaire plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {questionnairePlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {phase.phaseCategory === 'DOCUMENTATION' && (
                                <Select
                                    value={phase.documentationPlanId || ''}
                                    onValueChange={(value) => updatePhase(idx, { documentationPlanId: value || undefined })}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select documentation plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {documentationPlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePhase(idx)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </Card>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={addPhase}>
                <Plus className="h-4 w-4 mr-2" /> Add Phase
            </Button>
        </div>
    );
}

export default function QualificationFlowsPage() {
    const { data: flows, isLoading, error } = useQualificationFlows();
    const { data: questionnairePlans = [] } = useQuestionnairePlans();
    const { data: documentationPlans = [] } = useDocumentationPlans();
    const createMutation = useCreateQualificationFlow();
    const deleteMutation = useDeleteQualificationFlow();

    const [createOpen, setCreateOpen] = useState(false);
    const [newFlow, setNewFlow] = useState<CreateQualificationFlowInput>({
        name: '',
        description: '',
        isActive: true,
        phases: [],
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFlow.name.trim()) {
            toast.error('Flow name is required');
            return;
        }
        try {
            await createMutation.mutateAsync(newFlow);
            toast.success('Qualification flow created');
            setCreateOpen(false);
            setNewFlow({ name: '', description: '', isActive: true, phases: [] });
        } catch (error: any) {
            toast.error(error.message || 'Failed to create flow');
        }
    };

    const handleDelete = async (flow: QualificationFlow) => {
        if (!confirm(`Are you sure you want to delete "${flow.name}"?`)) return;
        try {
            await deleteMutation.mutateAsync(flow.id);
            toast.success('Qualification flow deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete flow');
        }
    };

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-64" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error</CardTitle>
                        <CardDescription>{(error as Error).message}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Qualification Flows</h1>
                    <p className="text-muted-foreground">
                        Define qualification workflows that organizations must complete to use payment methods
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Create Flow
                </Button>
            </div>

            {/* Flow Cards */}
            {!flows || flows.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium mb-2">No qualification flows</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Create a qualification flow to define org-level requirements for payment methods.
                        </p>
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" /> Create First Flow
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {flows.map((flow) => (
                        <Card key={flow.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg">{flow.name}</CardTitle>
                                        {flow.description && (
                                            <CardDescription className="line-clamp-2">
                                                {flow.description}
                                            </CardDescription>
                                        )}
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/qualification-flows/${flow.id}/edit`}>
                                                    <Pencil className="h-4 w-4 mr-2" /> Edit
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => handleDelete(flow)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 mb-3">
                                    <Badge variant={flow.isActive ? 'default' : 'secondary'}>
                                        {flow.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                    <Badge variant="outline">
                                        {flow.phases?.length || 0} phase{(flow.phases?.length || 0) !== 1 ? 's' : ''}
                                    </Badge>
                                </div>
                                {flow.phases && flow.phases.length > 0 && (
                                    <div className="space-y-1">
                                        {flow.phases
                                            .sort((a, b) => a.order - b.order)
                                            .map((phase) => (
                                                <div key={phase.id} className="flex items-center gap-2 text-sm">
                                                    <span className="text-muted-foreground w-4 text-right">
                                                        {phase.order}.
                                                    </span>
                                                    <Badge variant="outline" className={`text-xs ${getCategoryColor(phase.phaseCategory)}`}>
                                                        {getCategoryIcon(phase.phaseCategory)}
                                                    </Badge>
                                                    <span className="truncate">{phase.name}</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <form onSubmit={handleCreate}>
                        <DialogHeader>
                            <DialogTitle>Create Qualification Flow</DialogTitle>
                            <DialogDescription>
                                Define the steps organizations must complete to qualify for a payment method.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div>
                                <Label>Flow Name *</Label>
                                <Input
                                    value={newFlow.name}
                                    onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                                    placeholder="e.g., Developer Qualification"
                                />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Textarea
                                    value={newFlow.description || ''}
                                    onChange={(e) => setNewFlow({ ...newFlow, description: e.target.value })}
                                    placeholder="What must the organization provide?"
                                    rows={2}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    checked={newFlow.isActive ?? true}
                                    onCheckedChange={(checked) => setNewFlow({ ...newFlow, isActive: checked })}
                                />
                                <Label>Active</Label>
                            </div>

                            <div>
                                <Label className="mb-2 block">Phases</Label>
                                <PhaseEditor
                                    phases={newFlow.phases || []}
                                    onChange={(phases) => setNewFlow({ ...newFlow, phases })}
                                    questionnairePlans={questionnairePlans}
                                    documentationPlans={documentationPlans}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                                    </>
                                ) : (
                                    'Create Flow'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

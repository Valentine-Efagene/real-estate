'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
    useQualificationFlow,
    useUpdateQualificationFlow,
    type QualificationFlowPhase,
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
    ArrowLeft,
    Save,
    Loader2,
    Pencil,
    MoreVertical,
    ChevronUp,
    ChevronDown,
    ClipboardList,
    FileText,
    ShieldCheck,
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

// Add/Edit Phase Dialog
function PhaseDialog({
    open,
    onOpenChange,
    existingPhase,
    currentPhaseCount,
    questionnairePlans,
    documentationPlans,
    onSave,
    saving,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    existingPhase?: QualificationFlowPhase | null;
    currentPhaseCount: number;
    questionnairePlans: QuestionnairePlan[];
    documentationPlans: DocumentationPlan[];
    onSave: (phase: CreateQualificationFlowPhaseInput) => void;
    saving: boolean;
}) {
    const [phase, setPhase] = useState<CreateQualificationFlowPhaseInput>({
        name: '',
        phaseCategory: 'DOCUMENTATION',
        phaseType: 'KYC',
        order: currentPhaseCount + 1,
    });

    useEffect(() => {
        if (existingPhase) {
            setPhase({
                name: existingPhase.name,
                description: existingPhase.description || undefined,
                phaseCategory: existingPhase.phaseCategory,
                phaseType: existingPhase.phaseType,
                order: existingPhase.order,
                questionnairePlanId: existingPhase.questionnairePlanId || undefined,
                documentationPlanId: existingPhase.documentationPlanId || undefined,
            });
        } else {
            setPhase({
                name: '',
                phaseCategory: 'DOCUMENTATION',
                phaseType: 'KYC',
                order: currentPhaseCount + 1,
            });
        }
    }, [existingPhase, currentPhaseCount, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!phase.name.trim()) {
            toast.error('Phase name is required');
            return;
        }
        onSave(phase);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{existingPhase ? 'Edit Phase' : 'Add New Phase'}</DialogTitle>
                        <DialogDescription>
                            {existingPhase
                                ? 'Update the phase configuration.'
                                : 'Add a qualification phase to this flow.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Phase Name *</Label>
                            <Input
                                value={phase.name}
                                onChange={(e) => setPhase({ ...phase, name: e.target.value })}
                                placeholder="e.g., KYB Documentation"
                            />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={phase.description || ''}
                                onChange={(e) => setPhase({ ...phase, description: e.target.value })}
                                placeholder="Phase description"
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Category *</Label>
                                <Select
                                    value={phase.phaseCategory}
                                    onValueChange={(value: QualFlowPhaseCategory) =>
                                        setPhase({
                                            ...phase,
                                            phaseCategory: value,
                                            phaseType: PHASE_TYPES[value][0].value,
                                            questionnairePlanId: undefined,
                                            documentationPlanId: undefined,
                                        })
                                    }
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PHASE_CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                <div className="flex items-center gap-2">{cat.icon}{cat.label}</div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Type *</Label>
                                <Select
                                    value={phase.phaseType}
                                    onValueChange={(value: QualFlowPhaseType) => setPhase({ ...phase, phaseType: value })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PHASE_TYPES[phase.phaseCategory].map((type) => (
                                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {phase.phaseCategory === 'QUESTIONNAIRE' && (
                            <div>
                                <Label>Questionnaire Plan</Label>
                                <Select
                                    value={phase.questionnairePlanId || ''}
                                    onValueChange={(value) => setPhase({ ...phase, questionnairePlanId: value || undefined })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                                    <SelectContent>
                                        {questionnairePlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {phase.phaseCategory === 'DOCUMENTATION' && (
                            <div>
                                <Label>Documentation Plan</Label>
                                <Select
                                    value={phase.documentationPlanId || ''}
                                    onValueChange={(value) => setPhase({ ...phase, documentationPlanId: value || undefined })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                                    <SelectContent>
                                        {documentationPlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Saving...' : existingPhase ? 'Save Changes' : 'Add Phase'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function EditQualificationFlowPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const flowId = resolvedParams.id;

    const { data: flow, isLoading, error } = useQualificationFlow(flowId);
    const { data: questionnairePlans = [] } = useQuestionnairePlans();
    const { data: documentationPlans = [] } = useDocumentationPlans();
    const updateMutation = useUpdateQualificationFlow();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isActive: true,
    });

    const [addPhaseOpen, setAddPhaseOpen] = useState(false);
    const [editingPhase, setEditingPhase] = useState<QualificationFlowPhase | null>(null);

    useEffect(() => {
        if (flow) {
            setFormData({
                name: flow.name,
                description: flow.description || '',
                isActive: flow.isActive,
            });
        }
    }, [flow]);

    const handleSaveDetails = async () => {
        try {
            await updateMutation.mutateAsync({
                id: flowId,
                data: {
                    name: formData.name,
                    description: formData.description,
                    isActive: formData.isActive,
                },
            });
            toast.success('Qualification flow updated');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update');
        }
    };

    const handleAddPhase = async (phaseData: CreateQualificationFlowPhaseInput) => {
        if (!flow) return;
        const existingPhases = (flow.phases || []).map((p) => ({
            name: p.name,
            description: p.description || undefined,
            phaseCategory: p.phaseCategory,
            phaseType: p.phaseType,
            order: p.order,
            questionnairePlanId: p.questionnairePlanId || undefined,
            documentationPlanId: p.documentationPlanId || undefined,
        }));
        try {
            await updateMutation.mutateAsync({
                id: flowId,
                data: { phases: [...existingPhases, phaseData] },
            });
            toast.success('Phase added');
            setAddPhaseOpen(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to add phase');
        }
    };

    const handleEditPhase = async (phaseData: CreateQualificationFlowPhaseInput) => {
        if (!flow || !editingPhase) return;
        const updatedPhases = (flow.phases || []).map((p) => {
            if (p.id === editingPhase.id) {
                return {
                    name: phaseData.name,
                    description: phaseData.description,
                    phaseCategory: phaseData.phaseCategory,
                    phaseType: phaseData.phaseType,
                    order: phaseData.order,
                    questionnairePlanId: phaseData.questionnairePlanId,
                    documentationPlanId: phaseData.documentationPlanId,
                };
            }
            return {
                name: p.name,
                description: p.description || undefined,
                phaseCategory: p.phaseCategory,
                phaseType: p.phaseType,
                order: p.order,
                questionnairePlanId: p.questionnairePlanId || undefined,
                documentationPlanId: p.documentationPlanId || undefined,
            };
        });
        try {
            await updateMutation.mutateAsync({ id: flowId, data: { phases: updatedPhases } });
            toast.success('Phase updated');
            setEditingPhase(null);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update phase');
        }
    };

    const handleDeletePhase = async (phaseId: string, phaseName: string) => {
        if (!confirm(`Delete phase "${phaseName}"?`)) return;
        if (!flow) return;
        const remainingPhases = (flow.phases || [])
            .filter((p) => p.id !== phaseId)
            .map((p, i) => ({
                name: p.name,
                description: p.description || undefined,
                phaseCategory: p.phaseCategory,
                phaseType: p.phaseType,
                order: i + 1,
                questionnairePlanId: p.questionnairePlanId || undefined,
                documentationPlanId: p.documentationPlanId || undefined,
            }));
        try {
            await updateMutation.mutateAsync({ id: flowId, data: { phases: remainingPhases } });
            toast.success('Phase deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete phase');
        }
    };

    const handleMovePhase = async (phaseId: string, direction: 'up' | 'down') => {
        if (!flow) return;
        const sorted = [...(flow.phases || [])].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((p) => p.id === phaseId);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;

        const newPhases = [...sorted];
        [newPhases[idx], newPhases[swapIdx]] = [newPhases[swapIdx], newPhases[idx]];
        const reordered = newPhases.map((p, i) => ({
            name: p.name,
            description: p.description || undefined,
            phaseCategory: p.phaseCategory,
            phaseType: p.phaseType,
            order: i + 1,
            questionnairePlanId: p.questionnairePlanId || undefined,
            documentationPlanId: p.documentationPlanId || undefined,
        }));
        try {
            await updateMutation.mutateAsync({ id: flowId, data: { phases: reordered } });
        } catch (error: any) {
            toast.error(error.message || 'Failed to reorder phases');
        }
    };

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (error || !flow) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error</CardTitle>
                        <CardDescription>{(error as Error)?.message || 'Flow not found'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline">
                            <Link href="/admin/qualification-flows">
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Qualification Flows
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const sortedPhases = [...(flow.phases || [])].sort((a, b) => a.order - b.order);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button asChild variant="ghost" size="icon">
                        <Link href="/admin/qualification-flows">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Edit Qualification Flow</h1>
                        <p className="text-muted-foreground">{flow.name}</p>
                    </div>
                </div>
                <Badge variant={flow.isActive ? 'default' : 'secondary'} className="text-sm">
                    {flow.isActive ? 'Active' : 'Inactive'}
                </Badge>
            </div>

            {/* Basic Details Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Details</CardTitle>
                    <CardDescription>Update the flow name and settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Developer Qualification"
                            />
                        </div>
                        <div className="flex items-end">
                            <div className="flex items-center gap-4">
                                <Switch
                                    checked={formData.isActive}
                                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                />
                                <div>
                                    <Label>Active</Label>
                                    <p className="text-xs text-muted-foreground">Can be assigned to configs</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="What this qualification flow verifies"
                            rows={2}
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveDetails} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                            ) : (
                                <><Save className="h-4 w-4 mr-2" /> Save Details</>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Phases Card */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Phases</CardTitle>
                            <CardDescription>
                                Steps the organization must complete during qualification
                            </CardDescription>
                        </div>
                        <Button onClick={() => setAddPhaseOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" /> Add Phase
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {sortedPhases.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-lg font-medium mb-2">No phases defined</p>
                            <p className="text-sm text-muted-foreground mb-4">
                                Add phases to define the qualification steps.
                            </p>
                            <Button onClick={() => setAddPhaseOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" /> Add First Phase
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sortedPhases.map((phase, index) => (
                                <Card key={phase.id} className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex flex-col gap-0.5 pt-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => handleMovePhase(phase.id, 'up')}>
                                                <ChevronUp className="h-4 w-4" />
                                            </Button>
                                            <div className="text-center text-xs font-bold text-muted-foreground w-6">{phase.order}</div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === sortedPhases.length - 1} onClick={() => handleMovePhase(phase.id, 'down')}>
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant="outline" className={getCategoryColor(phase.phaseCategory)}>
                                                    {getCategoryIcon(phase.phaseCategory)}
                                                    <span className="ml-1">{phase.phaseCategory}</span>
                                                </Badge>
                                                <Badge variant="secondary">{phase.phaseType}</Badge>
                                            </div>
                                            <h4 className="font-medium">{phase.name}</h4>
                                            {phase.description && (
                                                <p className="text-sm text-muted-foreground mt-1">{phase.description}</p>
                                            )}
                                            {phase.questionnairePlan && (
                                                <p className="text-sm text-muted-foreground mt-1">📋 {phase.questionnairePlan.name}</p>
                                            )}
                                            {phase.documentationPlan && (
                                                <p className="text-sm text-muted-foreground mt-1">📄 {phase.documentationPlan.name}</p>
                                            )}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditingPhase(phase)}>
                                                    <Pencil className="h-4 w-4 mr-2" /> Edit Phase
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => handleDeletePhase(phase.id, phase.name)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" /> Delete Phase
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Phase Dialog */}
            <PhaseDialog
                open={addPhaseOpen}
                onOpenChange={setAddPhaseOpen}
                currentPhaseCount={sortedPhases.length}
                questionnairePlans={questionnairePlans}
                documentationPlans={documentationPlans}
                onSave={handleAddPhase}
                saving={updateMutation.isPending}
            />

            {/* Edit Phase Dialog */}
            <PhaseDialog
                open={!!editingPhase}
                onOpenChange={(open) => { if (!open) setEditingPhase(null); }}
                existingPhase={editingPhase}
                currentPhaseCount={sortedPhases.length}
                questionnairePlans={questionnairePlans}
                documentationPlans={documentationPlans}
                onSave={handleEditPhase}
                saving={updateMutation.isPending}
            />
        </div>
    );
}

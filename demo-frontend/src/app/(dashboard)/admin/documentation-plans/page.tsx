'use client';

import { useState } from 'react';
import {
    useDocumentationPlans,
    useCreateDocumentationPlan,
    useDeleteDocumentationPlan,
    useQuestionnairePlans,
    type DocumentationPlan,
    type CreateDocumentationPlanInput,
    type DocumentDefinition,
    type ApprovalStage,
    type UploaderType,
    type StepCondition,
    type QuestionnairePlan,
    type QuestionDefinition,
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
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, FileText, CheckCircle, Upload, Filter } from 'lucide-react';
import { toast } from 'sonner';

const UPLOADER_TYPES: { value: UploaderType; label: string; color: string }[] = [
    { value: 'CUSTOMER', label: 'Customer', color: 'bg-blue-100 text-blue-800' },
    { value: 'PLATFORM', label: 'Platform (QShelter)', color: 'bg-purple-100 text-purple-800' },
    { value: 'DEVELOPER', label: 'Developer', color: 'bg-orange-100 text-orange-800' },
    { value: 'LENDER', label: 'Lender (Bank)', color: 'bg-green-100 text-green-800' },
    { value: 'LEGAL', label: 'Legal', color: 'bg-amber-100 text-amber-800' },
    { value: 'INSURER', label: 'Insurer', color: 'bg-cyan-100 text-cyan-800' },
    { value: 'GOVERNMENT', label: 'Government', color: 'bg-red-100 text-red-800' },
];

// Organization types that can be assigned to approval stages
// CUSTOMER is a pseudo-type for customer acceptance stages (no actual org, identified by userId)
const ORGANIZATION_TYPE_CODES = [
    { value: 'CUSTOMER', label: 'Customer (Applicant)' },
    { value: 'PLATFORM', label: 'Platform (QShelter)' },
    { value: 'BANK', label: 'Bank' },
    { value: 'DEVELOPER', label: 'Developer' },
    { value: 'LEGAL', label: 'Legal' },
    { value: 'INSURER', label: 'Insurer' },
    { value: 'GOVERNMENT', label: 'Government' },
];

const REJECTION_ACTIONS = [
    { value: 'CASCADE_BACK', label: 'Cascade Back (to previous stage)' },
    { value: 'REJECT_APPLICATION', label: 'Reject Application' },
    { value: 'HOLD', label: 'Hold for Review' },
];

const CONDITION_OPERATORS = [
    { value: 'EQUALS', label: '= Equals' },
    { value: 'NOT_EQUALS', label: '≠ Not Equals' },
    { value: 'IN', label: '∈ In (any of)' },
    { value: 'NOT_IN', label: '∉ Not In' },
    { value: 'GREATER_THAN', label: '> Greater Than' },
    { value: 'LESS_THAN', label: '< Less Than' },
    { value: 'EXISTS', label: '∃ Exists (has answer)' },
] as const;

type ConditionOperator = typeof CONDITION_OPERATORS[number]['value'];

/** Human-readable summary of a condition */
function describeCondition(condition: StepCondition): string {
    if (condition.all && condition.all.length > 0) {
        return `ALL of: (${condition.all.map(describeCondition).join(' AND ')})`;
    }
    if (condition.any && condition.any.length > 0) {
        return `ANY of: (${condition.any.map(describeCondition).join(' OR ')})`;
    }
    const key = condition.questionKey || '?';
    const op = condition.operator || '?';
    if (op === 'EXISTS') return `${key} has an answer`;
    if (op === 'IN' || op === 'NOT_IN') {
        return `${key} ${op === 'IN' ? 'in' : 'not in'} [${(condition.values || []).join(', ')}]`;
    }
    const opSymbols: Record<string, string> = { EQUALS: '=', NOT_EQUALS: '≠', GREATER_THAN: '>', LESS_THAN: '<' };
    const opSymbol = opSymbols[op] || op;
    return `${key} ${opSymbol} ${condition.value ?? '?'}`;
}

// ============================================================================
// Condition Editor — inline condition builder for a single document
// ============================================================================

interface ConditionEditorProps {
    condition?: StepCondition;
    onChange: (condition: StepCondition | undefined) => void;
    questionnairePlans: QuestionnairePlan[];
}

function ConditionEditor({ condition, onChange, questionnairePlans }: ConditionEditorProps) {
    // Flatten all questions from all plans for the question key picker
    const allQuestions: (QuestionDefinition & { planName: string })[] = questionnairePlans.flatMap(
        (plan) => plan.questions.map((q) => ({ ...q, planName: plan.name }))
    );

    // Find the selected question to show its options
    const selectedQuestion = condition?.questionKey
        ? allQuestions.find((q) => q.questionKey === condition.questionKey)
        : undefined;

    const hasOptions = selectedQuestion?.options && selectedQuestion.options.length > 0;
    const operator = condition?.operator ?? 'EQUALS';
    const isMultiValue = operator === 'IN' || operator === 'NOT_IN';

    const updateCondition = (updates: Partial<StepCondition>) => {
        const updated = { ...condition, ...updates };
        // Clear value fields when switching operators
        if (updates.operator) {
            if (updates.operator === 'EXISTS') {
                delete updated.value;
                delete updated.values;
            } else if (updates.operator === 'IN' || updates.operator === 'NOT_IN') {
                delete updated.value;
                if (!updated.values) updated.values = [];
            } else {
                delete updated.values;
            }
        }
        onChange(updated);
    };

    if (!condition) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => onChange({ questionKey: '', operator: 'EQUALS', value: '' })}
            >
                <Filter className="h-3 w-3" />
                Add Condition
            </Button>
        );
    }

    return (
        <div className="border rounded-md p-2 bg-amber-50 dark:bg-amber-950/20 space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    Conditional — only required when:
                </Label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-xs text-destructive"
                    onClick={() => onChange(undefined)}
                >
                    Remove
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-2">
                {/* Question Key Picker */}
                <div>
                    <Label className="text-xs">Question Key</Label>
                    {allQuestions.length > 0 ? (
                        <Select
                            value={condition.questionKey || ''}
                            onValueChange={(val) => updateCondition({ questionKey: val })}
                        >
                            <SelectTrigger className="text-xs h-8">
                                <SelectValue placeholder="Select question..." />
                            </SelectTrigger>
                            <SelectContent>
                                {questionnairePlans.map((plan) => (
                                    <div key={plan.id}>
                                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                                            {plan.name}
                                        </div>
                                        {plan.questions.map((q) => (
                                            <SelectItem key={q.questionKey} value={q.questionKey} className="text-xs">
                                                <span className="font-mono">{q.questionKey}</span>
                                                <span className="ml-1 text-muted-foreground">— {q.questionText}</span>
                                            </SelectItem>
                                        ))}
                                    </div>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input
                            value={condition.questionKey || ''}
                            onChange={(e) => updateCondition({ questionKey: e.target.value })}
                            placeholder="mortgage_type"
                            className="text-xs h-8 font-mono"
                        />
                    )}
                </div>

                <div className='flex gap-4'>
                    {/* Operator */}
                    <div>
                        <Label className="text-xs">Operator</Label>
                        <Select
                            value={operator}
                            onValueChange={(val: ConditionOperator) => updateCondition({ operator: val })}
                        >
                            <SelectTrigger className="text-xs h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CONDITION_OPERATORS.map((op) => (
                                    <SelectItem key={op.value} value={op.value} className="text-xs">
                                        {op.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Value */}
                    <div>
                        <Label className="text-xs">
                            {operator === 'EXISTS' ? '(no value needed)' : isMultiValue ? 'Values (comma-separated)' : 'Value'}
                        </Label>
                        {operator === 'EXISTS' ? (
                            <div className="h-8 flex items-center text-xs text-muted-foreground italic">Auto-detected</div>
                        ) : isMultiValue ? (
                            hasOptions ? (
                                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                    {selectedQuestion!.options!.map((opt) => {
                                        const isSelected = (condition.values || []).includes(opt.value);
                                        return (
                                            <Badge
                                                key={opt.value}
                                                variant={isSelected ? 'default' : 'outline'}
                                                className="cursor-pointer text-xs"
                                                onClick={() => {
                                                    const current = condition.values || [];
                                                    const next = isSelected
                                                        ? current.filter((v) => v !== opt.value)
                                                        : [...current, opt.value];
                                                    updateCondition({ values: next });
                                                }}
                                            >
                                                {opt.label}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Input
                                    value={(condition.values || []).join(', ')}
                                    onChange={(e) =>
                                        updateCondition({
                                            values: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                                        })
                                    }
                                    placeholder="VALUE_1, VALUE_2"
                                    className="text-xs h-8 font-mono"
                                />
                            )
                        ) : hasOptions ? (
                            <Select
                                value={String(condition.value ?? '')}
                                onValueChange={(val) => updateCondition({ value: val })}
                            >
                                <SelectTrigger className="text-xs h-8">
                                    <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedQuestion!.options!.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={String(condition.value ?? '')}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    // Auto-detect number
                                    const num = Number(v);
                                    updateCondition({ value: v !== '' && !isNaN(num) ? num : v });
                                }}
                                placeholder="JOINT"
                                className="text-xs h-8 font-mono"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Document Editor
// ============================================================================

interface DocumentEditorProps {
    documents: DocumentDefinition[];
    onChange: (documents: DocumentDefinition[]) => void;
    questionnairePlans: QuestionnairePlan[];
}

function DocumentEditor({ documents, onChange, questionnairePlans }: DocumentEditorProps) {
    const addDocument = () => {
        const newDoc: DocumentDefinition = {
            documentType: '',
            documentName: '',
            uploadedBy: 'CUSTOMER',
            order: documents.length + 1,
            isRequired: true,
        };
        onChange([...documents, newDoc]);
    };

    const updateDocument = (index: number, updates: Partial<DocumentDefinition>) => {
        const updated = [...documents];
        updated[index] = { ...updated[index], ...updates };
        onChange(updated);
    };

    const removeDocument = (index: number) => {
        const updated = documents.filter((_, i) => i !== index);
        updated.forEach((d, i) => (d.order = i + 1));
        onChange(updated);
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <Label>Required Documents</Label>
                <Button type="button" variant="outline" size="sm" onClick={addDocument}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Document
                </Button>
            </div>

            {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                    No documents defined. Add documents that applicants must upload.
                </p>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {documents.map((doc, index) => (
                        <Card key={index} className="p-3">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 space-y-2">
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <Label className="text-xs">Document Type *</Label>
                                            <Input
                                                value={doc.documentType}
                                                onChange={(e) => updateDocument(index, { documentType: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                                                placeholder="ID_CARD"
                                                className="text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Display Name *</Label>
                                            <Input
                                                value={doc.documentName}
                                                onChange={(e) => updateDocument(index, { documentName: e.target.value })}
                                                placeholder="Valid ID Card"
                                                className="text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Uploaded By *</Label>
                                            <Select
                                                value={doc.uploadedBy}
                                                onValueChange={(value: UploaderType) => updateDocument(index, { uploadedBy: value })}
                                            >
                                                <SelectTrigger className="text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {UPLOADER_TYPES.map((type) => (
                                                        <SelectItem key={type.value} value={type.value}>
                                                            {type.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-xs">Description</Label>
                                            <Input
                                                value={doc.description || ''}
                                                onChange={(e) => updateDocument(index, { description: e.target.value })}
                                                placeholder="Valid government-issued ID"
                                                className="text-sm"
                                            />
                                        </div>
                                        <div className="flex items-end gap-4">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={doc.isRequired}
                                                    onCheckedChange={(checked) => updateDocument(index, { isRequired: checked })}
                                                />
                                                <Label className="text-xs">Required</Label>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Condition Editor */}
                                    <ConditionEditor
                                        condition={doc.condition}
                                        onChange={(condition) => updateDocument(index, { condition })}
                                        questionnairePlans={questionnairePlans}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeDocument(index)}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

interface StageEditorProps {
    stages: ApprovalStage[];
    onChange: (stages: ApprovalStage[]) => void;
}

function StageEditor({ stages, onChange }: StageEditorProps) {
    const addStage = () => {
        const newStage: ApprovalStage = {
            name: '',
            order: stages.length + 1,
            organizationTypeCode: 'PLATFORM',
            autoTransition: false,
            waitForAllDocuments: true,
            onRejection: 'CASCADE_BACK',
        };
        onChange([...stages, newStage]);
    };

    const updateStage = (index: number, updates: Partial<ApprovalStage>) => {
        const updated = [...stages];
        updated[index] = { ...updated[index], ...updates };
        onChange(updated);
    };

    const removeStage = (index: number) => {
        const updated = stages.filter((_, i) => i !== index);
        updated.forEach((s, i) => (s.order = i + 1));
        onChange(updated);
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <Label>Approval Stages</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStage}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Stage
                </Button>
            </div>

            {stages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                    No approval stages defined. Add stages to define the review workflow.
                </p>
            ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {stages.map((stage, index) => (
                        <Card key={index} className="p-3">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 space-y-3">
                                    {/* Row 1: Stage Name and Reviewer Org Type */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs">Stage Name *</Label>
                                            <Input
                                                value={stage.name}
                                                onChange={(e) => updateStage(index, { name: e.target.value })}
                                                placeholder="QShelter Review"
                                                className="text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Reviewer Org Type *</Label>
                                            <Select
                                                value={stage.organizationTypeCode}
                                                onValueChange={(value) => updateStage(index, { organizationTypeCode: value })}
                                            >
                                                <SelectTrigger className="text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ORGANIZATION_TYPE_CODES.map((type) => (
                                                        <SelectItem key={type.value} value={type.value}>
                                                            {type.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {/* Row 2: On Rejection and SLA */}
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <Label className="text-xs">On Rejection</Label>
                                            <Select
                                                value={stage.onRejection || 'CASCADE_BACK'}
                                                onValueChange={(value: 'CASCADE_BACK' | 'REJECT_APPLICATION' | 'HOLD') => updateStage(index, { onRejection: value })}
                                            >
                                                <SelectTrigger className="text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {REJECTION_ACTIONS.map((action) => (
                                                        <SelectItem key={action.value} value={action.value}>
                                                            {action.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-xs">SLA (hours)</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={stage.slaHours ?? ''}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    updateStage(index, { slaHours: v === '' ? undefined : parseInt(v, 10) });
                                                }}
                                                placeholder="24"
                                                className="text-sm"
                                            />
                                        </div>
                                    </div>
                                    {/* Row 3: Toggles */}
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={stage.autoTransition}
                                                onCheckedChange={(checked) => updateStage(index, { autoTransition: checked })}
                                            />
                                            <Label className="text-xs">Auto-transition when complete</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={stage.waitForAllDocuments}
                                                onCheckedChange={(checked) => updateStage(index, { waitForAllDocuments: checked })}
                                            />
                                            <Label className="text-xs">Wait for all docs</Label>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeStage(index)}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

function CreateDocumentationPlanDialog() {
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState<CreateDocumentationPlanInput>({
        name: '',
        description: '',
        isActive: true,
        documentDefinitions: [],
        approvalStages: [],
    });

    const createMutation = useCreateDocumentationPlan();
    const { data: questionnairePlans } = useQuestionnairePlans();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.documentDefinitions || formData.documentDefinitions.length === 0) {
            toast.error('Please add at least one document definition');
            return;
        }

        if (!formData.approvalStages || formData.approvalStages.length === 0) {
            toast.error('Please add at least one approval stage');
            return;
        }

        try {
            await createMutation.mutateAsync(formData);
            toast.success('Documentation plan created successfully');
            setOpen(false);
            setFormData({
                name: '',
                description: '',
                isActive: true,
                documentDefinitions: [],
                approvalStages: [],
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to create documentation plan');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Documentation Plan
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create Documentation Plan</DialogTitle>
                        <DialogDescription>
                            Define required documents and the approval workflow stages.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Mortgage KYC Documentation"
                                    required
                                />
                            </div>
                            <div className="flex items-center gap-4 pt-6">
                                <Switch
                                    checked={formData.isActive}
                                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                />
                                <Label>Active</Label>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe the documentation workflow..."
                                rows={2}
                            />
                        </div>

                        <hr className="my-2" />

                        <DocumentEditor
                            documents={formData.documentDefinitions}
                            onChange={(docs) => setFormData({ ...formData, documentDefinitions: docs })}
                            questionnairePlans={questionnairePlans || []}
                        />

                        <hr className="my-2" />

                        <StageEditor
                            stages={formData.approvalStages}
                            onChange={(stages) => setFormData({ ...formData, approvalStages: stages })}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Creating...' : 'Create Plan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DocumentationPlanCard({ plan }: { plan: DocumentationPlan }) {
    const deleteMutation = useDeleteDocumentationPlan();

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${plan.name}"?`)) return;
        try {
            await deleteMutation.mutateAsync(plan.id);
            toast.success('Documentation plan deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete documentation plan');
        }
    };

    const getUploaderColor = (uploader: UploaderType) => {
        return UPLOADER_TYPES.find((u) => u.value === uploader)?.color || '';
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <div>
                            <CardTitle className="text-lg">{plan.name}</CardTitle>
                            <CardDescription>{plan.description || 'No description'}</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                            {plan.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Documents */}
                <div>
                    <Label className="text-xs text-muted-foreground">Required Documents</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {plan.documentDefinitions?.map((doc, i) => (
                            <Badge key={i} variant="outline" className={`text-xs ${getUploaderColor(doc.uploadedBy)}`}>
                                <Upload className="h-3 w-3 mr-1" />
                                {doc.documentName}
                                <span className="ml-1 opacity-60">({doc.uploadedBy})</span>
                                {doc.condition && (
                                    <span className="ml-1 text-amber-600" title={describeCondition(doc.condition)}>
                                        ⚡ conditional
                                    </span>
                                )}
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Approval Stages */}
                <div>
                    <Label className="text-xs text-muted-foreground">Approval Stages</Label>
                    <div className="flex items-center gap-1 mt-1">
                        {plan.approvalStages
                            ?.sort((a, b) => a.order - b.order)
                            .map((stage, i) => (
                                <div key={i} className="flex items-center">
                                    <Badge variant="outline" className="text-xs">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        {stage.name}
                                        {stage.autoTransition && ' (auto)'}
                                    </Badge>
                                    {i < (plan.approvalStages?.length || 0) - 1 && (
                                        <span className="mx-1 text-muted-foreground">→</span>
                                    )}
                                </div>
                            ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function DocumentationPlansPage() {
    const { data: plans, isLoading, error } = useDocumentationPlans();

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Loading Documentation Plans</CardTitle>
                        <CardDescription>{(error as Error).message}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Documentation Plans</h1>
                    <p className="text-muted-foreground">
                        Define required documents and multi-stage approval workflows
                    </p>
                </div>
                <CreateDocumentationPlanDialog />
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            ) : plans && plans.length > 0 ? (
                <div className="grid gap-4">
                    {plans.map((plan) => (
                        <DocumentationPlanCard key={plan.id} plan={plan} />
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-lg font-medium mb-2">No documentation plans yet</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Create documentation plans to define document requirements and approval workflows.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Reference Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Understanding Documentation Plans</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                    <div>
                        <strong>Uploader Types:</strong>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {UPLOADER_TYPES.map((type) => (
                                <Badge key={type.value} variant="outline" className={type.color}>
                                    {type.label}
                                </Badge>
                            ))}
                        </div>
                    </div>
                    <div>
                        <strong>Approval Stages:</strong> Each stage reviews documents from specific uploaders.
                        <ul className="list-disc list-inside mt-1 ml-2">
                            <li>PLATFORM stage reviews CUSTOMER + PLATFORM uploads</li>
                            <li>BANK stage reviews LENDER uploads</li>
                            <li>DEVELOPER stage reviews DEVELOPER uploads</li>
                        </ul>
                    </div>
                    <div>
                        <strong>Auto-Transition:</strong> When enabled, documents uploaded by the stage&apos;s own
                        organization type are auto-approved.
                    </div>
                    <div>
                        <strong>Conditional Documents:</strong> Documents can be tied to questionnaire answers.
                        For example, a &quot;Spouse ID&quot; document can be configured to only be required when
                        the <code className="text-xs bg-muted px-1 rounded">mortgage_type</code> question answer
                        equals <code className="text-xs bg-muted px-1 rounded">JOINT</code>. Conditions are
                        evaluated automatically when a documentation phase activates after a questionnaire phase.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    useQuestionnairePlan,
    useUpdateQuestionnairePlan,
    useAddQuestionToPlan,
    useUpdateQuestion,
    useRemoveQuestion,
    type QuestionnairePlan,
    type QuestionDefinition,
    type QuestionType,
    type ScoringStrategy,
    type UpdateQuestionnairePlanInput,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
    Plus,
    Trash2,
    ArrowLeft,
    Save,
    Loader2,
    Pencil,
    HelpCircle,
    GripVertical,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
    { value: 'TEXT', label: 'Text' },
    { value: 'NUMBER', label: 'Number' },
    { value: 'CURRENCY', label: 'Currency' },
    { value: 'DATE', label: 'Date' },
    { value: 'SELECT', label: 'Single Select' },
    { value: 'MULTI_SELECT', label: 'Multi Select' },
    { value: 'RADIO', label: 'Radio (Single Choice)' },
    { value: 'CHECKBOX', label: 'Checkbox (Yes/No)' },
    { value: 'PHONE', label: 'Phone Number' },
    { value: 'EMAIL', label: 'Email' },
    { value: 'ADDRESS', label: 'Address' },
    { value: 'PERCENTAGE', label: 'Percentage' },
    { value: 'YEARS_MONTHS', label: 'Duration (Years/Months)' },
    { value: 'FILE_UPLOAD', label: 'File Upload' },
];

const SCORING_STRATEGIES: { value: ScoringStrategy; label: string; description: string }[] = [
    { value: 'SUM', label: 'Sum', description: 'Add all scores together' },
    { value: 'AVERAGE', label: 'Average', description: 'Average of all scores' },
    { value: 'WEIGHTED_SUM', label: 'Weighted Sum', description: 'Weight-based scoring' },
    { value: 'MIN_ALL', label: 'Minimum of All', description: 'Must pass all questions' },
    { value: 'CUSTOM', label: 'Custom', description: 'Custom scoring logic' },
];

const SCORING_OPERATORS = [
    { value: 'EQUALS', label: '=' },
    { value: 'NOT_EQUALS', label: '≠' },
    { value: 'GREATER_THAN', label: '>' },
    { value: 'LESS_THAN', label: '<' },
    { value: 'GREATER_THAN_OR_EQUAL', label: '≥' },
    { value: 'LESS_THAN_OR_EQUAL', label: '≤' },
];

const OPTION_TYPES: QuestionType[] = ['SELECT', 'MULTI_SELECT', 'RADIO'];
const BOOLEAN_TYPE: QuestionType = 'CHECKBOX';
const NUMERIC_TYPES: QuestionType[] = ['NUMBER', 'CURRENCY', 'PERCENTAGE', 'YEARS_MONTHS'];

const DEFAULT_BOOLEAN_OPTIONS = [
    { value: 'true', label: 'Yes', score: 100 },
    { value: 'false', label: 'No', score: 0 },
];

// ============================================================================
// Sub-components for question editing
// ============================================================================

function OptionsEditor({
    options,
    onChange,
}: {
    options: { value: string; label: string; score?: number }[];
    onChange: (options: { value: string; label: string; score?: number }[]) => void;
}) {
    return (
        <div className="space-y-2 mt-2 pl-4 border-l-2 border-muted">
            <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Options</Label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange([...options, { value: '', label: '', score: 0 }])}
                >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Option
                </Button>
            </div>
            {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                    <Input
                        value={opt.value}
                        onChange={(e) => {
                            const updated = [...options];
                            updated[i] = { ...updated[i], value: e.target.value.toUpperCase().replace(/\s+/g, '_') };
                            onChange(updated);
                        }}
                        placeholder="VALUE"
                        className="text-xs w-24"
                    />
                    <Input
                        value={opt.label}
                        onChange={(e) => {
                            const updated = [...options];
                            updated[i] = { ...updated[i], label: e.target.value };
                            onChange(updated);
                        }}
                        placeholder="Display Label"
                        className="text-xs flex-1"
                    />
                    <Input
                        type="number"
                        value={opt.score ?? 0}
                        onChange={(e) => {
                            const updated = [...options];
                            updated[i] = { ...updated[i], score: e.target.value === '' ? 0 : parseInt(e.target.value, 10) };
                            onChange(updated);
                        }}
                        placeholder="Score"
                        className="text-xs w-16"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => onChange(options.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                </div>
            ))}
            {options.length === 0 && (
                <p className="text-xs text-muted-foreground">No options. Add options for users to select from.</p>
            )}
        </div>
    );
}

function BooleanOptionsEditor({
    options,
    onChange,
}: {
    options: { value: string; label: string; score?: number }[];
    onChange: (options: { value: string; label: string; score?: number }[]) => void;
}) {
    const trueOption = options.find((o) => o.value === 'true') || { value: 'true', label: 'Yes', score: 100 };
    const falseOption = options.find((o) => o.value === 'false') || { value: 'false', label: 'No', score: 0 };

    const updateOption = (value: 'true' | 'false', updates: Partial<{ label: string; score?: number }>) => {
        const updated = value === 'true'
            ? [{ ...trueOption, ...updates }, falseOption]
            : [trueOption, { ...falseOption, ...updates }];
        onChange(updated);
    };

    return (
        <div className="space-y-2 mt-2 pl-4 border-l-2 border-green-200">
            <Label className="text-xs text-muted-foreground">Yes/No Scoring</Label>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label className="text-xs font-medium text-green-700">Yes (true)</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            value={trueOption.label}
                            onChange={(e) => updateOption('true', { label: e.target.value })}
                            placeholder="Yes"
                            className="text-xs flex-1"
                        />
                        <div className="flex items-center gap-1">
                            <Label className="text-xs">Score:</Label>
                            <Input
                                type="number"
                                value={trueOption.score ?? 0}
                                onChange={(e) => updateOption('true', { score: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })}
                                className="text-xs w-16"
                            />
                        </div>
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs font-medium text-red-700">No (false)</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            value={falseOption.label}
                            onChange={(e) => updateOption('false', { label: e.target.value })}
                            placeholder="No"
                            className="text-xs flex-1"
                        />
                        <div className="flex items-center gap-1">
                            <Label className="text-xs">Score:</Label>
                            <Input
                                type="number"
                                value={falseOption.score ?? 0}
                                onChange={(e) => updateOption('false', { score: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })}
                                className="text-xs w-16"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ScoringRulesEditor({
    rules,
    onChange,
}: {
    rules: { operator: string; value: number | string; score: number }[];
    onChange: (rules: { operator: string; value: number | string; score: number }[]) => void;
}) {
    return (
        <div className="space-y-2 mt-2 pl-4 border-l-2 border-blue-200">
            <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Scoring Rules</Label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange([...rules, { operator: 'GREATER_THAN_OR_EQUAL', value: 0, score: 100 }])}
                >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Rule
                </Button>
            </div>
            {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                    <Select
                        value={rule.operator}
                        onValueChange={(value) => {
                            const updated = [...rules];
                            updated[i] = { ...updated[i], operator: value };
                            onChange(updated);
                        }}
                    >
                        <SelectTrigger className="text-xs w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SCORING_OPERATORS.map((op) => (
                                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="number"
                        value={typeof rule.value === 'number' ? rule.value : 0}
                        onChange={(e) => {
                            const updated = [...rules];
                            updated[i] = { ...updated[i], value: e.target.value === '' ? 0 : parseFloat(e.target.value) };
                            onChange(updated);
                        }}
                        placeholder="Value"
                        className="text-xs w-24"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                        type="number"
                        value={rule.score}
                        onChange={(e) => {
                            const updated = [...rules];
                            updated[i] = { ...updated[i], score: e.target.value === '' ? 0 : parseInt(e.target.value, 10) };
                            onChange(updated);
                        }}
                        placeholder="Score"
                        className="text-xs w-16"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => onChange(rules.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                </div>
            ))}
            {rules.length === 0 && (
                <p className="text-xs text-muted-foreground">No rules. Add scoring rules based on numeric values.</p>
            )}
        </div>
    );
}

function ValidationRulesEditor({
    rules,
    onChange,
    questionType,
}: {
    rules: Record<string, unknown>;
    onChange: (rules: Record<string, unknown>) => void;
    questionType: QuestionType;
}) {
    if (!NUMERIC_TYPES.includes(questionType)) return null;

    return (
        <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Min:</Label>
                <Input
                    type="number"
                    value={(rules.min as number) ?? ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        const newRules = { ...rules };
                        if (val === '') {
                            delete newRules.min;
                        } else {
                            newRules.min = parseFloat(val);
                        }
                        onChange(newRules);
                    }}
                    placeholder="—"
                    className="text-xs w-20"
                />
            </div>
            <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Max:</Label>
                <Input
                    type="number"
                    value={(rules.max as number) ?? ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        const newRules = { ...rules };
                        if (val === '') {
                            delete newRules.max;
                        } else {
                            newRules.max = parseFloat(val);
                        }
                        onChange(newRules);
                    }}
                    placeholder="—"
                    className="text-xs w-20"
                />
            </div>
        </div>
    );
}

// ============================================================================
// Question Card — inline editing for an existing question
// ============================================================================

function QuestionCard({
    question,
    planId,
    index,
    totalQuestions,
}: {
    question: QuestionDefinition;
    planId: string;
    index: number;
    totalQuestions: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState<QuestionDefinition>(question);

    const updateMutation = useUpdateQuestion();
    const removeMutation = useRemoveQuestion();

    useEffect(() => {
        setEditData(question);
    }, [question]);

    const handleSave = async () => {
        if (!question.id) return;
        try {
            // Strip the id before sending to API
            const { id, ...data } = editData;
            await updateMutation.mutateAsync({
                planId,
                questionId: question.id,
                data,
            });
            toast.success(`Question "${editData.questionKey}" updated`);
            setEditing(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update question');
        }
    };

    const handleRemove = async () => {
        if (!question.id) return;
        if (!confirm(`Remove question "${question.questionKey}"?`)) return;
        try {
            await removeMutation.mutateAsync({ planId, questionId: question.id });
            toast.success('Question removed');
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove question');
        }
    };

    if (!editing) {
        // Read-only view
        return (
            <Card className="p-3">
                <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1 text-muted-foreground pt-1">
                        <GripVertical className="h-4 w-4" />
                        <span className="text-xs font-mono w-5 text-center">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{question.questionKey}</code>
                            <Badge variant="outline" className="text-xs">
                                {QUESTION_TYPES.find((t) => t.value === question.questionType)?.label || question.questionType}
                            </Badge>
                            {question.isRequired && (
                                <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                            {question.scoreWeight && question.scoreWeight > 1 && (
                                <Badge variant="outline" className="text-xs">Weight: {question.scoreWeight}</Badge>
                            )}
                            {question.category && (
                                <Badge variant="outline" className="text-xs">{question.category}</Badge>
                            )}
                        </div>
                        <p className="text-sm mt-1">{question.questionText}</p>
                        {question.helpText && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <HelpCircle className="h-3 w-3" />
                                {question.helpText}
                            </p>
                        )}

                        {/* Show options summary */}
                        {question.options && (question.options as any[]).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {(question.options as any[]).map((opt: any, i: number) => (
                                    <Badge key={i} variant="outline" className="text-xs font-normal">
                                        {opt.label || opt.value}
                                        {opt.score !== undefined && opt.score !== 0 && (
                                            <span className="ml-1 text-muted-foreground">({opt.score}pts)</span>
                                        )}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Show scoring rules summary */}
                        {question.scoringRules && (question.scoringRules as any[]).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {(question.scoringRules as any[]).map((rule: any, i: number) => (
                                    <Badge key={i} variant="outline" className="text-xs font-normal text-blue-600">
                                        {SCORING_OPERATORS.find((o) => o.value === rule.operator)?.label || rule.operator}{' '}
                                        {rule.value} → {rule.score}pts
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleRemove}
                            disabled={removeMutation.isPending}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            </Card>
        );
    }

    // Editing view
    return (
        <Card className="p-3 border-primary">
            <div className="space-y-3">
                {/* Row 1: Key, Type */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                        <Label className="text-xs">Question Key *</Label>
                        <Input
                            value={editData.questionKey}
                            onChange={(e) => setEditData({ ...editData, questionKey: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                            placeholder="e.g., applicant_age"
                            className="text-sm"
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Type *</Label>
                        <Select
                            value={editData.questionType}
                            onValueChange={(value: QuestionType) => {
                                const updates: Partial<QuestionDefinition> = { questionType: value };
                                if (OPTION_TYPES.includes(value) && !editData.options) {
                                    updates.options = [];
                                }
                                if (value === BOOLEAN_TYPE) {
                                    updates.options = [...DEFAULT_BOOLEAN_OPTIONS];
                                }
                                if (NUMERIC_TYPES.includes(value) && !editData.scoringRules) {
                                    updates.scoringRules = [];
                                }
                                setEditData({ ...editData, ...updates });
                            }}
                        >
                            <SelectTrigger className="text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {QUESTION_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Row 2: Question Text */}
                <div>
                    <Label className="text-xs">Question Text *</Label>
                    <Input
                        value={editData.questionText}
                        onChange={(e) => setEditData({ ...editData, questionText: e.target.value })}
                        placeholder="What is your age?"
                        className="text-sm"
                    />
                </div>

                {/* Row 3: Required, Weight, Category, Order */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={editData.isRequired}
                            onCheckedChange={(checked) => setEditData({ ...editData, isRequired: checked })}
                        />
                        <Label className="text-xs">Required</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Weight:</Label>
                        <Input
                            type="number"
                            min="0"
                            value={editData.scoreWeight ?? 1}
                            onChange={(e) => setEditData({ ...editData, scoreWeight: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })}
                            className="w-16 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Category:</Label>
                        <Input
                            value={editData.category || ''}
                            onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                            placeholder="ELIGIBILITY"
                            className="w-28 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Order:</Label>
                        <Input
                            type="number"
                            min="1"
                            value={editData.order}
                            onChange={(e) => setEditData({ ...editData, order: e.target.value === '' ? 1 : parseInt(e.target.value, 10) })}
                            className="w-16 text-sm"
                        />
                    </div>
                </div>

                {/* Help Text */}
                <div>
                    <Label className="text-xs">Help Text</Label>
                    <Input
                        value={editData.helpText || ''}
                        onChange={(e) => setEditData({ ...editData, helpText: e.target.value })}
                        placeholder="Optional helper text for users"
                        className="text-sm"
                    />
                </div>

                {/* Validation Rules for numeric types */}
                <ValidationRulesEditor
                    rules={editData.validationRules || {}}
                    onChange={(rules) => setEditData({ ...editData, validationRules: rules })}
                    questionType={editData.questionType}
                />

                {/* Options for SELECT/MULTI_SELECT/RADIO */}
                {OPTION_TYPES.includes(editData.questionType) && (
                    <OptionsEditor
                        options={(editData.options as any[]) || []}
                        onChange={(options) => setEditData({ ...editData, options })}
                    />
                )}

                {/* Yes/No options for CHECKBOX type */}
                {editData.questionType === BOOLEAN_TYPE && (
                    <BooleanOptionsEditor
                        options={(editData.options as any[]) || DEFAULT_BOOLEAN_OPTIONS}
                        onChange={(options) => setEditData({ ...editData, options })}
                    />
                )}

                {/* Scoring Rules for numeric types */}
                {NUMERIC_TYPES.includes(editData.questionType) && (
                    <ScoringRulesEditor
                        rules={(editData.scoringRules || []) as { operator: string; value: number | string; score: number }[]}
                        onChange={(rules) => setEditData({ ...editData, scoringRules: rules as QuestionDefinition['scoringRules'] })}
                    />
                )}

                {/* Save / Cancel buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setEditData(question);
                            setEditing(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                    >
                        {updateMutation.isPending ? (
                            <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-3 w-3 mr-1" />
                                Save Question
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Card>
    );
}

// ============================================================================
// Add Question Dialog
// ============================================================================

function AddQuestionDialog({ planId, nextOrder }: { planId: string; nextOrder: number }) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<Omit<QuestionDefinition, 'id'>>({
        questionKey: '',
        questionText: '',
        questionType: 'TEXT',
        order: nextOrder,
        isRequired: true,
        scoreWeight: 1,
    });
    const addMutation = useAddQuestionToPlan();

    useEffect(() => {
        setData((prev) => ({ ...prev, order: nextOrder }));
    }, [nextOrder]);

    const handleSubmit = async () => {
        if (!data.questionKey || !data.questionText) {
            toast.error('Question key and text are required');
            return;
        }
        try {
            await addMutation.mutateAsync({ planId, data });
            toast.success('Question added');
            setOpen(false);
            setData({
                questionKey: '',
                questionText: '',
                questionType: 'TEXT',
                order: nextOrder + 1,
                isRequired: true,
                scoreWeight: 1,
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to add question');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Question
            </Button>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Question</DialogTitle>
                    <DialogDescription>Add a new question to this questionnaire plan.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                    {/* Row 1: Key, Type */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                            <Label className="text-xs">Question Key *</Label>
                            <Input
                                value={data.questionKey}
                                onChange={(e) => setData({ ...data, questionKey: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                                placeholder="e.g., applicant_age"
                                className="text-sm"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Type *</Label>
                            <Select
                                value={data.questionType}
                                onValueChange={(value: QuestionType) => {
                                    const updates: Partial<QuestionDefinition> = { questionType: value };
                                    if (OPTION_TYPES.includes(value) && !data.options) {
                                        updates.options = [];
                                    }
                                    if (value === BOOLEAN_TYPE) {
                                        updates.options = [...DEFAULT_BOOLEAN_OPTIONS];
                                    }
                                    if (NUMERIC_TYPES.includes(value) && !data.scoringRules) {
                                        updates.scoringRules = [];
                                    }
                                    setData({ ...data, ...updates });
                                }}
                            >
                                <SelectTrigger className="text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {QUESTION_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2: Question Text */}
                    <div>
                        <Label className="text-xs">Question Text *</Label>
                        <Input
                            value={data.questionText}
                            onChange={(e) => setData({ ...data, questionText: e.target.value })}
                            placeholder="What is your age?"
                            className="text-sm"
                        />
                    </div>

                    {/* Row 3: Required, Weight, Category, Order */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={data.isRequired}
                                onCheckedChange={(checked) => setData({ ...data, isRequired: checked })}
                            />
                            <Label className="text-xs">Required</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">Weight:</Label>
                            <Input
                                type="number"
                                min="0"
                                value={data.scoreWeight ?? 1}
                                onChange={(e) => setData({ ...data, scoreWeight: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })}
                                className="w-16 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">Category:</Label>
                            <Input
                                value={data.category || ''}
                                onChange={(e) => setData({ ...data, category: e.target.value })}
                                placeholder="ELIGIBILITY"
                                className="w-28 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">Order:</Label>
                            <Input
                                type="number"
                                min="1"
                                value={data.order}
                                onChange={(e) => setData({ ...data, order: e.target.value === '' ? 1 : parseInt(e.target.value, 10) })}
                                className="w-16 text-sm"
                            />
                        </div>
                    </div>

                    {/* Help Text */}
                    <div>
                        <Label className="text-xs">Help Text</Label>
                        <Input
                            value={data.helpText || ''}
                            onChange={(e) => setData({ ...data, helpText: e.target.value })}
                            placeholder="Optional helper text for users"
                            className="text-sm"
                        />
                    </div>

                    {/* Validation Rules */}
                    <ValidationRulesEditor
                        rules={data.validationRules || {}}
                        onChange={(rules) => setData({ ...data, validationRules: rules })}
                        questionType={data.questionType}
                    />

                    {/* Options */}
                    {OPTION_TYPES.includes(data.questionType) && (
                        <OptionsEditor
                            options={(data.options as any[]) || []}
                            onChange={(options) => setData({ ...data, options })}
                        />
                    )}

                    {/* Checkbox */}
                    {data.questionType === BOOLEAN_TYPE && (
                        <BooleanOptionsEditor
                            options={(data.options as any[]) || DEFAULT_BOOLEAN_OPTIONS}
                            onChange={(options) => setData({ ...data, options })}
                        />
                    )}

                    {/* Scoring Rules */}
                    {NUMERIC_TYPES.includes(data.questionType) && (
                        <ScoringRulesEditor
                            rules={(data.scoringRules || []) as { operator: string; value: number | string; score: number }[]}
                            onChange={(rules) => setData({ ...data, scoringRules: rules as QuestionDefinition['scoringRules'] })}
                        />
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={addMutation.isPending}>
                        {addMutation.isPending ? 'Adding...' : 'Add Question'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// Main Edit Page
// ============================================================================

export default function EditQuestionnairePlanPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: planId } = use(params);
    const router = useRouter();

    const { data: plan, isLoading, error } = useQuestionnairePlan(planId);
    const updateMutation = useUpdateQuestionnairePlan();

    // Plan metadata form state
    const [metaData, setMetaData] = useState<UpdateQuestionnairePlanInput>({});
    const [metaDirty, setMetaDirty] = useState(false);

    // Initialize form when data loads
    useEffect(() => {
        if (plan) {
            setMetaData({
                name: plan.name,
                description: plan.description || '',
                isActive: plan.isActive,
                passingScore: plan.passingScore,
                scoringStrategy: plan.scoringStrategy,
                autoDecisionEnabled: plan.autoDecisionEnabled,
                estimatedMinutes: plan.estimatedMinutes,
                category: plan.category || '',
            });
            setMetaDirty(false);
        }
    }, [plan]);

    const updateMeta = (updates: Partial<UpdateQuestionnairePlanInput>) => {
        setMetaData((prev) => ({ ...prev, ...updates }));
        setMetaDirty(true);
    };

    const handleSaveMeta = async () => {
        try {
            await updateMutation.mutateAsync({ id: planId, data: metaData });
            toast.success('Plan updated');
            setMetaDirty(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update plan');
        }
    };

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (error || !plan) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error</CardTitle>
                        <CardDescription>
                            {(error as Error)?.message || 'Questionnaire plan not found'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" onClick={() => router.push('/admin/questionnaire-plans')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Plans
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const nextOrder = plan.questions.length > 0
        ? Math.max(...plan.questions.map((q) => q.order)) + 1
        : 1;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/admin/questionnaire-plans')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Edit Questionnaire Plan</h1>
                    <p className="text-muted-foreground">{plan.name}</p>
                </div>
                <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                </Badge>
            </div>

            {/* Plan Metadata */}
            <Card>
                <CardHeader>
                    <CardTitle>Plan Settings</CardTitle>
                    <CardDescription>Configure the questionnaire plan metadata and scoring.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={metaData.name || ''}
                                onChange={(e) => updateMeta({ name: e.target.value })}
                                placeholder="e.g., Mortgage Prequalification"
                            />
                        </div>
                        <div>
                            <Label htmlFor="category">Category</Label>
                            <Input
                                id="category"
                                value={metaData.category || ''}
                                onChange={(e) => updateMeta({ category: e.target.value })}
                                placeholder="PREQUALIFICATION"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={metaData.description || ''}
                            onChange={(e) => updateMeta({ description: e.target.value })}
                            placeholder="Describe what this questionnaire collects..."
                            rows={2}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="scoringStrategy">Scoring Strategy</Label>
                            <Select
                                value={metaData.scoringStrategy}
                                onValueChange={(value: ScoringStrategy) => updateMeta({ scoringStrategy: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SCORING_STRATEGIES.map((strategy) => (
                                        <SelectItem key={strategy.value} value={strategy.value}>
                                            {strategy.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="passingScore">Passing Score</Label>
                            <Input
                                id="passingScore"
                                type="number"
                                min="0"
                                value={metaData.passingScore ?? ''}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    updateMeta({ passingScore: v === '' ? null : parseInt(v, 10) });
                                }}
                                placeholder="100"
                            />
                        </div>
                        <div>
                            <Label htmlFor="estimatedMinutes">Est. Minutes</Label>
                            <Input
                                id="estimatedMinutes"
                                type="number"
                                min="1"
                                value={metaData.estimatedMinutes ?? ''}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    updateMeta({ estimatedMinutes: v === '' ? null : parseInt(v, 10) });
                                }}
                                placeholder="5"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={metaData.isActive ?? true}
                                    onCheckedChange={(checked) => updateMeta({ isActive: checked })}
                                />
                                <Label>Active</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={metaData.autoDecisionEnabled ?? false}
                                    onCheckedChange={(checked) => updateMeta({ autoDecisionEnabled: checked })}
                                />
                                <Label>Auto Decision</Label>
                            </div>
                        </div>
                        <Button
                            onClick={handleSaveMeta}
                            disabled={!metaDirty || updateMutation.isPending}
                        >
                            {updateMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Settings
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Questions */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Questions ({plan.questions.length})</CardTitle>
                            <CardDescription>
                                Manage the questions in this plan. Click the pencil icon to edit a question.
                            </CardDescription>
                        </div>
                        <AddQuestionDialog planId={planId} nextOrder={nextOrder} />
                    </div>
                </CardHeader>
                <CardContent>
                    {plan.questions.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg">
                            <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                                No questions yet. Add questions to collect applicant information.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {plan.questions.map((question, index) => (
                                <QuestionCard
                                    key={question.id || index}
                                    question={question}
                                    planId={planId}
                                    index={index}
                                    totalQuestions={plan.questions.length}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

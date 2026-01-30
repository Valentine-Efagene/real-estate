'use client';

import { useState } from 'react';
import {
    useQuestionnairePlans,
    useCreateQuestionnairePlan,
    useDeleteQuestionnairePlan,
    type QuestionnairePlan,
    type CreateQuestionnairePlanInput,
    type QuestionDefinition,
    type QuestionType,
    type ScoringStrategy,
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
import { Plus, Trash2, ClipboardList, HelpCircle } from 'lucide-react';
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

// Types that require options (select-style)
const OPTION_TYPES: QuestionType[] = ['SELECT', 'MULTI_SELECT', 'RADIO'];
// Boolean type (Yes/No with fixed options)
const BOOLEAN_TYPE: QuestionType = 'CHECKBOX';
// Types that support scoring rules
const NUMERIC_TYPES: QuestionType[] = ['NUMBER', 'CURRENCY', 'PERCENTAGE', 'YEARS_MONTHS'];

// Default Yes/No options for CHECKBOX type
const DEFAULT_BOOLEAN_OPTIONS = [
    { value: 'true', label: 'Yes', score: 100 },
    { value: 'false', label: 'No', score: 0 },
];

interface QuestionEditorProps {
    questions: QuestionDefinition[];
    onChange: (questions: QuestionDefinition[]) => void;
}

// Sub-component for managing options (SELECT, MULTI_SELECT, RADIO)
function OptionsEditor({
    options,
    onChange,
}: {
    options: { value: string; label: string; score?: number }[];
    onChange: (options: { value: string; label: string; score?: number }[]) => void;
}) {
    const addOption = () => {
        onChange([...options, { value: '', label: '', score: 0 }]);
    };

    const updateOption = (index: number, updates: Partial<{ value: string; label: string; score?: number }>) => {
        const updated = [...options];
        updated[index] = { ...updated[index], ...updates };
        onChange(updated);
    };

    const removeOption = (index: number) => {
        onChange(options.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2 mt-2 pl-4 border-l-2 border-muted">
            <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Options</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Option
                </Button>
            </div>
            {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                    <Input
                        value={opt.value}
                        onChange={(e) => updateOption(i, { value: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                        placeholder="VALUE"
                        className="text-xs w-24"
                    />
                    <Input
                        value={opt.label}
                        onChange={(e) => updateOption(i, { label: e.target.value })}
                        placeholder="Display Label"
                        className="text-xs flex-1"
                    />
                    <Input
                        type="number"
                        value={opt.score ?? 0}
                        onChange={(e) => updateOption(i, { score: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })}
                        placeholder="Score"
                        className="text-xs w-16"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(i)}>
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

// Sub-component for managing Yes/No (CHECKBOX) options with fixed true/false values
function BooleanOptionsEditor({
    options,
    onChange,
}: {
    options: { value: string; label: string; score?: number }[];
    onChange: (options: { value: string; label: string; score?: number }[]) => void;
}) {
    // Ensure we have both true and false options
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

// Sub-component for managing scoring rules (NUMBER, CURRENCY)
function ScoringRulesEditor({
    rules,
    onChange,
}: {
    rules: { operator: string; value: number | string; score: number }[];
    onChange: (rules: { operator: string; value: number | string; score: number }[]) => void;
}) {
    const addRule = () => {
        onChange([...rules, { operator: 'GREATER_THAN_OR_EQUAL', value: 0, score: 100 }]);
    };

    const updateRule = (index: number, updates: Partial<{ operator: string; value: number | string; score: number }>) => {
        const updated = [...rules];
        updated[index] = { ...updated[index], ...updates };
        onChange(updated);
    };

    const removeRule = (index: number) => {
        onChange(rules.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2 mt-2 pl-4 border-l-2 border-blue-200">
            <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Scoring Rules</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addRule}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Rule
                </Button>
            </div>
            {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                    <Select
                        value={rule.operator}
                        onValueChange={(value) => updateRule(i, { operator: value })}
                    >
                        <SelectTrigger className="text-xs w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SCORING_OPERATORS.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="number"
                        value={typeof rule.value === 'number' ? rule.value : 0}
                        onChange={(e) => updateRule(i, { value: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        placeholder="Value"
                        className="text-xs w-24"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                        type="number"
                        value={rule.score}
                        onChange={(e) => updateRule(i, { score: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })}
                        placeholder="Score"
                        className="text-xs w-16"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRule(i)}>
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

// Sub-component for validation rules (min/max for numeric types)
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

function QuestionEditor({ questions, onChange }: QuestionEditorProps) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const addQuestion = () => {
        const newQuestion: QuestionDefinition = {
            questionKey: `question_${questions.length + 1}`,
            questionText: '',
            questionType: 'TEXT',
            order: questions.length + 1,
            isRequired: true,
        };
        onChange([...questions, newQuestion]);
        setExpandedIndex(questions.length); // Expand the new question
    };

    const updateQuestion = (index: number, updates: Partial<QuestionDefinition>) => {
        const updated = [...questions];
        updated[index] = { ...updated[index], ...updates };
        onChange(updated);
    };

    const removeQuestion = (index: number) => {
        const updated = questions.filter((_, i) => i !== index);
        updated.forEach((q, i) => (q.order = i + 1));
        onChange(updated);
        if (expandedIndex === index) setExpandedIndex(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label>Questions</Label>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Question
                </Button>
            </div>

            {questions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                    No questions added. Add questions to collect applicant information.
                </p>
            ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {questions.map((question, index) => (
                        <Card key={index} className="p-3">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 space-y-2">
                                    {/* Row 1: Key, Type */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2">
                                            <Label className="text-xs">Question Key *</Label>
                                            <Input
                                                value={question.questionKey}
                                                onChange={(e) => updateQuestion(index, { questionKey: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                                                placeholder="e.g., applicant_age"
                                                className="text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Type *</Label>
                                            <Select
                                                value={question.questionType}
                                                onValueChange={(value: QuestionType) => {
                                                    const updates: Partial<QuestionDefinition> = { questionType: value };
                                                    // Initialize options for select types
                                                    if (OPTION_TYPES.includes(value) && !question.options) {
                                                        updates.options = [];
                                                    }
                                                    // Initialize Yes/No options for CHECKBOX type
                                                    if (value === BOOLEAN_TYPE) {
                                                        updates.options = [...DEFAULT_BOOLEAN_OPTIONS];
                                                    }
                                                    // Initialize scoring rules for numeric types
                                                    if (NUMERIC_TYPES.includes(value) && !question.scoringRules) {
                                                        updates.scoringRules = [];
                                                    }
                                                    updateQuestion(index, updates);
                                                }}
                                            >
                                                <SelectTrigger className="text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {QUESTION_TYPES.map((type) => (
                                                        <SelectItem key={type.value} value={type.value}>
                                                            {type.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Row 2: Question Text */}
                                    <div>
                                        <Label className="text-xs">Question Text *</Label>
                                        <Input
                                            value={question.questionText}
                                            onChange={(e) => updateQuestion(index, { questionText: e.target.value })}
                                            placeholder="What is your age?"
                                            className="text-sm"
                                        />
                                    </div>

                                    {/* Row 3: Required, Weight, Category */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={question.isRequired}
                                                onCheckedChange={(checked) => updateQuestion(index, { isRequired: checked })}
                                            />
                                            <Label className="text-xs">Required</Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs">Weight:</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={question.scoreWeight ?? 1}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    updateQuestion(index, { scoreWeight: v === '' ? 0 : parseInt(v, 10) });
                                                }}
                                                className="w-16 text-sm"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs">Category:</Label>
                                            <Input
                                                value={question.category || ''}
                                                onChange={(e) => updateQuestion(index, { category: e.target.value })}
                                                placeholder="ELIGIBILITY"
                                                className="w-28 text-sm"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                                        >
                                            {expandedIndex === index ? 'Collapse' : 'Expand'}
                                        </Button>
                                    </div>

                                    {/* Expanded Section: Options, Scoring Rules, Validation */}
                                    {expandedIndex === index && (
                                        <div className="space-y-3 pt-2 border-t">
                                            {/* Help Text */}
                                            <div>
                                                <Label className="text-xs">Help Text</Label>
                                                <Input
                                                    value={question.helpText || ''}
                                                    onChange={(e) => updateQuestion(index, { helpText: e.target.value })}
                                                    placeholder="Optional helper text for users"
                                                    className="text-sm"
                                                />
                                            </div>

                                            {/* Validation Rules for numeric types */}
                                            <ValidationRulesEditor
                                                rules={question.validationRules || {}}
                                                onChange={(rules) => updateQuestion(index, { validationRules: rules })}
                                                questionType={question.questionType}
                                            />

                                            {/* Options for SELECT/MULTI_SELECT/RADIO */}
                                            {OPTION_TYPES.includes(question.questionType) && (
                                                <OptionsEditor
                                                    options={question.options || []}
                                                    onChange={(options) => updateQuestion(index, { options })}
                                                />
                                            )}

                                            {/* Yes/No options for CHECKBOX type */}
                                            {question.questionType === BOOLEAN_TYPE && (
                                                <BooleanOptionsEditor
                                                    options={question.options || DEFAULT_BOOLEAN_OPTIONS}
                                                    onChange={(options) => updateQuestion(index, { options })}
                                                />
                                            )}

                                            {/* Scoring Rules for numeric types */}
                                            {NUMERIC_TYPES.includes(question.questionType) && (
                                                <ScoringRulesEditor
                                                    rules={(question.scoringRules || []) as { operator: string; value: number | string; score: number }[]}
                                                    onChange={(rules) => updateQuestion(index, { scoringRules: rules as QuestionDefinition['scoringRules'] })}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeQuestion(index)}
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

function CreateQuestionnairePlanDialog() {
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState<CreateQuestionnairePlanInput>({
        name: '',
        description: '',
        isActive: true,
        passingScore: 100,
        scoringStrategy: 'MIN_ALL',
        autoDecisionEnabled: false,
        estimatedMinutes: 5,
        category: 'PREQUALIFICATION',
        questions: [],
    });

    const createMutation = useCreateQuestionnairePlan();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.questions || formData.questions.length === 0) {
            toast.error('Please add at least one question');
            return;
        }

        try {
            await createMutation.mutateAsync(formData);
            toast.success('Questionnaire plan created successfully');
            setOpen(false);
            setFormData({
                name: '',
                description: '',
                isActive: true,
                passingScore: 100,
                scoringStrategy: 'MIN_ALL',
                autoDecisionEnabled: false,
                estimatedMinutes: 5,
                category: 'PREQUALIFICATION',
                questions: [],
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to create questionnaire plan');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Questionnaire Plan
                </Button>
            </DialogTrigger>
            <DialogContent className="min-w-max max-w-3xl max-h-[85vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create Questionnaire Plan</DialogTitle>
                        <DialogDescription>
                            Define questions to collect and score applicant information.
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
                                    placeholder="e.g., Mortgage Prequalification"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="category">Category</Label>
                                <Input
                                    id="category"
                                    value={formData.category || ''}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    placeholder="PREQUALIFICATION"
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe what this questionnaire collects..."
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="scoringStrategy">Scoring Strategy</Label>
                                <Select
                                    value={formData.scoringStrategy}
                                    onValueChange={(value: ScoringStrategy) => setFormData({ ...formData, scoringStrategy: value })}
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
                                    value={formData.passingScore ?? ''}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setFormData({ ...formData, passingScore: v === '' ? undefined : parseInt(v, 10) });
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
                                    value={formData.estimatedMinutes ?? ''}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setFormData({ ...formData, estimatedMinutes: v === '' ? undefined : parseInt(v, 10) });
                                    }}
                                    placeholder="5"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Auto Decision</Label>
                                <p className="text-sm text-muted-foreground">
                                    Automatically approve/reject based on score
                                </p>
                            </div>
                            <Switch
                                checked={formData.autoDecisionEnabled}
                                onCheckedChange={(checked) => setFormData({ ...formData, autoDecisionEnabled: checked })}
                            />
                        </div>

                        <hr className="my-2" />

                        <QuestionEditor
                            questions={formData.questions}
                            onChange={(questions) => setFormData({ ...formData, questions })}
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

function QuestionnairePlanCard({ plan }: { plan: QuestionnairePlan }) {
    const deleteMutation = useDeleteQuestionnairePlan();

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${plan.name}"?`)) return;
        try {
            await deleteMutation.mutateAsync(plan.id);
            toast.success('Questionnaire plan deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete questionnaire plan');
        }
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-purple-500" />
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
            <CardContent>
                <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="outline">
                        <HelpCircle className="h-3 w-3 mr-1" />
                        {plan.questions?.length || 0} questions
                    </Badge>
                    <Badge variant="outline">
                        Strategy: {plan.scoringStrategy}
                    </Badge>
                    <Badge variant="outline">
                        Pass: {plan.passingScore ?? 'N/A'}
                    </Badge>
                    {plan.estimatedMinutes && (
                        <Badge variant="outline">
                            ~{plan.estimatedMinutes} min
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function QuestionnairePlansPage() {
    const { data: plans, isLoading, error } = useQuestionnairePlans();

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Loading Questionnaire Plans</CardTitle>
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
                    <h1 className="text-3xl font-bold">Questionnaire Plans</h1>
                    <p className="text-muted-foreground">
                        Define questionnaires to collect and score applicant information
                    </p>
                </div>
                <CreateQuestionnairePlanDialog />
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : plans && plans.length > 0 ? (
                <div className="grid gap-4">
                    {plans.map((plan) => (
                        <QuestionnairePlanCard key={plan.id} plan={plan} />
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="text-center py-12">
                        <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-lg font-medium mb-2">No questionnaire plans yet</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Create questionnaire plans to collect applicant information during prequalification.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

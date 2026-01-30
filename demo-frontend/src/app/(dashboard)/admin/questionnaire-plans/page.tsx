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

interface QuestionEditorProps {
    questions: QuestionDefinition[];
    onChange: (questions: QuestionDefinition[]) => void;
}

function QuestionEditor({ questions, onChange }: QuestionEditorProps) {
    const addQuestion = () => {
        const newQuestion: QuestionDefinition = {
            questionKey: `question_${questions.length + 1}`,
            questionText: '',
            questionType: 'TEXT',
            order: questions.length + 1,
            isRequired: true,
        };
        onChange([...questions, newQuestion]);
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
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {questions.map((question, index) => (
                        <Card key={index} className="p-3">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 grid gap-2">
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
                                                onValueChange={(value: QuestionType) => updateQuestion(index, { questionType: value })}
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
                                    <div>
                                        <Label className="text-xs">Question Text *</Label>
                                        <Input
                                            value={question.questionText}
                                            onChange={(e) => updateQuestion(index, { questionText: e.target.value })}
                                            placeholder="What is your age?"
                                            className="text-sm"
                                        />
                                    </div>
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
                                    </div>
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
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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

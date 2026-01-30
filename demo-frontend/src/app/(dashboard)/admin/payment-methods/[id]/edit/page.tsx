'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    usePaymentMethod,
    usePaymentPlans,
    useQuestionnairePlans,
    useDocumentationPlans,
    useUpdatePaymentMethod,
    useAddPhaseToPaymentMethod,
    useUpdatePhase,
    useDeletePhase,
    useReorderPhases,
    type PaymentMethod,
    type PaymentMethodPhase,
    type CreatePaymentMethodPhase,
    type PhaseCategory,
    type PhaseType,
    type PaymentPlan,
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
    FileText,
    CreditCard,
    ClipboardList,
    ChevronUp,
    ChevronDown,
    MoreVertical,
    Copy,
    ArrowUpToLine,
    ArrowDownToLine,
    ArrowLeft,
    Save,
    Loader2,
    Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

const PHASE_CATEGORIES: { value: PhaseCategory; label: string; icon: React.ReactNode }[] = [
    { value: 'QUESTIONNAIRE', label: 'Questionnaire', icon: <ClipboardList className="h-4 w-4" /> },
    { value: 'DOCUMENTATION', label: 'Documentation', icon: <FileText className="h-4 w-4" /> },
    { value: 'PAYMENT', label: 'Payment', icon: <CreditCard className="h-4 w-4" /> },
];

const PHASE_TYPES: Record<PhaseCategory, { value: PhaseType; label: string }[]> = {
    QUESTIONNAIRE: [
        { value: 'PRE_APPROVAL', label: 'Pre-Approval' },
        { value: 'UNDERWRITING', label: 'Underwriting' },
    ],
    DOCUMENTATION: [
        { value: 'KYC', label: 'KYC Verification' },
        { value: 'VERIFICATION', label: 'Document Verification' },
    ],
    PAYMENT: [
        { value: 'DOWNPAYMENT', label: 'Downpayment' },
        { value: 'MORTGAGE', label: 'Mortgage' },
        { value: 'BALLOON', label: 'Balloon Payment' },
    ],
};

// Add Phase Dialog for adding new phases to existing payment method
function AddPhaseDialog({
    open,
    onOpenChange,
    paymentMethodId,
    currentPhaseCount,
    paymentPlans,
    questionnairePlans,
    documentationPlans,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paymentMethodId: string;
    currentPhaseCount: number;
    paymentPlans: PaymentPlan[];
    questionnairePlans: QuestionnairePlan[];
    documentationPlans: DocumentationPlan[];
}) {
    const [phase, setPhase] = useState<CreatePaymentMethodPhase>({
        name: '',
        phaseCategory: 'DOCUMENTATION',
        phaseType: 'KYC',
        order: currentPhaseCount + 1,
    });

    const addPhaseMutation = useAddPhaseToPaymentMethod();

    useEffect(() => {
        setPhase((p) => ({ ...p, order: currentPhaseCount + 1 }));
    }, [currentPhaseCount]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phase.name.trim()) {
            toast.error('Phase name is required');
            return;
        }
        try {
            await addPhaseMutation.mutateAsync({ paymentMethodId, phase });
            toast.success('Phase added successfully');
            onOpenChange(false);
            setPhase({
                name: '',
                phaseCategory: 'DOCUMENTATION',
                phaseType: 'KYC',
                order: currentPhaseCount + 2,
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to add phase');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New Phase</DialogTitle>
                        <DialogDescription>
                            Add a new phase to the payment method journey.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Phase Name *</Label>
                            <Input
                                value={phase.name}
                                onChange={(e) => setPhase({ ...phase, name: e.target.value })}
                                placeholder="e.g., KYC Verification"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Category *</Label>
                                <Select
                                    value={phase.phaseCategory}
                                    onValueChange={(value: PhaseCategory) =>
                                        setPhase({
                                            ...phase,
                                            phaseCategory: value,
                                            phaseType: PHASE_TYPES[value][0].value,
                                            questionnairePlanId: undefined,
                                            documentationPlanId: undefined,
                                            paymentPlanId: undefined,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PHASE_CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                <div className="flex items-center gap-2">
                                                    {cat.icon}
                                                    {cat.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Type *</Label>
                                <Select
                                    value={phase.phaseType}
                                    onValueChange={(value: PhaseType) => setPhase({ ...phase, phaseType: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PHASE_TYPES[phase.phaseCategory].map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Category-specific fields */}
                        {phase.phaseCategory === 'QUESTIONNAIRE' && (
                            <div>
                                <Label>Questionnaire Plan *</Label>
                                <Select
                                    value={phase.questionnairePlanId || ''}
                                    onValueChange={(value) => setPhase({ ...phase, questionnairePlanId: value || undefined })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select questionnaire plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {questionnairePlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id}>
                                                {plan.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {phase.phaseCategory === 'DOCUMENTATION' && (
                            <div>
                                <Label>Documentation Plan *</Label>
                                <Select
                                    value={phase.documentationPlanId || ''}
                                    onValueChange={(value) => setPhase({ ...phase, documentationPlanId: value || undefined })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select documentation plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {documentationPlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id}>
                                                {plan.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {phase.phaseCategory === 'PAYMENT' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>% of Price</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={phase.percentOfPrice ?? ''}
                                        onChange={(e) =>
                                            setPhase({ ...phase, percentOfPrice: e.target.value ? parseFloat(e.target.value) : undefined })
                                        }
                                        placeholder="e.g., 10"
                                    />
                                </div>
                                <div>
                                    <Label>Payment Plan</Label>
                                    <Select
                                        value={phase.paymentPlanId || ''}
                                        onValueChange={(value) => setPhase({ ...phase, paymentPlanId: value || undefined })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {paymentPlans.map((plan) => (
                                                <SelectItem key={plan.id} value={plan.id}>
                                                    {plan.name} ({plan.paymentFrequency})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={addPhaseMutation.isPending}>
                            {addPhaseMutation.isPending ? 'Adding...' : 'Add Phase'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// Edit Phase Dialog
function EditPhaseDialog({
    open,
    onOpenChange,
    paymentMethodId,
    phase,
    paymentPlans,
    questionnairePlans,
    documentationPlans,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paymentMethodId: string;
    phase: PaymentMethodPhase;
    paymentPlans: PaymentPlan[];
    questionnairePlans: QuestionnairePlan[];
    documentationPlans: DocumentationPlan[];
}) {
    const [formData, setFormData] = useState<Partial<CreatePaymentMethodPhase>>({
        name: phase.name,
        phaseCategory: phase.phaseCategory,
        phaseType: phase.phaseType,
        percentOfPrice: phase.percentOfPrice ?? undefined,
        interestRate: phase.interestRate ?? undefined,
        paymentPlanId: phase.paymentPlanId ?? undefined,
        documentationPlanId: phase.documentationPlanId ?? undefined,
        questionnairePlanId: phase.questionnairePlanId ?? undefined,
    });

    const updatePhaseMutation = useUpdatePhase();

    useEffect(() => {
        setFormData({
            name: phase.name,
            phaseCategory: phase.phaseCategory,
            phaseType: phase.phaseType,
            percentOfPrice: phase.percentOfPrice ?? undefined,
            interestRate: phase.interestRate ?? undefined,
            paymentPlanId: phase.paymentPlanId ?? undefined,
            documentationPlanId: phase.documentationPlanId ?? undefined,
            questionnairePlanId: phase.questionnairePlanId ?? undefined,
        });
    }, [phase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updatePhaseMutation.mutateAsync({
                paymentMethodId,
                phaseId: phase.id,
                data: formData,
            });
            toast.success('Phase updated successfully');
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update phase');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Phase</DialogTitle>
                        <DialogDescription>
                            Update phase configuration.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Phase Name *</Label>
                            <Input
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., KYC Verification"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Category *</Label>
                                <Select
                                    value={formData.phaseCategory}
                                    onValueChange={(value: PhaseCategory) =>
                                        setFormData({
                                            ...formData,
                                            phaseCategory: value,
                                            phaseType: PHASE_TYPES[value][0].value,
                                            questionnairePlanId: undefined,
                                            documentationPlanId: undefined,
                                            paymentPlanId: undefined,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PHASE_CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.value} value={cat.value}>
                                                <div className="flex items-center gap-2">
                                                    {cat.icon}
                                                    {cat.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Type *</Label>
                                <Select
                                    value={formData.phaseType}
                                    onValueChange={(value: PhaseType) => setFormData({ ...formData, phaseType: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {formData.phaseCategory && PHASE_TYPES[formData.phaseCategory].map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Category-specific fields */}
                        {formData.phaseCategory === 'QUESTIONNAIRE' && (
                            <div>
                                <Label>Questionnaire Plan</Label>
                                <Select
                                    value={formData.questionnairePlanId || ''}
                                    onValueChange={(value) => setFormData({ ...formData, questionnairePlanId: value || undefined })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select questionnaire plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {questionnairePlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id}>
                                                {plan.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {formData.phaseCategory === 'DOCUMENTATION' && (
                            <div>
                                <Label>Documentation Plan</Label>
                                <Select
                                    value={formData.documentationPlanId || ''}
                                    onValueChange={(value) => setFormData({ ...formData, documentationPlanId: value || undefined })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select documentation plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {documentationPlans.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id}>
                                                {plan.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {formData.phaseCategory === 'PAYMENT' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>% of Price</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={formData.percentOfPrice ?? ''}
                                        onChange={(e) =>
                                            setFormData({ ...formData, percentOfPrice: e.target.value ? parseFloat(e.target.value) : undefined })
                                        }
                                        placeholder="e.g., 10"
                                    />
                                </div>
                                <div>
                                    <Label>Payment Plan</Label>
                                    <Select
                                        value={formData.paymentPlanId || ''}
                                        onValueChange={(value) => setFormData({ ...formData, paymentPlanId: value || undefined })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {paymentPlans.map((plan) => (
                                                <SelectItem key={plan.id} value={plan.id}>
                                                    {plan.name} ({plan.paymentFrequency})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={updatePhaseMutation.isPending}>
                            {updatePhaseMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// Phase Card Component
function PhaseCard({
    phase,
    index,
    totalPhases,
    paymentMethodId,
    paymentPlans,
    questionnairePlans,
    documentationPlans,
    onMoveUp,
    onMoveDown,
}: {
    phase: PaymentMethodPhase;
    index: number;
    totalPhases: number;
    paymentMethodId: string;
    paymentPlans: PaymentPlan[];
    questionnairePlans: QuestionnairePlan[];
    documentationPlans: DocumentationPlan[];
    onMoveUp: () => void;
    onMoveDown: () => void;
}) {
    const [editOpen, setEditOpen] = useState(false);
    const deletePhaseMutation = useDeletePhase();

    const getCategoryIcon = (category: PhaseCategory) => {
        switch (category) {
            case 'QUESTIONNAIRE':
                return <ClipboardList className="h-4 w-4" />;
            case 'DOCUMENTATION':
                return <FileText className="h-4 w-4" />;
            case 'PAYMENT':
                return <CreditCard className="h-4 w-4" />;
        }
    };

    const getCategoryColor = (category: PhaseCategory) => {
        switch (category) {
            case 'QUESTIONNAIRE':
                return 'bg-purple-100 text-purple-800';
            case 'DOCUMENTATION':
                return 'bg-blue-100 text-blue-800';
            case 'PAYMENT':
                return 'bg-green-100 text-green-800';
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${phase.name}"?`)) return;
        try {
            await deletePhaseMutation.mutateAsync({ paymentMethodId, phaseId: phase.id });
            toast.success('Phase deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete phase');
        }
    };

    // Get linked plan name
    const getLinkedPlanName = () => {
        if (phase.phaseCategory === 'QUESTIONNAIRE' && phase.questionnairePlanId) {
            const plan = questionnairePlans.find((p) => p.id === phase.questionnairePlanId);
            return plan ? `📋 ${plan.name}` : null;
        }
        if (phase.phaseCategory === 'DOCUMENTATION' && phase.documentationPlanId) {
            const plan = documentationPlans.find((p) => p.id === phase.documentationPlanId);
            return plan ? `📄 ${plan.name}` : null;
        }
        if (phase.phaseCategory === 'PAYMENT' && phase.paymentPlanId) {
            const plan = paymentPlans.find((p) => p.id === phase.paymentPlanId);
            return plan ? `💳 ${plan.name}` : null;
        }
        return null;
    };

    return (
        <>
            <Card className="p-4">
                <div className="flex items-start gap-3">
                    {/* Reorder controls */}
                    <div className="flex flex-col gap-0.5 pt-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={onMoveUp}
                            title="Move up"
                        >
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <div className="text-center text-xs font-bold text-muted-foreground w-6">
                            {phase.order}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === totalPhases - 1}
                            onClick={onMoveDown}
                            title="Move down"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Main content */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={getCategoryColor(phase.phaseCategory)}>
                                {getCategoryIcon(phase.phaseCategory)}
                                <span className="ml-1">{phase.phaseCategory}</span>
                            </Badge>
                            <Badge variant="secondary">{phase.phaseType}</Badge>
                            {phase.percentOfPrice && (
                                <Badge variant="outline">{phase.percentOfPrice}%</Badge>
                            )}
                        </div>
                        <h4 className="font-medium">{phase.name}</h4>
                        {getLinkedPlanName() && (
                            <p className="text-sm text-muted-foreground mt-1">{getLinkedPlanName()}</p>
                        )}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditOpen(true)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Phase
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={handleDelete}
                                disabled={deletePhaseMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Phase
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </Card>

            <EditPhaseDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                paymentMethodId={paymentMethodId}
                phase={phase}
                paymentPlans={paymentPlans}
                questionnairePlans={questionnairePlans}
                documentationPlans={documentationPlans}
            />
        </>
    );
}

export default function EditPaymentMethodPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const paymentMethodId = resolvedParams.id;

    const { data: method, isLoading, error } = usePaymentMethod(paymentMethodId);
    const { data: paymentPlans = [] } = usePaymentPlans();
    const { data: questionnairePlans = [] } = useQuestionnairePlans();
    const { data: documentationPlans = [] } = useDocumentationPlans();

    const updateMutation = useUpdatePaymentMethod();
    const reorderMutation = useReorderPhases();

    const [addPhaseOpen, setAddPhaseOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        requiresManualApproval: true,
        isActive: true,
    });

    // Initialize form when method loads
    useEffect(() => {
        if (method) {
            setFormData({
                name: method.name,
                description: method.description || '',
                requiresManualApproval: method.requiresManualApproval,
                isActive: method.isActive,
            });
        }
    }, [method]);

    const handleSaveDetails = async () => {
        try {
            await updateMutation.mutateAsync({
                id: paymentMethodId,
                data: {
                    name: formData.name,
                    description: formData.description,
                    requiresManualApproval: formData.requiresManualApproval,
                },
            });
            toast.success('Payment method updated');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update payment method');
        }
    };

    const handleMovePhase = async (fromOrder: number, toOrder: number) => {
        if (!method?.phases) return;

        const sortedPhases = [...method.phases].sort((a, b) => a.order - b.order);
        const fromIndex = sortedPhases.findIndex((p) => p.order === fromOrder);
        const toIndex = sortedPhases.findIndex((p) => p.order === toOrder);

        if (fromIndex === -1 || toIndex === -1) return;

        // Swap the phases
        const newOrder = sortedPhases.map((phase, i) => {
            if (i === fromIndex) return { phaseId: sortedPhases[toIndex].id, order: fromOrder };
            if (i === toIndex) return { phaseId: sortedPhases[fromIndex].id, order: toOrder };
            return { phaseId: phase.id, order: phase.order };
        });

        try {
            await reorderMutation.mutateAsync({
                paymentMethodId,
                phaseOrders: newOrder,
            });
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

    if (error || !method) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Loading Payment Method</CardTitle>
                        <CardDescription>{(error as Error)?.message || 'Payment method not found'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline">
                            <Link href="/admin/payment-methods">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Payment Methods
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const sortedPhases = [...(method.phases || [])].sort((a, b) => a.order - b.order);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button asChild variant="ghost" size="icon">
                        <Link href="/admin/payment-methods">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Edit Payment Method</h1>
                        <p className="text-muted-foreground">{method.name}</p>
                    </div>
                </div>
                <Badge variant={method.isActive ? 'default' : 'secondary'} className="text-sm">
                    {method.isActive ? 'Active' : 'Inactive'}
                </Badge>
            </div>

            {/* Basic Details Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Details</CardTitle>
                    <CardDescription>Update the payment method name and settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 md:col-span-1">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., 10/90 Lekki Mortgage"
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1 flex items-end">
                            <div className="flex items-center gap-4">
                                <Switch
                                    checked={formData.requiresManualApproval}
                                    onCheckedChange={(checked) =>
                                        setFormData({ ...formData, requiresManualApproval: checked })
                                    }
                                />
                                <div>
                                    <Label>Requires Manual Approval</Label>
                                    <p className="text-xs text-muted-foreground">Admin must approve applications</p>
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
                            placeholder="e.g., 10% downpayment + 90% mortgage over 20 years"
                            rows={2}
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveDetails} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Details
                                </>
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
                                Define the customer journey from application to completion
                            </CardDescription>
                        </div>
                        <Button onClick={() => setAddPhaseOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Phase
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {sortedPhases.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-lg font-medium mb-2">No phases defined</p>
                            <p className="text-sm text-muted-foreground mb-4">
                                Add phases to define the customer journey.
                            </p>
                            <Button onClick={() => setAddPhaseOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add First Phase
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sortedPhases.map((phase, index) => (
                                <PhaseCard
                                    key={phase.id}
                                    phase={phase}
                                    index={index}
                                    totalPhases={sortedPhases.length}
                                    paymentMethodId={paymentMethodId}
                                    paymentPlans={paymentPlans}
                                    questionnairePlans={questionnairePlans}
                                    documentationPlans={documentationPlans}
                                    onMoveUp={() => {
                                        if (index > 0) {
                                            handleMovePhase(phase.order, sortedPhases[index - 1].order);
                                        }
                                    }}
                                    onMoveDown={() => {
                                        if (index < sortedPhases.length - 1) {
                                            handleMovePhase(phase.order, sortedPhases[index + 1].order);
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Phase Dialog */}
            <AddPhaseDialog
                open={addPhaseOpen}
                onOpenChange={setAddPhaseOpen}
                paymentMethodId={paymentMethodId}
                currentPhaseCount={sortedPhases.length}
                paymentPlans={paymentPlans}
                questionnairePlans={questionnairePlans}
                documentationPlans={documentationPlans}
            />
        </div>
    );
}

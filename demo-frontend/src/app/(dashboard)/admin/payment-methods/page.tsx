'use client';

import { useState } from 'react';
import {
    usePaymentMethodsList,
    usePaymentPlans,
    useCreatePaymentMethod,
    useDeletePaymentMethod,
    type PaymentMethod,
    type CreatePaymentMethodInput,
    type CreatePaymentMethodPhase,
    type PhaseCategory,
    type PhaseType,
    type PaymentPlan,
} from '@/lib/hooks/use-payment-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ChevronRight, FileText, CreditCard, ClipboardList } from 'lucide-react';
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

function PhaseEditor({
    phases,
    onChange,
    paymentPlans,
}: {
    phases: CreatePaymentMethodPhase[];
    onChange: (phases: CreatePaymentMethodPhase[]) => void;
    paymentPlans: PaymentPlan[];
}) {
    const addPhase = () => {
        const newPhase: CreatePaymentMethodPhase = {
            name: '',
            phaseCategory: 'DOCUMENTATION',
            phaseType: 'KYC',
            order: phases.length + 1,
        };
        onChange([...phases, newPhase]);
    };

    const updatePhase = (index: number, updates: Partial<CreatePaymentMethodPhase>) => {
        const updated = [...phases];
        updated[index] = { ...updated[index], ...updates };
        onChange(updated);
    };

    const removePhase = (index: number) => {
        const updated = phases.filter((_, i) => i !== index);
        // Re-order remaining phases
        updated.forEach((phase, i) => (phase.order = i + 1));
        onChange(updated);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label>Phases</Label>
                <Button type="button" variant="outline" size="sm" onClick={addPhase}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Phase
                </Button>
            </div>

            {phases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                    No phases added. Add phases to define the customer journey.
                </p>
            ) : (
                <div className="space-y-3">
                    {phases.map((phase, index) => (
                        <Card key={index} className="p-4">
                            <div className="flex items-start gap-4">
                                <div className="flex-1 grid gap-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs">Phase Name *</Label>
                                            <Input
                                                value={phase.name}
                                                onChange={(e) => updatePhase(index, { name: e.target.value })}
                                                placeholder="e.g., KYC Verification"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Order</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={phase.order ?? ''}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    const parsed = v === '' ? 1 : parseInt(v, 10);
                                                    updatePhase(index, { order: Number.isNaN(parsed) ? 1 : parsed });
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs">Category *</Label>
                                            <Select
                                                value={phase.phaseCategory}
                                                onValueChange={(value: PhaseCategory) =>
                                                    updatePhase(index, {
                                                        phaseCategory: value,
                                                        phaseType: PHASE_TYPES[value][0].value,
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
                                            <Label className="text-xs">Type *</Label>
                                            <Select
                                                value={phase.phaseType}
                                                onValueChange={(value: PhaseType) => updatePhase(index, { phaseType: value })}
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
                                    {phase.phaseCategory === 'PAYMENT' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-xs">% of Price</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={phase.percentOfPrice ?? ''}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        updatePhase(index, { percentOfPrice: v === '' ? undefined : parseFloat(v) });
                                                    }}
                                                    placeholder="e.g., 10"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Payment Plan</Label>
                                                <Select
                                                    value={phase.paymentPlanId || ''}
                                                    onValueChange={(value) => updatePhase(index, { paymentPlanId: value === '' ? undefined : value })}
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
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removePhase(index)}
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

function CreatePaymentMethodDialog() {
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState<CreatePaymentMethodInput>({
        name: '',
        description: '',
        requiresManualApproval: true,
        phases: [],
    });

    const createMutation = useCreatePaymentMethod();
    const { data: paymentPlans = [] } = usePaymentPlans();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.phases || formData.phases.length === 0) {
            toast.error('Please add at least one phase');
            return;
        }

        try {
            await createMutation.mutateAsync(formData);
            toast.success('Payment method created successfully');
            setOpen(false);
            setFormData({
                name: '',
                description: '',
                requiresManualApproval: true,
                phases: [],
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to create payment method');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Payment Method
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create Payment Method</DialogTitle>
                        <DialogDescription>
                            Define the customer journey from application to completion.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., 10/90 Lekki Mortgage"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="e.g., 10% downpayment + 90% mortgage over 20 years"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Requires Manual Approval</Label>
                                <p className="text-sm text-muted-foreground">
                                    Admin must approve applications before processing
                                </p>
                            </div>
                            <Switch
                                checked={formData.requiresManualApproval}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, requiresManualApproval: checked })
                                }
                            />
                        </div>

                        <hr className="my-2" />

                        <PhaseEditor
                            phases={formData.phases || []}
                            onChange={(phases) => setFormData({ ...formData, phases })}
                            paymentPlans={paymentPlans}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Creating...' : 'Create Method'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PaymentMethodCard({ method }: { method: PaymentMethod }) {
    const deleteMutation = useDeletePaymentMethod();

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${method.name}"?`)) return;
        try {
            await deleteMutation.mutateAsync(method.id);
            toast.success('Payment method deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete payment method');
        }
    };

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

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">{method.name}</CardTitle>
                        <CardDescription>{method.description || 'No description'}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={method.isActive ? 'default' : 'secondary'}>
                            {method.isActive ? 'Active' : 'Inactive'}
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
                <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        {method.phases?.length || 0} Phases
                    </p>
                    <div className="flex items-center flex-wrap gap-2">
                        {method.phases
                            ?.sort((a, b) => a.order - b.order)
                            .map((phase, index) => (
                                <div key={phase.id} className="flex items-center">
                                    <Badge
                                        variant="outline"
                                        className={`flex items-center gap-1 ${getCategoryColor(phase.phaseCategory)}`}
                                    >
                                        {getCategoryIcon(phase.phaseCategory)}
                                        {phase.name}
                                        {phase.percentOfPrice && ` (${phase.percentOfPrice}%)`}
                                    </Badge>
                                    {index < method.phases.length - 1 && (
                                        <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
                                    )}
                                </div>
                            ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function PaymentMethodsPage() {
    const { data: methods, isLoading, error } = usePaymentMethodsList();

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Loading Payment Methods</CardTitle>
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
                    <h1 className="text-3xl font-bold">Payment Methods</h1>
                    <p className="text-muted-foreground">
                        Configure customer journeys for property purchases
                    </p>
                </div>
                <CreatePaymentMethodDialog />
            </div>

            {isLoading ? (
                <div className="grid gap-4">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            ) : methods && methods.length > 0 ? (
                <div className="grid gap-4">
                    {methods.map((method) => (
                        <PaymentMethodCard key={method.id} method={method} />
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="text-center py-12">
                        <p className="text-muted-foreground">
                            No payment methods found. Create one to define customer journeys.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Quick Reference */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Reference</CardTitle>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible>
                        <AccordionItem value="example-mortgage">
                            <AccordionTrigger>Example: 10/90 Mortgage</AccordionTrigger>
                            <AccordionContent>
                                <ol className="list-decimal list-inside space-y-2 text-sm">
                                    <li>
                                        <strong>KYC Verification</strong> (DOCUMENTATION → KYC)
                                        <br />
                                        <span className="text-muted-foreground ml-5">
                                            Customer uploads ID, bank statements, employment letter
                                        </span>
                                    </li>
                                    <li>
                                        <strong>10% Downpayment</strong> (PAYMENT → DOWNPAYMENT, 10%)
                                        <br />
                                        <span className="text-muted-foreground ml-5">
                                            One-time payment of 10% of property price
                                        </span>
                                    </li>
                                    <li>
                                        <strong>Final Documentation</strong> (DOCUMENTATION → VERIFICATION)
                                        <br />
                                        <span className="text-muted-foreground ml-5">
                                            Admin uploads final offer, customer signs
                                        </span>
                                    </li>
                                    <li>
                                        <strong>20-Year Mortgage</strong> (PAYMENT → MORTGAGE, 90%)
                                        <br />
                                        <span className="text-muted-foreground ml-5">
                                            240 monthly installments at 9.5% p.a.
                                        </span>
                                    </li>
                                </ol>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="example-installment">
                            <AccordionTrigger>Example: Outright Purchase</AccordionTrigger>
                            <AccordionContent>
                                <ol className="list-decimal list-inside space-y-2 text-sm">
                                    <li>
                                        <strong>KYC Verification</strong> (DOCUMENTATION → KYC)
                                        <br />
                                        <span className="text-muted-foreground ml-5">
                                            Basic identity verification
                                        </span>
                                    </li>
                                    <li>
                                        <strong>Full Payment</strong> (PAYMENT → DOWNPAYMENT, 100%)
                                        <br />
                                        <span className="text-muted-foreground ml-5">
                                            One-time payment of full property price
                                        </span>
                                    </li>
                                </ol>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}

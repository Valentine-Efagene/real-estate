'use client';

import { useState } from 'react';
import {
    usePaymentPlans,
    useCreatePaymentPlan,
    useDeletePaymentPlan,
    type PaymentPlan,
    type CreatePaymentPlanInput,
    type PaymentFrequency,
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const FREQUENCY_OPTIONS: { value: PaymentFrequency; label: string }[] = [
    { value: 'ONE_TIME', label: 'One-Time' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'BIWEEKLY', label: 'Bi-Weekly' },
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'CUSTOM', label: 'Custom' },
];

function CreatePaymentPlanDialog() {
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState<CreatePaymentPlanInput>({
        name: '',
        description: '',
        paymentFrequency: 'MONTHLY',
        numberOfInstallments: 1,
        interestRate: 0,
        gracePeriodDays: 0,
        collectFunds: true,
        allowFlexibleTerm: false,
    });

    const createMutation = useCreatePaymentPlan();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createMutation.mutateAsync(formData);
            toast.success('Payment plan created successfully');
            setOpen(false);
            setFormData({
                name: '',
                description: '',
                paymentFrequency: 'MONTHLY',
                numberOfInstallments: 1,
                interestRate: 0,
                gracePeriodDays: 0,
                collectFunds: true,
                allowFlexibleTerm: false,
            });
        } catch (error: any) {
            toast.error(error.message || 'Failed to create payment plan');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Payment Plan
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create Payment Plan</DialogTitle>
                        <DialogDescription>
                            Define how payments are structured (frequency, installments, interest).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Monthly 240 (20 years)"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="e.g., 20-year mortgage monthly payments"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="frequency">Payment Frequency *</Label>
                                <Select
                                    value={formData.paymentFrequency}
                                    onValueChange={(value: PaymentFrequency) =>
                                        setFormData({ ...formData, paymentFrequency: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FREQUENCY_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="installments">Number of Installments</Label>
                                <Input
                                    id="installments"
                                    type="number"
                                    min="1"
                                    value={formData.numberOfInstallments ?? ''}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        const parsed = v === '' ? 1 : parseInt(v, 10);
                                        setFormData({ ...formData, numberOfInstallments: Number.isNaN(parsed) ? 1 : parsed });
                                    }}
                                    placeholder="e.g., 240"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="interestRate">Interest Rate (%)</Label>
                                <Input
                                    id="interestRate"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={formData.interestRate ?? ''}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        const parsed = v === '' ? 0 : parseFloat(v);
                                        setFormData({ ...formData, interestRate: Number.isNaN(parsed) ? 0 : parsed });
                                    }}
                                    placeholder="e.g., 9.5"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="gracePeriod">Grace Period (days)</Label>
                                <Input
                                    id="gracePeriod"
                                    type="number"
                                    min="0"
                                    value={formData.gracePeriodDays ?? ''}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        const parsed = v === '' ? 0 : parseInt(v, 10);
                                        setFormData({ ...formData, gracePeriodDays: Number.isNaN(parsed) ? 0 : parsed });
                                    }}
                                    placeholder="e.g., 5"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Collect Funds</Label>
                                <p className="text-sm text-muted-foreground">
                                    We collect funds via wallet/gateway
                                </p>
                            </div>
                            <Switch
                                checked={formData.collectFunds}
                                onCheckedChange={(checked) => setFormData({ ...formData, collectFunds: checked })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Flexible Term</Label>
                                <p className="text-sm text-muted-foreground">
                                    User can select term within range
                                </p>
                            </div>
                            <Switch
                                checked={formData.allowFlexibleTerm}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, allowFlexibleTerm: checked })
                                }
                            />
                        </div>
                        {formData.allowFlexibleTerm && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="minTerm">Min Term (months)</Label>
                                    <Input
                                        id="minTerm"
                                        type="number"
                                        min="1"
                                        value={formData.minTermMonths ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setFormData({ ...formData, minTermMonths: v === '' ? undefined : parseInt(v, 10) });
                                        }}
                                        placeholder="60"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="maxTerm">Max Term (months)</Label>
                                    <Input
                                        id="maxTerm"
                                        type="number"
                                        min="1"
                                        value={formData.maxTermMonths ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setFormData({ ...formData, maxTermMonths: v === '' ? undefined : parseInt(v, 10) });
                                        }}
                                        placeholder="360"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="termStep">Step (months)</Label>
                                    <Input
                                        id="termStep"
                                        type="number"
                                        min="1"
                                        value={formData.termStepMonths ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setFormData({ ...formData, termStepMonths: v === '' ? undefined : parseInt(v, 10) });
                                        }}
                                        placeholder="12"
                                    />
                                </div>
                            </div>
                        )}
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

function PaymentPlanRow({ plan }: { plan: PaymentPlan }) {
    const deleteMutation = useDeletePaymentPlan();

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${plan.name}"?`)) return;
        try {
            await deleteMutation.mutateAsync(plan.id);
            toast.success('Payment plan deleted');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete payment plan');
        }
    };

    return (
        <TableRow>
            <TableCell className="font-medium">{plan.name}</TableCell>
            <TableCell>{plan.description || '-'}</TableCell>
            <TableCell>
                <Badge variant="outline">{plan.paymentFrequency}</Badge>
            </TableCell>
            <TableCell>{plan.numberOfInstallments}</TableCell>
            <TableCell>{plan.interestRate ? `${plan.interestRate}%` : '-'}</TableCell>
            <TableCell>
                <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                </Badge>
            </TableCell>
            <TableCell>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                >
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </TableCell>
        </TableRow>
    );
}

export default function PaymentPlansPage() {
    const { data: plans, isLoading, error } = usePaymentPlans();

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error Loading Payment Plans</CardTitle>
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
                    <h1 className="text-3xl font-bold">Payment Plans</h1>
                    <p className="text-muted-foreground">
                        Configure payment structures for mortgages and installments
                    </p>
                </div>
                <CreatePaymentPlanDialog />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Payment Plans</CardTitle>
                    <CardDescription>
                        Payment plans define frequency, installments, and interest rates
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : plans && plans.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Frequency</TableHead>
                                    <TableHead>Installments</TableHead>
                                    <TableHead>Interest</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {plans.map((plan) => (
                                    <PaymentPlanRow key={plan.id} plan={plan} />
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No payment plans found. Create one to get started.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Reference */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Reference</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">Common Payment Plans:</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            <li>
                                <strong>One-Time Downpayment:</strong> ONE_TIME frequency, 1 installment, no interest
                            </li>
                            <li>
                                <strong>12-Month Installment:</strong> MONTHLY frequency, 12 installments, 0% interest
                            </li>
                            <li>
                                <strong>20-Year Mortgage:</strong> MONTHLY frequency, 240 installments, 9.5% interest, flexible term
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

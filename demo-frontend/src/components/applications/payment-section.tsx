'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
    useGenerateInstallments,
    useCreatePayment,
    useProcessPayment,
    type Installment
} from '@/lib/hooks';

interface PaymentSectionProps {
    applicationId: string;
    phaseId: string;
    phaseName: string;
    totalAmount: number;
    paidAmount: number;
    currency?: string;
    installments: Installment[];
    onPaymentSuccess?: () => void;
}

function formatCurrency(amount: number, currency: string = 'NGN') {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
    }).format(amount);
}

export function PaymentSection({
    applicationId,
    phaseId,
    phaseName,
    totalAmount,
    paidAmount,
    currency = 'NGN',
    installments,
    onPaymentSuccess,
}: PaymentSectionProps) {
    const generateInstallments = useGenerateInstallments();
    const createPayment = useCreatePayment();
    const processPayment = useProcessPayment();

    const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER');
    const [externalReference, setExternalReference] = useState('');
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [pendingPaymentRef, setPendingPaymentRef] = useState<string | null>(null);

    const pendingInstallments = installments.filter(
        (i) => i.status === 'PENDING' || i.status === 'DUE' || i.status === 'OVERDUE'
    );

    const handleGenerateInstallments = useCallback(async () => {
        try {
            await generateInstallments.mutateAsync({
                applicationId,
                phaseId,
            });
            toast.success('Installments generated successfully');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to generate installments');
        }
    }, [applicationId, phaseId, generateInstallments]);

    const handleInitiatePayment = useCallback(async () => {
        if (!selectedInstallment) {
            toast.error('Please select an installment to pay');
            return;
        }

        try {
            const result = await createPayment.mutateAsync({
                applicationId,
                phaseId,
                installmentId: selectedInstallment.id,
                amount: selectedInstallment.amount,
                paymentMethod: paymentMethod as 'BANK_TRANSFER' | 'CARD' | 'USSD' | 'WALLET',
                externalReference: externalReference || undefined,
            });

            setPendingPaymentRef(result.reference);
            toast.success('Payment initiated. Please complete the payment and confirm.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to initiate payment');
        }
    }, [applicationId, phaseId, selectedInstallment, paymentMethod, externalReference, createPayment]);

    const handleConfirmPayment = useCallback(async () => {
        if (!pendingPaymentRef) {
            toast.error('No pending payment to confirm');
            return;
        }

        try {
            await processPayment.mutateAsync({
                reference: pendingPaymentRef,
                status: 'COMPLETED',
                gatewayTransactionId: `DEMO-${Date.now()}`,
            });

            toast.success('Payment confirmed successfully!');
            setShowPaymentDialog(false);
            setSelectedInstallment(null);
            setPendingPaymentRef(null);
            setExternalReference('');
            onPaymentSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to confirm payment');
        }
    }, [pendingPaymentRef, processPayment, onPaymentSuccess]);

    const remainingAmount = totalAmount - paidAmount;
    const progressPercent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{phaseName}</CardTitle>
                <CardDescription>
                    Complete the required payment to proceed with your application
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Payment Progress */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Payment Progress</span>
                        <span className="font-medium">{progressPercent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className="bg-primary h-2.5 rounded-full transition-all"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                            Paid: {formatCurrency(paidAmount, currency)}
                        </span>
                        <span className="font-medium">
                            Remaining: {formatCurrency(remainingAmount, currency)}
                        </span>
                    </div>
                </div>

                {/* Installments List */}
                {installments.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-gray-500 mb-4">No installments generated yet.</p>
                        <Button
                            onClick={handleGenerateInstallments}
                            disabled={generateInstallments.isPending}
                        >
                            {generateInstallments.isPending ? 'Generating...' : 'Generate Installments'}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <h4 className="font-semibold">Installments</h4>
                        {installments.map((installment, index) => (
                            <div
                                key={installment.id}
                                className={`flex items-center justify-between p-4 border rounded-lg ${installment.status === 'PAID' ? 'bg-green-50 border-green-200' :
                                        installment.status === 'OVERDUE' ? 'bg-red-50 border-red-200' : ''
                                    }`}
                            >
                                <div>
                                    <p className="font-medium">
                                        Installment {index + 1}: {formatCurrency(installment.amount, currency)}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Due: {new Date(installment.dueDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge
                                        variant={
                                            installment.status === 'PAID' ? 'default' :
                                                installment.status === 'OVERDUE' ? 'destructive' : 'outline'
                                        }
                                    >
                                        {installment.status}
                                    </Badge>
                                    {(installment.status === 'PENDING' || installment.status === 'DUE' || installment.status === 'OVERDUE') && (
                                        <Dialog open={showPaymentDialog && selectedInstallment?.id === installment.id} onOpenChange={(open) => {
                                            setShowPaymentDialog(open);
                                            if (open) {
                                                setSelectedInstallment(installment);
                                            } else {
                                                setSelectedInstallment(null);
                                                setPendingPaymentRef(null);
                                            }
                                        }}>
                                            <DialogTrigger asChild>
                                                <Button size="sm">Pay Now</Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Make Payment</DialogTitle>
                                                    <DialogDescription>
                                                        Pay {formatCurrency(installment.amount, currency)} for installment {index + 1}
                                                    </DialogDescription>
                                                </DialogHeader>

                                                {!pendingPaymentRef ? (
                                                    <>
                                                        <div className="space-y-4 py-4">
                                                            <div className="space-y-2">
                                                                <Label>Payment Method</Label>
                                                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                                                        <SelectItem value="CARD">Card Payment</SelectItem>
                                                                        <SelectItem value="USSD">USSD</SelectItem>
                                                                        <SelectItem value="WALLET">Wallet</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label htmlFor="reference">Reference (Optional)</Label>
                                                                <Input
                                                                    id="reference"
                                                                    placeholder="Transaction reference..."
                                                                    value={externalReference}
                                                                    onChange={(e) => setExternalReference(e.target.value)}
                                                                />
                                                            </div>

                                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-500">Amount:</span>
                                                                    <span className="font-bold">{formatCurrency(installment.amount, currency)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <DialogFooter>
                                                            <Button
                                                                onClick={handleInitiatePayment}
                                                                disabled={createPayment.isPending}
                                                                className="w-full"
                                                            >
                                                                {createPayment.isPending ? 'Processing...' : 'Initiate Payment'}
                                                            </Button>
                                                        </DialogFooter>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="space-y-4 py-4">
                                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                                <p className="font-medium text-yellow-800">Payment Initiated</p>
                                                                <p className="text-sm text-yellow-700 mt-1">
                                                                    Reference: {pendingPaymentRef}
                                                                </p>
                                                                <p className="text-sm text-yellow-700 mt-2">
                                                                    Please complete the payment using your selected method, then click &quot;Confirm Payment&quot; below.
                                                                </p>
                                                            </div>

                                                            <div className="p-4 bg-gray-50 rounded-lg text-center">
                                                                <p className="text-2xl font-bold">{formatCurrency(installment.amount, currency)}</p>
                                                                <p className="text-sm text-gray-500 mt-1">Amount to pay</p>
                                                            </div>
                                                        </div>

                                                        <DialogFooter className="flex gap-2">
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => setPendingPaymentRef(null)}
                                                            >
                                                                Cancel
                                                            </Button>
                                                            <Button
                                                                onClick={handleConfirmPayment}
                                                                disabled={processPayment.isPending}
                                                            >
                                                                {processPayment.isPending ? 'Confirming...' : 'Confirm Payment'}
                                                            </Button>
                                                        </DialogFooter>
                                                    </>
                                                )}
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Quick Pay All Pending */}
                {pendingInstallments.length > 1 && (
                    <div className="pt-4 border-t">
                        <p className="text-sm text-gray-500 mb-2">
                            You have {pendingInstallments.length} pending installments totaling{' '}
                            {formatCurrency(
                                pendingInstallments.reduce((sum, i) => sum + i.amount, 0),
                                currency
                            )}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
    useGenerateInstallments,
    type Installment
} from '@/lib/hooks';
import { useWallet, useCreateWallet, useCreditWallet } from '@/lib/hooks/use-wallet';

interface PaymentSectionProps {
    applicationId: string;
    phaseId: string;
    phaseName: string;
    totalAmount: number;
    paidAmount: number;
    currency?: string;
    installments: Installment[];
    buyerEmail?: string;
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
    const { data: wallet, isLoading: walletLoading, error: walletError } = useWallet();
    const createWallet = useCreateWallet();
    const creditWallet = useCreditWallet();

    const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [creditAmount, setCreditAmount] = useState('');

    const pendingInstallments = installments.filter(
        (i) => i.status === 'PENDING' || i.status === 'DUE' || i.status === 'OVERDUE'
    );

    // Auto-set credit amount when installment is selected
    useEffect(() => {
        if (selectedInstallment) {
            setCreditAmount(String(selectedInstallment.amount));
        }
    }, [selectedInstallment]);

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

    const handleCreateWallet = useCallback(async () => {
        try {
            await createWallet.mutateAsync({ currency });
            toast.success('Wallet created successfully');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create wallet');
        }
    }, [currency, createWallet]);

    const handleCreditWallet = useCallback(async () => {
        if (!wallet) {
            toast.error('No wallet found. Please create a wallet first.');
            return;
        }
        if (!selectedInstallment) {
            toast.error('Please select an installment to pay');
            return;
        }

        const amount = parseFloat(creditAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        try {
            await creditWallet.mutateAsync({
                walletId: wallet.id,
                amount,
                reference: `PAY-${applicationId.slice(0, 8)}-${Date.now()}`,
                description: `Payment for ${phaseName} installment`,
                source: 'BANK_TRANSFER',
            });

            toast.success(
                'Wallet credited! Funds will be auto-allocated to pending installments.'
            );
            setShowPaymentDialog(false);
            setSelectedInstallment(null);
            setCreditAmount('');
            onPaymentSuccess?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to credit wallet');
        }
    }, [wallet, selectedInstallment, creditAmount, applicationId, phaseName, creditWallet, onPaymentSuccess]);

    const remainingAmount = totalAmount - paidAmount;
    const progressPercent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
    const hasWallet = !!wallet && !walletError;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{phaseName}</CardTitle>
                <CardDescription>
                    Complete the required payment to proceed with your application
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Wallet Status */}
                <div className="p-4 rounded-lg border bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Wallet</p>
                            {walletLoading ? (
                                <p className="text-sm text-gray-500">Loading...</p>
                            ) : hasWallet ? (
                                <p className="text-sm text-gray-500">
                                    Balance: <span className="font-semibold text-gray-900">{formatCurrency(wallet.balance, currency)}</span>
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">No wallet yet</p>
                            )}
                        </div>
                        {!hasWallet && !walletLoading && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCreateWallet}
                                disabled={createWallet.isPending}
                            >
                                {createWallet.isPending ? 'Creating...' : 'Create Wallet'}
                            </Button>
                        )}
                    </div>
                </div>

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
                                            }
                                        }}>
                                            <DialogTrigger asChild>
                                                <Button size="sm" disabled={!hasWallet}>
                                                    {hasWallet ? 'Pay Now' : 'Create wallet first'}
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Fund Wallet & Pay</DialogTitle>
                                                    <DialogDescription>
                                                        Credit your wallet to pay {formatCurrency(installment.amount, currency)} for installment {index + 1}.
                                                        Funds are auto-allocated to pending installments.
                                                    </DialogDescription>
                                                </DialogHeader>

                                                <div className="space-y-4 py-4">
                                                    {wallet && (
                                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                            <p className="text-sm text-blue-800">
                                                                Current wallet balance: <span className="font-semibold">{formatCurrency(wallet.balance, currency)}</span>
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="space-y-2">
                                                        <Label htmlFor="creditAmount">Amount to Credit</Label>
                                                        <Input
                                                            id="creditAmount"
                                                            type="number"
                                                            placeholder="Enter amount..."
                                                            value={creditAmount}
                                                            onChange={(e) => setCreditAmount(e.target.value)}
                                                        />
                                                        <p className="text-xs text-gray-500">
                                                            Funds credited to your wallet will be automatically allocated to pending installments.
                                                        </p>
                                                    </div>

                                                    <div className="p-4 bg-gray-50 rounded-lg">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Installment amount:</span>
                                                            <span className="font-bold">{formatCurrency(installment.amount, currency)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <DialogFooter>
                                                    <Button
                                                        onClick={handleCreditWallet}
                                                        disabled={creditWallet.isPending}
                                                        className="w-full"
                                                    >
                                                        {creditWallet.isPending ? 'Processing...' : `Credit ${creditAmount ? formatCurrency(parseFloat(creditAmount) || 0, currency) : 'Wallet'}`}
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Quick Pay All Pending */}
                {pendingInstallments.length > 1 && hasWallet && (
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

'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet, useCreateWallet, useTransactions, TransactionType, TransactionStatus, type Transaction } from '@/lib/hooks/use-wallet';
import { toast } from 'sonner';
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';

function formatCurrency(amount: number, currency: string = 'NGN') {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
    }).format(amount);
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
    const isCredit = transaction.type === TransactionType.CREDIT;

    return (
        <div className="flex items-center justify-between p-4 border-b last:border-b-0">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isCredit ? 'bg-green-100' : 'bg-red-100'}`}>
                    {isCredit ? (
                        <ArrowDownCircle className="h-5 w-5 text-green-600" />
                    ) : (
                        <ArrowUpCircle className="h-5 w-5 text-red-600" />
                    )}
                </div>
                <div>
                    <p className="font-medium text-sm">
                        {transaction.description || (isCredit ? 'Wallet Credit' : 'Payment Debit')}
                    </p>
                    <p className="text-xs text-gray-500">
                        {new Date(transaction.createdAt).toLocaleString()}
                    </p>
                    {transaction.reference && (
                        <p className="text-xs text-gray-400 font-mono">{transaction.reference}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Badge
                    variant={
                        transaction.status === TransactionStatus.COMPLETED
                            ? 'default'
                            : transaction.status === TransactionStatus.PENDING
                                ? 'secondary'
                                : 'destructive'
                    }
                >
                    {transaction.status}
                </Badge>
                <span className={`font-semibold tabular-nums ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                    {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
                </span>
            </div>
        </div>
    );
}

function TransactionsContent() {
    const [page, setPage] = useState(1);
    const limit = 20;
    const { data: wallet, isLoading: walletLoading, error: walletError } = useWallet();
    const createWallet = useCreateWallet();
    const { data: txData, isLoading: txLoading } = useTransactions({ page, limit });

    const hasWallet = !!wallet && !walletError;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Wallet & Transactions</h1>
                <p className="text-gray-500 mt-1">Manage your wallet and view payment history</p>
            </div>

            {/* Wallet Summary */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-full">
                                <Wallet className="h-8 w-8 text-primary" />
                            </div>
                            {walletLoading ? (
                                <Skeleton className="h-12 w-48" />
                            ) : hasWallet ? (
                                <div>
                                    <p className="text-sm text-gray-500">Wallet Balance</p>
                                    <p className="text-3xl font-bold">{formatCurrency(wallet.balance, wallet.currency)}</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm text-gray-500">No wallet yet</p>
                                    <p className="text-xs text-gray-400">Create a wallet to start making payments</p>
                                </div>
                            )}
                        </div>
                        {!hasWallet && !walletLoading && (
                            <Button
                                onClick={async () => {
                                    try {
                                        await createWallet.mutateAsync({ currency: 'NGN' });
                                        toast.success('Wallet created successfully');
                                    } catch (error) {
                                        toast.error(error instanceof Error ? error.message : 'Failed to create wallet');
                                    }
                                }}
                                disabled={createWallet.isPending}
                            >
                                {createWallet.isPending ? 'Creating...' : 'Create Wallet'}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Transactions List */}
            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>
                        {txData ? `${txData.total} total transactions` : 'Loading...'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {txLoading ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-16" />
                            ))}
                        </div>
                    ) : txData && txData.data.length > 0 ? (
                        <>
                            <div className="border rounded-lg">
                                {txData.data.map((tx) => (
                                    <TransactionRow key={tx.id} transaction={tx} />
                                ))}
                            </div>

                            {/* Pagination */}
                            {txData.totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-sm text-gray-500">
                                        Page {txData.page} of {txData.totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page <= 1}
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page >= txData.totalPages}
                                            onClick={() => setPage(p => p + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p className="font-medium">No transactions yet</p>
                            <p className="text-sm mt-1">
                                {hasWallet
                                    ? 'Transactions will appear here when you fund your wallet or make payments.'
                                    : 'Create a wallet first, then fund it to start making payments.'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function CustomerTransactionsPage() {
    return (
        <ProtectedRoute>
            <TransactionsContent />
        </ProtectedRoute>
    );
}

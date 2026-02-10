'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { paymentApi } from '@/lib/api/client';

// ============================================================================
// Wallet & Transaction Enums (mirrors Prisma enums from schema)
// ============================================================================

export const TransactionType = {
    CREDIT: 'CREDIT',
    DEBIT: 'DEBIT',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

// ============================================================================
// Wallet Types
// ============================================================================

export interface WalletUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
}

export interface Wallet {
    id: string;
    tenantId: string;
    currency: string;
    balance: number;
    user?: WalletUser;
    createdAt: string;
    updatedAt: string;
}

export interface CreditWalletInput {
    walletId: string;
    amount: number;
    reference: string;
    description?: string;
    source?: string;
}

export interface Transaction {
    id: string;
    walletId: string;
    tenantId: string;
    amount: number;
    type: TransactionType;
    status: TransactionStatus;
    reference: string | null;
    description: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TransactionsResponse {
    data: Transaction[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ============================================================================
// Wallet Hooks
// ============================================================================

/**
 * Get the current user's wallet
 * Calls: GET /wallets/me via payment-service
 */
export function useWallet() {
    return useQuery({
        queryKey: queryKeys.wallets.me,
        queryFn: async () => {
            const response = await paymentApi.get<Wallet>('/wallets/me');
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch wallet');
            }
            return response.data!;
        },
        retry: false,
    });
}

/**
 * Get a specific user's wallet (for admin views)
 * Calls: GET /wallets/user/:userId via payment-service
 */
export function useUserWallet(userId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.wallets.detail(userId || ''),
        queryFn: async () => {
            const response = await paymentApi.get<Wallet>(`/wallets/user/${userId}`);
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch user wallet');
            }
            return response.data!;
        },
        enabled: !!userId,
        retry: false,
    });
}

/**
 * Create a wallet for the current user
 * Calls: POST /wallets/me via payment-service
 */
export function useCreateWallet() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ currency = 'NGN' }: { currency?: string } = {}) => {
            const response = await paymentApi.post<Wallet>('/wallets/me', { currency });
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create wallet');
            }
            return response.data!;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.wallets.me });
        },
    });
}

/**
 * Create a wallet for a specific user (admin operation)
 * Calls: POST /wallets/user/:userId via payment-service
 */
export function useCreateUserWallet() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, currency = 'NGN' }: { userId: string; currency?: string }) => {
            const response = await paymentApi.post<Wallet>(`/wallets/user/${userId}`, { currency });
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to create wallet');
            }
            return response.data!;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.wallets.detail(variables.userId) });
        },
    });
}

/**
 * Credit (fund) a wallet — used for simulating payments in demo
 * Calls: POST /wallets/:id/credit via payment-service
 *
 * In the real flow:
 * 1. Customer creates wallet (POST /wallets/me)
 * 2. Installments are generated (POST /applications/:id/phases/:phaseId/installments)
 * 3. Wallet is credited (POST /wallets/:id/credit) — simulates bank transfer / card payment
 * 4. payment-service auto-allocates funds to pending installments
 * 5. When fully paid, payment-service publishes PAYMENT_PHASE_COMPLETED event
 * 6. mortgage-service receives event and activates next phase
 */
export function useCreditWallet() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            walletId,
            amount,
            reference,
            description,
            source = 'BANK_TRANSFER',
        }: CreditWalletInput) => {
            const response = await paymentApi.post(`/wallets/${walletId}/credit`, {
                amount,
                reference,
                description,
                source,
            });
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to credit wallet');
            }
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.wallets.me });
            queryClient.invalidateQueries({ queryKey: ['wallets', 'detail'] });
            // Wallet credit triggers auto-allocation which pays installments,
            // so invalidate application & payment queries too
            queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
            queryClient.invalidateQueries({ queryKey: ['wallets', 'transactions'] });
        },
    });
}

/**
 * Get the current user's transaction history
 * Calls: GET /wallets/me/transactions via payment-service
 */
export function useTransactions(filters?: { page?: number; limit?: number }) {
    const limit = filters?.limit ?? 20;
    const page = filters?.page ?? 1;
    const offset = (page - 1) * limit;

    return useQuery({
        queryKey: queryKeys.wallets.transactions({ page, limit }),
        queryFn: async () => {
            const response = await paymentApi.get<TransactionsResponse>(
                `/wallets/me/transactions?limit=${limit}&offset=${offset}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch transactions');
            }
            return response.data!;
        },
    });
}

/**
 * Get transactions for a specific wallet (admin view)
 * Calls: GET /wallets/:id/transactions via payment-service
 */
export function useWalletTransactions(walletId: string | undefined, filters?: { page?: number; limit?: number }) {
    const limit = filters?.limit ?? 20;
    const page = filters?.page ?? 1;
    const offset = (page - 1) * limit;

    return useQuery({
        queryKey: ['wallets', 'transactions', walletId, { page, limit }] as const,
        queryFn: async () => {
            const response = await paymentApi.get<TransactionsResponse>(
                `/wallets/${walletId}/transactions?limit=${limit}&offset=${offset}`
            );
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to fetch transactions');
            }
            return response.data!;
        },
        enabled: !!walletId,
    });
}

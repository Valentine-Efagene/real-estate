'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { paymentApi } from '@/lib/api/client';

// ============================================================================
// Wallet Types
// ============================================================================

export interface Wallet {
    id: string;
    userId: string;
    tenantId: string;
    currency: string;
    balance: number;
    status: string;
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
            // Wallet credit triggers auto-allocation which pays installments,
            // so invalidate application & payment queries too
            queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
        },
    });
}

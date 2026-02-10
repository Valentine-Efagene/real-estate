// =============================================================================
// Payment Client
// =============================================================================
// HTTP client for mortgage service to communicate with payment service
// This is used for wallet operations like crediting, debiting, checking balance
// =============================================================================

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002';

interface WalletResponse {
    id: string;
    balance: number;
    currency: string;
    userId?: string;
}

interface TransactionResponse {
    id: string;
    walletId: string;
    amount: number;
    type: 'CREDIT' | 'DEBIT';
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    reference: string;
    description?: string;
    createdAt: string;
}

interface CreditDebitResponse {
    wallet: WalletResponse;
    transaction: TransactionResponse;
}

interface ApiResponse<T> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
}

class PaymentClient {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || PAYMENT_SERVICE_URL;
    }

    /**
     * Get wallet by ID
     */
    async getWallet(walletId: string): Promise<WalletResponse> {
        const response = await fetch(`${this.baseUrl}/wallets/${walletId}`);
        const json = await response.json() as ApiResponse<WalletResponse>;

        if (!response.ok || json.status === 'error') {
            throw new Error(json.message || 'Failed to get wallet');
        }

        return json.data!;
    }

    /**
     * Get wallet by user ID
     */
    async getWalletByUserId(userId: string): Promise<WalletResponse> {
        const response = await fetch(`${this.baseUrl}/wallets/user/${userId}`);
        const json = await response.json() as ApiResponse<WalletResponse>;

        if (!response.ok || json.status === 'error') {
            throw new Error(json.message || 'Failed to get wallet for user');
        }

        return json.data!;
    }

    /**
     * Create wallet for a user
     */
    async createWallet(userId: string, currency: string = 'NGN'): Promise<WalletResponse> {
        const response = await fetch(`${this.baseUrl}/wallets/user/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currency }),
        });

        const json = await response.json() as ApiResponse<WalletResponse>;

        if (!response.ok || json.status === 'error') {
            throw new Error(json.message || 'Failed to create wallet');
        }

        return json.data!;
    }

    /**
     * Credit a wallet
     */
    async creditWallet(
        walletId: string,
        amount: number,
        reference: string,
        description?: string
    ): Promise<CreditDebitResponse> {
        const response = await fetch(`${this.baseUrl}/wallets/${walletId}/credit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, reference, description }),
        });

        const json = await response.json() as ApiResponse<CreditDebitResponse>;

        if (!response.ok || json.status === 'error') {
            throw new Error(json.message || 'Failed to credit wallet');
        }

        return json.data!;
    }

    /**
     * Debit a wallet
     */
    async debitWallet(
        walletId: string,
        amount: number,
        reference: string,
        description?: string
    ): Promise<CreditDebitResponse> {
        const response = await fetch(`${this.baseUrl}/wallets/${walletId}/debit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, reference, description }),
        });

        const json = await response.json() as ApiResponse<CreditDebitResponse>;

        if (!response.ok || json.status === 'error') {
            throw new Error(json.message || 'Failed to debit wallet');
        }

        return json.data!;
    }

    /**
     * Get wallet balance
     */
    async getBalance(walletId: string): Promise<number> {
        const wallet = await this.getWallet(walletId);
        return wallet.balance;
    }

    /**
     * Get transactions for a wallet
     */
    async getTransactions(
        walletId: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<{ transactions: TransactionResponse[]; total: number }> {
        const response = await fetch(
            `${this.baseUrl}/wallets/${walletId}/transactions?limit=${limit}&offset=${offset}`
        );

        const json = await response.json() as ApiResponse<{ data: TransactionResponse[]; total: number }>;

        if (!response.ok || json.status === 'error') {
            throw new Error(json.message || 'Failed to get transactions');
        }

        return {
            transactions: json.data!.data,
            total: json.data!.total,
        };
    }

    /**
     * Mock a payment (for testing)
     * This simulates a BudPay virtual account credit
     */
    async mockPayment(
        email: string,
        amount: number,
        reference?: string
    ): Promise<any> {
        const response = await fetch(`${this.baseUrl}/webhooks/budpay/mock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, amount, reference }),
        });

        const json = await response.json() as ApiResponse<any>;

        if (!response.ok || json.status === 'error') {
            throw new Error(json.message || 'Failed to mock payment');
        }

        return json.data;
    }
}

// Export a singleton instance
export const paymentClient = new PaymentClient();

// Also export the class for testing
export { PaymentClient };

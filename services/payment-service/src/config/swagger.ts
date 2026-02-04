import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// =============================================================================
// Schemas
// =============================================================================

const WalletSchema = z.object({
    id: z.string(),
    userId: z.string(),
    tenantId: z.string(),
    balance: z.number(),
    currency: z.string(),
    virtualAccountNumber: z.string().nullable(),
    virtualAccountBank: z.string().nullable(),
    virtualAccountName: z.string().nullable(),
    virtualAccountReference: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('Wallet');

const TransactionSchema = z.object({
    id: z.string(),
    walletId: z.string(),
    type: z.enum(['CREDIT', 'DEBIT']),
    amount: z.number(),
    balanceBefore: z.number(),
    balanceAfter: z.number(),
    reference: z.string(),
    description: z.string().nullable(),
    metadata: z.any().nullable(),
    createdAt: z.string().datetime(),
}).openapi('Transaction');

const CreateWalletSchema = z.object({
    currency: z.string().default('NGN'),
}).openapi('CreateWallet');

const CreditWalletSchema = z.object({
    amount: z.number().positive(),
    reference: z.string().min(1),
    description: z.string().optional(),
}).openapi('CreditWallet');

const DebitWalletSchema = z.object({
    amount: z.number().positive(),
    reference: z.string().min(1),
    description: z.string().optional(),
}).openapi('DebitWallet');

// Register schemas
registry.register('Wallet', WalletSchema);
registry.register('Transaction', TransactionSchema);

// Security scheme
registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});

// =============================================================================
// User Wallet Endpoints
// =============================================================================

registry.registerPath({
    method: 'get',
    path: '/wallets/me',
    tags: ['User Wallets'],
    summary: 'Get current user\'s wallet',
    security: [{ bearerAuth: [] }],
    responses: {
        200: {
            description: 'User wallet',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('success'),
                        data: WalletSchema,
                    }),
                },
            },
        },
        401: {
            description: 'Unauthorized',
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/wallets/me',
    tags: ['User Wallets'],
    summary: 'Create wallet for current user',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateWalletSchema,
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Wallet created',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('success'),
                        message: z.string(),
                        data: WalletSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/wallets/me/transactions',
    tags: ['User Wallets'],
    summary: 'Get current user\'s transaction history',
    security: [{ bearerAuth: [] }],
    request: {
        query: z.object({
            limit: z.string().optional().openapi({ description: 'Number of transactions (max 100)' }),
            offset: z.string().optional().openapi({ description: 'Offset for pagination' }),
        }),
    },
    responses: {
        200: {
            description: 'Transaction history',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('success'),
                        data: z.object({
                            data: z.array(TransactionSchema),
                            total: z.number(),
                            page: z.number(),
                            pageSize: z.number(),
                            totalPages: z.number(),
                        }),
                    }),
                },
            },
        },
    },
});

// =============================================================================
// Internal Wallet Endpoints (Service-to-Service)
// =============================================================================

registry.registerPath({
    method: 'get',
    path: '/wallets/{id}',
    tags: ['Internal Wallets'],
    summary: 'Get wallet by ID (internal)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Wallet ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Wallet details',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('success'),
                        data: WalletSchema,
                    }),
                },
            },
        },
        404: {
            description: 'Wallet not found',
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/wallets/user/{userId}',
    tags: ['Internal Wallets'],
    summary: 'Get wallet by user ID (internal)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            userId: z.string().openapi({ description: 'User ID' }),
        }),
    },
    responses: {
        200: {
            description: 'Wallet details',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('success'),
                        data: WalletSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/wallets/user/{userId}',
    tags: ['Internal Wallets'],
    summary: 'Create wallet for user (internal)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            userId: z.string().openapi({ description: 'User ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        tenantId: z.string().optional(),
                        currency: z.string().default('NGN'),
                    }),
                },
            },
        },
    },
    responses: {
        201: {
            description: 'Wallet created',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('success'),
                        data: WalletSchema,
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/wallets/{id}/credit',
    tags: ['Internal Wallets'],
    summary: 'Credit a wallet (internal)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Wallet ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: CreditWalletSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Wallet credited',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('success'),
                        message: z.string(),
                        data: z.object({
                            wallet: WalletSchema,
                            transaction: TransactionSchema,
                        }),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/wallets/{id}/debit',
    tags: ['Internal Wallets'],
    summary: 'Debit a wallet (internal)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Wallet ID' }),
        }),
        body: {
            content: {
                'application/json': {
                    schema: DebitWalletSchema,
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Wallet debited',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('success'),
                        message: z.string(),
                        data: z.object({
                            wallet: WalletSchema,
                            transaction: TransactionSchema,
                        }),
                    }),
                },
            },
        },
        400: {
            description: 'Insufficient balance',
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/wallets/{id}/transactions',
    tags: ['Internal Wallets'],
    summary: 'Get wallet transactions (internal)',
    security: [{ bearerAuth: [] }],
    request: {
        params: z.object({
            id: z.string().openapi({ description: 'Wallet ID' }),
        }),
        query: z.object({
            limit: z.string().optional(),
            offset: z.string().optional(),
        }),
    },
    responses: {
        200: {
            description: 'Transaction history',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.literal('success'),
                        data: z.object({
                            data: z.array(TransactionSchema),
                            total: z.number(),
                            page: z.number(),
                            pageSize: z.number(),
                            totalPages: z.number(),
                        }),
                    }),
                },
            },
        },
    },
});

// =============================================================================
// Webhook Endpoints
// =============================================================================

registry.registerPath({
    method: 'post',
    path: '/webhooks/budpay',
    tags: ['Webhooks'],
    summary: 'BudPay webhook endpoint',
    description: 'Receives payment notifications from BudPay when virtual accounts are credited. Verified via signature.',
    responses: {
        200: {
            description: 'Webhook processed',
            content: {
                'application/json': {
                    schema: z.object({
                        status: z.string(),
                        message: z.string(),
                    }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/webhooks/budpay/mock',
    tags: ['Webhooks'],
    summary: 'Mock BudPay webhook (development only)',
    description: 'Simulates a BudPay payment for testing purposes.',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        email: z.string().email(),
                        amount: z.number().positive(),
                        reference: z.string().optional(),
                        bankName: z.string().optional(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: 'Mock payment processed',
        },
    },
});

// =============================================================================
// Generate OpenAPI Document
// =============================================================================

export function generateOpenAPIDocument(): any {
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            version: '1.0.0',
            title: 'QShelter Payment Service API',
            description: 'Payment and wallet management service. Handles user wallets, virtual bank accounts (via BudPay), and payment processing.',
        },
        servers: [
            {
                url: '',
                description: 'Current environment',
            },
        ],
        tags: [
            { name: 'User Wallets', description: 'User-facing wallet endpoints' },
            { name: 'Internal Wallets', description: 'Service-to-service wallet operations' },
            { name: 'Webhooks', description: 'Payment provider webhook handlers' },
            { name: 'Health', description: 'Health check endpoints' },
        ],
    });
}

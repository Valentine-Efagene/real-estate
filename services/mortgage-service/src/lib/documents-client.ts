import { ConfigService } from '@valentine-efagene/qshelter-common';

const stage = process.env.NODE_ENV || process.env.STAGE || 'dev';

/**
 * Get the documents service base URL
 */
async function getDocumentsServiceUrl(): Promise<string> {
    // For local development/testing, use localhost
    if (stage === 'test' || stage === 'local') {
        return process.env.DOCUMENTS_SERVICE_URL || 'http://localhost:3006';
    }

    // For deployed environments, get from SSM
    const configService = ConfigService.getInstance();
    try {
        return await configService.getParameter('documents-service-url');
    } catch {
        // Fallback to env var or default API Gateway URL pattern
        return process.env.DOCUMENTS_SERVICE_URL ||
            `https://api.contribuild.com/${stage}/documents`;
    }
}

/**
 * Documents service client for generating documents from templates
 */
export interface DocumentsClient {
    generateOfferLetter(
        type: 'PROVISIONAL' | 'FINAL',
        mergeData: Record<string, any>,
        tenantId: string
    ): Promise<{ html: string; mergeData: Record<string, any> }>;

    generateDocument(
        templateCode: string,
        mergeData: Record<string, any>,
        tenantId: string
    ): Promise<{ html: string; mergeData: Record<string, any> }>;
}

class DocumentsClientImpl implements DocumentsClient {
    private baseUrl: string | null = null;

    private async getBaseUrl(): Promise<string> {
        if (!this.baseUrl) {
            this.baseUrl = await getDocumentsServiceUrl();
        }
        return this.baseUrl;
    }

    async generateOfferLetter(
        type: 'PROVISIONAL' | 'FINAL',
        mergeData: Record<string, any>,
        tenantId: string
    ): Promise<{ html: string; mergeData: Record<string, any> }> {
        const baseUrl = await this.getBaseUrl();

        try {
            const response = await fetch(`${baseUrl}/generate/offer-letter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': tenantId,
                },
                body: JSON.stringify({ type, mergeData }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
                throw new Error(`Documents service error: ${error.error || response.statusText}`);
            }

            return response.json() as Promise<{ html: string; mergeData: Record<string, any> }>;
        } catch (error: any) {
            // In test mode, return a mock response if documents service is unavailable
            if (stage === 'test') {
                console.info('[DocumentsClient] Using mock offer letter in test mode');
                return {
                    html: `<html><body><h1>${type} Offer Letter</h1><p>Mock document for testing</p></body></html>`,
                    mergeData,
                };
            }
            throw error;
        }
    }

    async generateDocument(
        templateCode: string,
        mergeData: Record<string, any>,
        tenantId: string
    ): Promise<{ html: string; mergeData: Record<string, any> }> {
        const baseUrl = await this.getBaseUrl();

        const response = await fetch(`${baseUrl}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': tenantId,
            },
            body: JSON.stringify({ templateCode, mergeData }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Documents service error: ${error.error || response.statusText}`);
        }

        return response.json() as Promise<{ html: string; mergeData: Record<string, any> }>;
    }
}

export const documentsClient: DocumentsClient = new DocumentsClientImpl();

import axios from 'axios';
import { SendWhatsAppMessageInput as SendWhatsAppDto } from '../validators/whatsapp.validator';

export interface WhatsAppResponse {
    messaging_product: string;
    contacts: Array<{ input: string; wa_id: string }>;
    messages: Array<{ id: string }>;
}

export class WhatsappService {
    private readonly apiUrl: string;
    private readonly accessToken: string;
    private readonly phoneNumberId: string;

    constructor() {
        this.apiUrl = 'https://graph.facebook.com/v20.0';
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    }

    async sendMessage(dto: SendWhatsAppDto): Promise<WhatsAppResponse> {
        const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

        const payload = {
            messaging_product: 'whatsapp',
            to: dto.destinationNumber,
            type: 'text',
            text: {
                body: dto.message,
            }
        };

        try {
            const response = await axios.post<WhatsAppResponse>(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                }
            });

            console.log('[WhatsappService] Message sent successfully');
            return response.data;
        } catch (error) {
            console.error('[WhatsappService] Error sending message:', error);
            throw error;
        }
    }
}

// Singleton instance
let whatsappServiceInstance: WhatsappService | null = null;

export function getWhatsappService(): WhatsappService {
    if (!whatsappServiceInstance) {
        whatsappServiceInstance = new WhatsappService();
    }
    return whatsappServiceInstance;
}

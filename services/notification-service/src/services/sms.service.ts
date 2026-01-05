import axios, { AxiosError } from 'axios';
import { SendSmsInput } from '../validators/sms.validator';

export class SmsService {
    private readonly apiUrl: string;
    private readonly apiKey: string;

    constructor() {
        this.apiUrl = 'https://api.africastalking.com/version1/messaging/bulk';
        this.apiKey = process.env.SMS_AT_APIKEY || '';
    }

    async sendSms(dto: SendSmsInput) {
        if (!this.apiUrl) {
            throw new Error('SMS endpoint not set');
        }

        if (!this.apiKey) {
            throw new Error('SMS API key not set');
        }

        const payload = JSON.stringify({
            username: 'techadmin',
            phoneNumbers: [dto.destinationNumber],
            message: dto.message,
            senderId: 'QSHELTER',
            enqueue: false
        });

        try {
            const response = await axios.post(this.apiUrl, payload, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'apiKey': this.apiKey
                }
            });

            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                console.error('[SmsService] Error sending SMS:', error.message);
                throw new Error(error.response?.data?.message || error.message);
            }
            throw error;
        }
    }
}

// Singleton instance
let smsServiceInstance: SmsService | null = null;

export function getSmsService(): SmsService {
    if (!smsServiceInstance) {
        smsServiceInstance = new SmsService();
    }
    return smsServiceInstance;
}

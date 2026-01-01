import axios, { AxiosError } from 'axios';
import { App } from '@slack/bolt';
import { SendSlackMessageInput } from '../validators/slack.validator';

export interface SlackResponse {
    ok: boolean;
    channel?: string;
    ts?: string;
    message?: Record<string, unknown>;
    warning?: string;
    response_metadata?: Record<string, unknown>;
}

export class SlackService {
    private readonly postEndpoint = 'https://slack.com/api/chat.postMessage';
    private readonly config: {
        token: string;
        channel: string;
        signingSecret: string;
    };

    constructor() {
        this.config = {
            token: process.env.SLACK_TOKEN || '',
            channel: process.env.SLACK_CHANNEL || '',
            signingSecret: process.env.SLACK_SIGNING_SECRET || '',
        };
    }

    async sendMessageWithHttp(dto: SendSlackMessageInput): Promise<SlackResponse> {
        if (!this.postEndpoint) {
            throw new Error('Slack API endpoint not set');
        }

        try {
            const response = await axios.post(this.postEndpoint, dto, {
                headers: {
                    'Authorization': `Bearer ${this.config.token}`,
                    'Content-Type': 'application/json',
                }
            });

            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                console.error('[SlackService] Error sending message:', error.message);
                throw new Error(error.response?.data?.message || error.message);
            }
            throw error;
        }
    }

    async sendMessageWithSdk(dto: SendSlackMessageInput): Promise<unknown> {
        try {
            const app = new App({
                signingSecret: this.config.signingSecret,
                token: this.config.token
            });

            const response = await app.client.chat.postMessage({
                token: this.config.token,
                channel: dto.channel,
                text: dto.text
            });

            return response;
        } catch (error) {
            console.error('[SlackService] Error sending message with SDK:', error);
            throw error;
        }
    }
}

// Singleton instance
let slackServiceInstance: SlackService | null = null;

export function getSlackService(): SlackService {
    if (!slackServiceInstance) {
        slackServiceInstance = new SlackService();
    }
    return slackServiceInstance;
}

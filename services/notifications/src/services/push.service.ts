import {
    SNSClient,
    SNSClientConfig,
    CreatePlatformEndpointCommand,
    CreatePlatformEndpointCommandInput,
    PublishCommand,
    PublishCommandInput,
    GetEndpointAttributesCommand,
} from '@aws-sdk/client-sns';
import { prisma } from '../lib/prisma';
import { Request } from 'express';
import {
    TokenRegistrationInput,
    NotificationInput,
} from '../validators/push.validator';

interface SnsException {
    Error: {
        message: string;
    };
}

export class PushService {
    private readonly snsClient: SNSClient;

    constructor() {
        const config: SNSClientConfig = {
            region: process.env.AWS_REGION ?? 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_SNS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY || '',
            }
        };

        this.snsClient = new SNSClient(config);
    }

    async createApplicationEndpoint(dto: TokenRegistrationInput, request: Request): Promise<string> {
        const { userId, token } = dto;
        let endpointArn: string;

        const input: CreatePlatformEndpointCommandInput = {
            PlatformApplicationArn: process.env.PLATFORM_APPLICATION_ARN,
            Token: token,
            CustomUserData: `${userId}`,
        };

        console.log('[PushService] Platform application ARN:', process.env.PLATFORM_APPLICATION_ARN);

        try {
            const command = new CreatePlatformEndpointCommand(input);
            const response = await this.snsClient.send(command);
            endpointArn = response.EndpointArn || '';
        } catch (error) {
            console.log('[PushService] Error creating endpoint:', error);
            const err = error as SnsException;
            const message = err.Error?.message || '';

            const arnRegex = /arn:aws:sns:[a-z\-0-9]+:[0-9]+:endpoint\/[A-Z]+\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9\-]+/;
            const match = message.match(arnRegex);

            if (match) {
                endpointArn = match[0];
                console.log('[PushService] Extracted ARN:', endpointArn);
            } else {
                console.log('[PushService] ARN not found in the message.');
                throw error;
            }
        }

        try {
            const deviceEndpoint = await prisma.deviceEndpoint.findFirst({
                where: { endpoint: endpointArn }
            });

            if (!deviceEndpoint) {
                const user = await prisma.user.findUnique({
                    where: { id: userId }
                });

                if (user) {
                    await prisma.deviceEndpoint.create({
                        data: {
                            userId,
                            endpoint: endpointArn,
                            platform: request.headers['user-agent']?.includes('Android') ? 'android' : 'ios',
                        }
                    });
                }
            }
        } catch (error) {
            console.log('[PushService] Error while creating Device Endpoint:', error);
        }

        return endpointArn;
    }

    async verifyEndpoint(endpointArn: string) {
        const command = new GetEndpointAttributesCommand({
            EndpointArn: endpointArn,
        });

        try {
            const response = await this.snsClient.send(command);
            return response;
        } catch (error) {
            console.error('[PushService] Error verifying endpoint:', error);
            throw error;
        }
    }

    async sendNotification(dto: NotificationInput) {
        const input: PublishCommandInput = {
            TargetArn: dto.endpointArn,
            Message: JSON.stringify({
                default: dto.body,
                GCM: JSON.stringify({
                    notification: {
                        title: dto.title,
                        body: dto.body,
                    },
                    data: dto.data || {},
                }),
            }),
            MessageStructure: 'json',
        };

        const command = new PublishCommand(input);

        try {
            const response = await this.snsClient.send(command);
            console.log('[PushService] Notification sent successfully');
            return response;
        } catch (error) {
            console.error('[PushService] Error sending notification:', error);
            throw error;
        }
    }
}

// Singleton instance
let pushServiceInstance: PushService | null = null;

export function getPushService(): PushService {
    if (!pushServiceInstance) {
        pushServiceInstance = new PushService();
    }
    return pushServiceInstance;
}

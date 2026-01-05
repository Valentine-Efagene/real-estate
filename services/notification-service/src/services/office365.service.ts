import axios from 'axios';
import { removeNullishProperties, compileWithLayout } from '../helpers/utils';
import { getFilePath, loadFileWithFullPath } from '../helpers/filesystem';
import { templatePathMap, templateTitle } from '../helpers/data';
import { TemplateTypeValue, BaseEmailInput } from '../validators/email.validator';

export interface OAuth2Config {
    client_id: string;
    client_secret: string;
    tenant_id: string;
    sender_email: string;
    sender_name: string;
    default_recipients: string[];
    default_subject: string;
    default_body: string;
    scope: string;
}

export interface EmailOptions {
    to_emails?: string[];
    from_email?: string;
    subject?: string;
    body?: string;
    html_body?: string;
    attachments?: string[];
    cc_emails?: string[];
    bcc_emails?: string[];
    provider?: string;
    app?: string;
}

export interface GraphApiMessage {
    subject: string;
    body: {
        contentType: 'HTML' | 'Text';
        content: string;
    };
    toRecipients: Array<{
        emailAddress: {
            address: string;
        };
    }>;
    ccRecipients?: Array<{
        emailAddress: {
            address: string;
        };
    }>;
    bccRecipients?: Array<{
        emailAddress: {
            address: string;
        };
    }>;
}

export interface GraphApiPayload {
    message: GraphApiMessage;
    saveToSentItems: boolean;
}

interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

export class Office365Service {
    private readonly sourceEmail: string;
    private readonly config: OAuth2Config;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;

    constructor() {
        this.sourceEmail = process.env.FROM_EMAIL || '';

        this.config = {
            client_id: process.env.OFFICE365_CLIENT_ID || '',
            client_secret: process.env.OFFICE365_CLIENT_SECRET || '',
            tenant_id: process.env.OFFICE365_TENANT_ID || '',
            sender_email: process.env.OFFICE365_SENDER_EMAIL || process.env.FROM_EMAIL || '',
            sender_name: process.env.OFFICE365_SENDER_NAME || 'Qshelter',
            default_recipients: [],
            default_subject: 'Test Email from Office 365',
            default_body: 'This is a test email sent via Office 365.',
            scope: 'https://graph.microsoft.com/.default'
        };
    }

    private getAppSenderConfig(app: string): { sender_email: string; sender_name: string } {
        const appSenderMap: Record<string, { sender_email: string; sender_name: string }> = {
            'renewed_hope': {
                sender_email: process.env.RENEWEDHOPE_OFFICE365_SENDER_EMAIL || 'renewed@qshelter.ng',
                sender_name: process.env.RENEWEDHOPE_OFFICE365_SENDER_NAME || 'Renewed Hope'
            },
            'mofi': {
                sender_email: process.env.MOFI_OFFICE365_SENDER_EMAIL || process.env.OFFICE365_SENDER_EMAIL || 'mreif@qshelter.ng',
                sender_name: process.env.MOFI_OFFICE365_SENDER_NAME || process.env.OFFICE365_SENDER_NAME || 'MREIF Pro'
            },
            'contribuild': {
                sender_email: process.env.CONTRIBUILD_OFFICE365_SENDER_EMAIL || process.env.OFFICE365_SENDER_EMAIL || 'mreif@qshelter.ng',
                sender_name: process.env.CONTRIBUILD_OFFICE365_SENDER_NAME || process.env.OFFICE365_SENDER_NAME || 'Qshelter'
            },
            'fmbn': {
                sender_email: process.env.FMBN_OFFICE365_SENDER_EMAIL || process.env.OFFICE365_SENDER_EMAIL || 'mreif@qshelter.ng',
                sender_name: process.env.FMBN_OFFICE365_SENDER_NAME || process.env.OFFICE365_SENDER_NAME || 'Qshelter'
            },
            'qshelter': {
                sender_email: process.env.QSHELTER_OFFICE365_SENDER_EMAIL || process.env.OFFICE365_SENDER_EMAIL || 'mreif@qshelter.ng',
                sender_name: process.env.QSHELTER_OFFICE365_SENDER_NAME || process.env.OFFICE365_SENDER_NAME || 'Qshelter'
            },
            '2004estate': {
                sender_email: process.env.ESTATE_2004_OFFICE365_SENDER_EMAIL || process.env.OFFICE365_SENDER_EMAIL || 'hello@2004estate.ng',
                sender_name: process.env.ESTATE_2004_OFFICE365_SENDER_NAME || process.env.OFFICE365_SENDER_NAME || '2004 Estate'
            }
        };

        return appSenderMap[app.toLowerCase()] || {
            sender_email: this.config.sender_email,
            sender_name: this.config.sender_name
        };
    }

    private async getAccessToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const tokenUrl = `https://login.microsoftonline.com/${this.config.tenant_id}/oauth2/v2.0/token`;

            const response = await axios.post(tokenUrl, new URLSearchParams({
                client_id: this.config.client_id,
                client_secret: this.config.client_secret,
                scope: this.config.scope,
                grant_type: 'client_credentials'
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const tokenData: TokenResponse = response.data;
            this.accessToken = tokenData.access_token;
            this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000;

            console.log('[Office365] OAuth2 token obtained successfully');
            return this.accessToken;

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[Office365] Failed to obtain OAuth2 token:', message);
            throw new Error(`OAuth2 authentication failed: ${message}`);
        }
    }

    async sendEmail(options: EmailOptions = {}) {
        try {
            const token = await this.getAccessToken();
            const graphEndpoint = 'https://graph.microsoft.com/v1.0';

            const senderConfig = options.app ? this.getAppSenderConfig(options.app) : {
                sender_email: this.config.sender_email,
                sender_name: this.config.sender_name
            };

            const toEmails = options.to_emails || this.config.default_recipients;
            const subject = options.subject || this.config.default_subject;
            const body = options.body || this.config.default_body;
            const htmlBody = options.html_body || body;

            console.log(`[Office365] Sending email to: ${toEmails.join(', ')}`);

            const payload: GraphApiPayload = {
                message: {
                    subject: subject,
                    body: {
                        contentType: 'HTML',
                        content: htmlBody
                    },
                    toRecipients: toEmails.map(email => ({
                        emailAddress: {
                            address: email
                        }
                    }))
                },
                saveToSentItems: true
            };

            if (options.cc_emails && options.cc_emails.length > 0) {
                payload.message.ccRecipients = options.cc_emails.map(email => ({
                    emailAddress: { address: email }
                }));
            }

            if (options.bcc_emails && options.bcc_emails.length > 0) {
                payload.message.bccRecipients = options.bcc_emails.map(email => ({
                    emailAddress: { address: email }
                }));
            }

            const userUpn = senderConfig.sender_email;

            const response = await axios.post(
                `${graphEndpoint}/users/${userUpn}/sendMail`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`[Office365] Email sent successfully. Status: ${response.status}`);

            return {
                status: response.status,
                data: response.data,
                headers: {
                    'x-ms-request-id': response.headers['x-ms-request-id'] || null,
                    'request-id': response.headers['request-id'] || null,
                    'client-request-id': response.headers['client-request-id'] || null
                }
            };
        } catch (error: unknown) {
            console.error('[Office365] Error sending email:', error);
            throw error;
        }
    }

    async sendHtmlEmail(toEmail: string, html: string, subject: string) {
        try {
            const emailOptions: EmailOptions = {
                to_emails: [toEmail],
                from_email: this.sourceEmail,
                subject: subject,
                html_body: html
            };

            const response = await this.sendEmail(emailOptions);
            console.log(`[Office365] HTML email sent successfully to ${toEmail}`);
            return response;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Office365] Failed to send HTML email: ${message}`);
            throw error;
        }
    }

    async sendTemplateEmail(dto: BaseEmailInput & { templateName: TemplateTypeValue; subject?: string;[key: string]: unknown }) {
        try {
            const { to_email, templateName } = dto;
            console.log(`[Office365] Processing template email: ${templateName} for ${to_email}`);

            const templatePath: string = templatePathMap[templateName];

            if (!templatePath) {
                throw new Error(`Template type ${templateName} not found in template path map`);
            }

            const subject = dto.subject ?? templateTitle[templateName];

            if (!subject) {
                throw new Error('Subject is required');
            }

            let html: string;

            try {
                const key: string = templatePathMap[templateName];
                const filePath = getFilePath(key);
                const templateSource = loadFileWithFullPath(filePath);

                const finalDto = { subject, ...dto };
                const reqData = removeNullishProperties(finalDto);

                // Use layout-based compilation for .hbs templates, direct compilation for .html
                if (key.endsWith('.hbs')) {
                    html = await compileWithLayout(templateSource, reqData as Record<string, unknown>);
                } else {
                    const { compileTemplate } = await import('../helpers/utils');
                    html = await compileTemplate(templateSource, reqData as Record<string, unknown>);
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[Office365] Error loading template: ${message}`);
                throw new Error(`Error loading template: ${message}`);
            }

            const emailOptions: EmailOptions = {
                to_emails: [to_email],
                from_email: this.sourceEmail,
                subject: subject,
                html_body: html,
            };

            const response = await this.sendEmail(emailOptions);
            console.log(`[Office365] Template email sent successfully to ${to_email}`);
            return response;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Office365] Failed to send template email: ${message}`);
            throw error;
        }
    }

    async getStats() {
        return {
            provider: 'Office365',
            status: 'active',
            timestamp: new Date().toISOString()
        };
    }
}

// Singleton instance
let office365ServiceInstance: Office365Service | null = null;

export function getOffice365Service(): Office365Service {
    if (!office365ServiceInstance) {
        office365ServiceInstance = new Office365Service();
    }
    return office365ServiceInstance;
}

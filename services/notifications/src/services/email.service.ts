import { FileSystemHelper } from '../helpers/FileSystemHelper';
import { UtilHelper } from '../helpers/UtilHelper';
import { getOffice365Service } from './office365.service';
import {
    BaseEmailInput,
    SendEmailInput,
    TemplateTypeValue,
} from '../validators/email.validator';

export class EmailService {
    private readonly office365Service = getOffice365Service();
    private readonly constants = UtilHelper.constants;

    async testTemp(path: string) {
        return FileSystemHelper.loadFile(path);
    }

    buildUnsubscribeLink(userId: string): string {
        const baseUrl = process.env.UNSUBSCRIBE_BASE_URL || process.env.WEBSITE_LINK || '';
        return `${baseUrl}/unsubscribe?user=${userId}`;
    }

    async sendTemplateEmail(dto: BaseEmailInput & { templateName: TemplateTypeValue; subject?: string;[key: string]: unknown }) {
        const fullDto = {
            ...dto,
            ...this.constants,
        };

        try {
            console.log('[EmailService] Attempting to send template email via Office 365...');
            const response = await this.office365Service.sendTemplateEmail(fullDto);
            return response;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[EmailService] Failed to send template email: ${message}`);
            throw error;
        }
    }

    async getConstants() {
        return this.constants;
    }

    async listTemplateFiles(): Promise<string[]> {
        const files = FileSystemHelper.listHtmlFilesInTemplates();
        return files;
    }

    async sendEmail(dto: SendEmailInput) {
        try {
            console.log('[EmailService] Attempting to send email via Office 365...');
            return await this.office365Service.sendEmail({
                to_emails: [dto.to_email],
                subject: dto.subject,
                body: dto.message,
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[EmailService] Failed to send email: ${message}`);
            throw error;
        }
    }

    async sendHtmlEmail(toEmail: string, html: string, subject: string) {
        try {
            console.log('[EmailService] Attempting to send HTML email via Office 365...');
            return await this.office365Service.sendHtmlEmail(toEmail, html, subject);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[EmailService] Failed to send HTML email: ${message}`);
            throw error;
        }
    }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
    if (!emailServiceInstance) {
        emailServiceInstance = new EmailService();
    }
    return emailServiceInstance;
}

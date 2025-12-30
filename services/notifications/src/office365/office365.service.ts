import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BaseEmailDto, SendTemplateEmailDto } from '../email/email.dto';
import axios from 'axios';
import UtilHelper from '../helpers/UtilHelper';
import { FileSystemHelper } from '../helpers/FileSystemHelper';
import DataHelper from '../helpers/DataHelper';

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
  app?: string; // Add app parameter for dynamic sender configuration
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
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

@Injectable()
export default class Office365Service {
  private readonly logger = new Logger(Office365Service.name);
  private readonly sourceEmail: string;
  private readonly replyEmail: string;
  private readonly config: OAuth2Config;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.sourceEmail = process.env.FROM_EMAIL;
    this.replyEmail = process.env.REPLY_EMAIL;

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

  /**
   * Get app-specific sender configuration
   */
  private getAppSenderConfig(app: string): { sender_email: string; sender_name: string } {
    const appSenderMap = {
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

    // Return app-specific config or fallback to default
    return appSenderMap[app.toLowerCase()] || {
      sender_email: this.config.sender_email,
      sender_name: this.config.sender_name
    };
  }

  /**
     * Get OAuth2 access token
     */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.config.tenant_id}/oauth2/v2.0/token`;

      const response = await axios.post(tokenUrl, {
        client_id: this.config.client_id,
        client_secret: this.config.client_secret,
        scope: this.config.scope,
        grant_type: 'client_credentials'
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokenData: TokenResponse = response.data;
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 minute buffer

      this.logger.log('OAuth2 token obtained successfully');
      return this.accessToken;

    } catch (error: any) {
      this.logger.error('Failed to obtain OAuth2 token:', error.message);
      throw new Error(`OAuth2 authentication failed: ${error.message}`);
    }
  }

  /**
   * Send email via Microsoft Graph API
   */
  async sendEmail(options: EmailOptions = {}) {
    try {
      const token = await this.getAccessToken();
      const graphEndpoint = 'https://graph.microsoft.com/v1.0';

      // Get app-specific sender configuration
      const senderConfig = options.app ? this.getAppSenderConfig(options.app) : {
        sender_email: this.config.sender_email,
        sender_name: this.config.sender_name
      };

      // Prepare email data
      const toEmails = options.to_emails || this.config.default_recipients;
      const subject = options.subject || this.config.default_subject;
      const body = options.body || this.config.default_body;
      const htmlBody = options.html_body || body;

      this.logger.log('📧 Sending email via Microsoft Graph API...');
      this.logger.log(`   From: ${senderConfig.sender_email} (${senderConfig.sender_name})`);
      this.logger.log(`   To: ${toEmails.join(', ')}`);
      this.logger.log(`   Subject: ${subject}`);

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

      // Add CC recipients if provided
      if (options.cc_emails && options.cc_emails.length > 0) {
        payload.message.ccRecipients = options.cc_emails.map(email => ({
          emailAddress: {
            address: email
          }
        }));
        this.logger.log(`   CC: ${options.cc_emails.join(', ')}`);
      }

      // Add BCC recipients if provided
      if (options.bcc_emails && options.bcc_emails.length > 0) {
        payload.message.bccRecipients = options.bcc_emails.map(email => ({
          emailAddress: {
            address: email
          }
        }));
        this.logger.log(`   BCC: ${options.bcc_emails.join(', ')}`);
      }

      // For Office 365, we need to use the user's UPN (User Principal Name)
      // The sender email should be a verified user in Azure AD
      const userUpn = senderConfig.sender_email;

      this.logger.log(`🔍 Debugging Office 365 request:`);
      this.logger.log(`   User UPN: ${userUpn}`);
      this.logger.log(`   Endpoint: ${graphEndpoint}/users/${userUpn}/sendMail`);
      this.logger.log(`   Tenant ID: ${this.config.tenant_id}`);

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

      this.logger.log('✅ Email sent successfully!');
      this.logger.log(`   Status: ${response.status}`);
      this.logger.log(`   Message ID: ${response.headers['x-ms-request-id'] || 'N/A'}`);

      return {
        status: response.status,
        data: response.data,
        headers: {
          'x-ms-request-id': response.headers['x-ms-request-id'] || null,
          'request-id': response.headers['request-id'] || null,
          'client-request-id': response.headers['client-request-id'] || null
        }
      };
    } catch (error: any) {
      this.logger.error('❌ Error sending email:');
      if (error.response) {
        this.logger.error(`   Status: ${error.response.status}`);
        this.logger.error(`   Error: ${error.response.data.error?.message || error.response.data.error}`);
        this.logger.error(`   Code: ${error.response.data.error?.code || 'N/A'}`);
        //this.logger.error(`   Endpoint: ${graphEndpoint}/users/${userUpn}/sendMail`);
        this.logger.error(`   Tenant ID: ${this.config.tenant_id}`);
        this.logger.error(`   Client ID: ${this.config.client_id}`);

        // Provide specific guidance for common errors
        if (error.response.status === 404) {
          this.logger.error('   💡 404 Error: The user email might not exist in Azure AD or the Graph API permissions are insufficient');
          this.logger.error('   💡 Ensure the sender email is a verified user in your Azure AD tenant');
          this.logger.error('   💡 Check that your app has Mail.Send permissions in Azure AD');
        } else if (error.response.status === 403) {
          this.logger.error('   💡 403 Error: Insufficient permissions. Check Azure AD app permissions');
        } else if (error.response.status === 401) {
          this.logger.error('   💡 401 Error: Authentication failed. Check client credentials and tenant ID');
        }
      } else {
        this.logger.error(`   ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Send HTML email using Office 365
   */
  async sendHtmlEmail(toEmail: string, html: string, subject: string) {
    try {
      const emailOptions: EmailOptions = {
        to_emails: [toEmail],
        from_email: this.sourceEmail,
        subject: subject,
        html_body: html
      };

      const response = await this.sendEmail(emailOptions);
      this.logger.log(`HTML email sent successfully to ${toEmail}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to send HTML email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send template email using Office 365 with proper template processing
   */
  async sendTemplateEmail(dto: SendTemplateEmailDto) {
    try {
      const { to_email, templateName } = dto;
      this.logger.log(`Processing template email: ${templateName} for ${to_email}`);

      const path: string = DataHelper.templatePathMap[templateName];

      if (!path) {
        throw new BadRequestException(`Template type ${templateName} not found in template path map`);
      }

      // Handle HTML templates
      const subject = dto.subject ?? DataHelper.templateTitle[templateName];

      if (!subject) {
        throw new BadRequestException('Subject is required');
      }

      // Load and compile HTML template
      let html: string;

      try {
        const key: string = DataHelper.templatePathMap[templateName];
        const filePath = await FileSystemHelper.getFilePath(key);
        const templateSource = FileSystemHelper.loadFileWithFullPath(filePath);

        // For HTML templates, we need to replace placeholders with actual data
        const finalDto = { subject, ...dto };
        const reqData = UtilHelper.removeNullishProperties(finalDto);

        html = await UtilHelper.compileTemplate(templateSource, reqData);
      } catch (error) {
        this.logger.error(`Error loading template: ${error.message}`);
        throw new BadRequestException(`Error loading template: ${error.message}`);
      }

      // Send the compiled HTML email
      const emailOptions: EmailOptions = {
        to_emails: [to_email],
        from_email: this.sourceEmail,
        subject: subject,
        html_body: html,
      };

      const response = await this.sendEmail(emailOptions);
      this.logger.log(`Template email sent successfully to ${to_email}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to send template email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send test email using Office 365
   */
  async sendTestEmail(): Promise<void> {
    try {
      await this.sendTestEmail();
      this.logger.log('Test email sent successfully via Office 365');
    } catch (error) {
      this.logger.error(`Failed to send test email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get email provider statistics
   */
  async getStats(): Promise<any> {
    // Office 365 doesn't provide direct statistics like SES
    // This could be enhanced with Microsoft Graph API calls to get email stats
    return {
      provider: 'Office365',
      status: 'active',
      timestamp: new Date().toISOString()
    };
  }
} 
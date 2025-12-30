import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEmailDto,
  SendEmailDto,
  SendTemplateEmailDto,
} from './email.dto';
import UtilHelper from '../helpers/UtilHelper';
import { FileSystemHelper } from '../helpers/FileSystemHelper';
import SlackService from '../slack/slack.service';
import PushService from '../push/push.service';
import { DeviceEndpointService } from '../device_endpoint/device_endpoint.service';
import { EmailPreferenceService } from '../email_preference/email_preference.service';
import { EmailPreference } from '../../../../shared/common/entities/email_preference.entity';
import Office365Service from '../office365/office365.service';

export enum EmailProvider {
  SES = 'SES',
  OFFICE365 = 'OFFICE365',
  AUTO = 'AUTO'
}

export interface EmailProviderConfig {
  defaultProvider: EmailProvider;
  highPriorityProvider: EmailProvider;
  marketingProvider: EmailProvider;
  transactionalProvider: EmailProvider;
  templateProvider: EmailProvider;
}

@Injectable()
export default class EmailService {
  private config: EmailProviderConfig;
  private readonly logger = new Logger(EmailService.name);

  private readonly constants = UtilHelper.constants

  constructor(
    private readonly slackService: SlackService,
    private readonly pushService: PushService,
    private readonly deviceEndpointService: DeviceEndpointService,
    private readonly emailPreferenceService: EmailPreferenceService,
    private readonly office365Service: Office365Service,
  ) {
    // Updated configuration - Office 365 as main sender
    this.config = {
      defaultProvider: EmailProvider.OFFICE365,
      highPriorityProvider: EmailProvider.OFFICE365,
      marketingProvider: EmailProvider.OFFICE365,
      transactionalProvider: EmailProvider.OFFICE365,
      templateProvider: EmailProvider.OFFICE365 // Changed from SES to Office 365
    };
  }

  testTemp = async (path: string) => {
    return FileSystemHelper.loadFile(path)
  }

  async checkPreference(dto: BaseEmailDto): Promise<EmailPreference> {
    const email: string = dto.to_email
    let preference: EmailPreference = null

    try {
      preference = await this.emailPreferenceService.findOneByEmail(email)

      this.logger.log('Checking preference.')

      if (!preference) {
        preference = await this.emailPreferenceService.subscribe(email)
      } else if (preference.unSubscribed) {
        this.logger.log('This user has unsubscribed. Returning early.')
      }
    } catch (error) {
      this.logger.error('Error while checking subscription or subscribing:', error)
    }

    return preference
  }

  /**
   * Send template email with Office 365 as primary
   */
  async sendTemplateEmail(_dto: SendTemplateEmailDto) {
    const preference = await this.checkPreference(_dto)

    const dto: SendTemplateEmailDto & { unsubscribeLink: string } = {
      ..._dto,
      ...this.constants,
      unsubscribeLink: encodeURI(this.emailPreferenceService.buildUnsubscribeLink(preference.unsubscribeToken))
    }

    try {
      this.logger.log(` Attempting to send template email via Office 365...`);
      const response = await this.office365Service.sendTemplateEmail(dto);
      return response
    } catch (error) {
      this.logger.error(` Failed to send template email: ${error.message}`);
      throw error;
    }
  }

  async getConstants() {
    return this.constants
  }

  async listTemplateFiles(): Promise<string[]> {
    const files = FileSystemHelper.listHtmlFilesInTemplates()
    return files
  };

  /**
   * Send email with Office 365 as primary
   */
  async sendEmail(dto: SendEmailDto) {
    try {
      this.logger.log('Attempting to send email via Office 365...');
      return await this.office365Service.sendEmail(dto);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send HTML email with Office 365 as primary
   */
  async sendHtmlEmail(toEmail: string, html: string, subject: string) {
    try {
      this.logger.log(' Attempting to send HTML email via Office 365...');
      return await this.office365Service.sendHtmlEmail(toEmail, html, subject);
    } catch (error) {
      this.logger.error(`Failed to send HTML email: ${error.message}`);
      throw error;
    }
  }
}

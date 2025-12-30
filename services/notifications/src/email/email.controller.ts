import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import EmailService from './email.service';
import {
  AccountSuspendedDto,
  AccountVerifiedDto,
  AdminContributionReceivedDto,
  AdminInviteAdminDto,
  AdminPropertyAllocationDto,
  MissedPaymentsDto,
  PropertyAllocationDto,
  ResetPasswordDto,
  SendRawTemplateEmailDto,
  UpdatedTermsAndConditionsDto,
  VerifyEmailDto,
  WalletTopUpDto,
} from './email.dto';
import { StandardApiResponse } from '../helpers/StandardApiResponse';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../app.enum';
import UtilHelper from '../helpers/UtilHelper';
import { TemplateType } from './email.enum';
import Office365Service from '../office365/office365.service';

const tags = {
  config: 'Email Configuration',
  misc: 'Miscellaneous',
  debug: 'Debug',
  admin: 'Admin',
  mortgage: 'Mortgage',
  developer: 'Developer',
  prelaunch: 'Prelaunch',
  base: 'Base',
  rsa: 'RSA',
  pmb: 'PMB',
  contribution: 'Contribution',
  agent: 'Agent',
}

@Controller('email')
@ApiTags('Email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly office365Service: Office365Service,
  ) { }

  @ApiTags(tags.debug)
  @Post('/test-email')
  async testEnhancedEmail() {
    const testDto = {
      to_email: '2benay+contribtest@gmail.com',
      subject: 'Test Enhanced Email Service',
      message: 'This is a test email sent via the enhanced email service with Office 365 as primary sender.'
    };

    try {
      const result = await this.emailService.sendEmail(testDto);
      if (!result || !result.headers) {
        return new StandardApiResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Enhanced email test failed', { error: 'Failed to send email' });
      }
      return new StandardApiResponse(HttpStatus.OK, 'Enhanced email test completed', result.headers);
    } catch (error) {
      return new StandardApiResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Enhanced email test failed', { error: error.message });
    }
  }

  @ApiTags(tags.debug)
  @Post('/test-raw-html-email')
  @HttpCode(HttpStatus.OK)
  async testRawHtmlEmail(
    @Body() body: SendRawTemplateEmailDto
  ) {
    const response = await this.emailService.sendHtmlEmail(body.to_email, body.html, body.subject)
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.base)
  @Post('/account-suspended')
  @HttpCode(HttpStatus.OK)
  async accountSuspended(
    @Body() body: AccountSuspendedDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.AccountSuspended)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.base)
  @Post('/account-verified')
  @HttpCode(HttpStatus.OK)
  async accountVerified(
    @Body() body: AccountVerifiedDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.AccountVerified)
    const response = await this.emailService.sendTemplateEmail({
      templateName,
      ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.base)
  @Post('/missed-payments')
  @HttpCode(HttpStatus.OK)
  async missedPayments(
    @Body() body: MissedPaymentsDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.MissedPayments)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.base)
  @Post('/property-allocation')
  @HttpCode(HttpStatus.OK)
  async propertyAllocation(
    @Body() body: PropertyAllocationDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.PropertyAllocation)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.base)
  @Post('/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: ResetPasswordDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.ResetPassword)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.base)
  @Post('/updated-terms-and-conditions')
  @HttpCode(HttpStatus.OK)
  async updatedTermsAndConditions(
    @Body() body: UpdatedTermsAndConditionsDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.UpdatedTermsAndConditions)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.base)
  @Post('/verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() body: VerifyEmailDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.VerifyEmail)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.base)
  @Post('/wallet-top-up')
  @HttpCode(HttpStatus.OK)
  async walletTopUp(
    @Body() body: WalletTopUpDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.WalletTopUp)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.admin)
  @Post('/admin/contribution-received')
  @HttpCode(HttpStatus.OK)
  async adminContributionReceived(
    @Body() body: AdminContributionReceivedDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.AdminContributionReceived)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.admin)
  @Post('/admin/property-allocation')
  @HttpCode(HttpStatus.OK)
  async adminPropertyAllocation(
    @Body() body: AdminPropertyAllocationDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.AdminPropertyAllocation)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }

  @ApiTags(tags.admin)
  @Post('/admin/invite-admin')
  @HttpCode(HttpStatus.OK)
  async adminInviteAdmin(
    @Body() body: AdminInviteAdminDto
  ) {
    const templateName = UtilHelper.buildTemplateName(TemplateType.AdminInviteAdmin)
    const response = await this.emailService.sendTemplateEmail({
      templateName, ...body
    })
    return new StandardApiResponse(response.status, ResponseMessage.EMAIL_SENT, response.headers)
  }
}
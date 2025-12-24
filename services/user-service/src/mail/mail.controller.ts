import {
  Body,
  Controller,
  Post,
  HttpStatus,
} from '@nestjs/common';
import { MailService } from './mail.service';
import { SendMailDto, SendTicketMailDto, SendVerificationMailDto, TestDto } from './mail.dto';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse, OpenApiHelper } from '@valentine-efagene/qshelter-common';
import { ResponseMessage } from '../common/common.enum';
import { SwaggerAuth, ConstantHelper } from '@valentine-efagene/qshelter-common';
import { TemplateTesterService } from './template-tester.service';

@SwaggerAuth()
@Controller('mailer')
@ApiTags('Mailer')
@ApiResponse(OpenApiHelper.responseDoc)
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly templateTesterService: TemplateTesterService
  ) { }

  @Post('send-queued')
  async sendQueued(
    @Body() sendMailDto: SendMailDto,
  ): Promise<StandardApiResponse<void>> {
    const data = await this.mailService.sendQueued(sendMailDto);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.EMAIL_SENT, data);
  }

  @Post('test-template')
  async testTemplate(
    @Body() dto: TestDto
  ) {
    const variables = {
      name: "John Doe",
      link: 'https://www.mediacraft.org',
      ticketTemplate: ConstantHelper.exampleTicketTemplate,
      ...dto,
      ...ConstantHelper.mailConstants,
      socialLinks: ConstantHelper.socialLinks,
    }
    const templateName = 'invitation'
    await this.templateTesterService.generateEmailHtml(templateName, variables, 'test')
  }

  @Post('send-verification-email')
  async sendVerificationEmail(
    @Body() dto: SendVerificationMailDto,
  ): Promise<StandardApiResponse<void>> {
    const data = await this.mailService.sendEmailVerification(dto);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.EMAIL_SENT, data);
  }

  @Post('send-invitation')
  async sendTicketEmail(
    @Body() dto: SendTicketMailDto,
  ): Promise<StandardApiResponse<void>> {
    const data = await this.mailService.sendTicketEmail(dto);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.EMAIL_SENT, data);
  }

  @Post('send')
  async send(
    @Body() testMailDto: SendMailDto,
  ): Promise<StandardApiResponse<void>> {
    const data = await this.mailService.send(testMailDto);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.EMAIL_SENT, data);
  }
}

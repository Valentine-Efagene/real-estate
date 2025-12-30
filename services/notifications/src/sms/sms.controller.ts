import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import SmsService from './sms.service';
import { ApiCustomResponses } from '../email/decorators/ApiCustomResponses';
import { SendSmsDto } from './sms.dto';
import { StandardApiResponse } from '../helpers/StandardApiResponse';
import { PublishCommandOutput } from '@aws-sdk/client-sns';
import { ResponseMessage } from '../app.enum';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) { }

  @Post('/send')
  @ApiCustomResponses()
  async sendSms(
    @Body() body: SendSmsDto
  ): Promise<StandardApiResponse<PublishCommandOutput>> {
    const response = await this.smsService.sendSms(body)
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.SMS_SENT, response)
  }
}

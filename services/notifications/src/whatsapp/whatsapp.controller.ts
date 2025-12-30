import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import WhatsappService from './whatsapp.service';
import { ApiCustomResponses } from '../email/decorators/ApiCustomResponses';
import { SendMessageDto } from './whatsapp.dto';
import { StandardApiResponse } from '../helpers/StandardApiResponse';
import { PublishCommandOutput } from '@aws-sdk/client-sns';
import { ResponseMessage } from '../app.enum';
import { ApiTags } from '@nestjs/swagger';

@Controller('whatsapp')
@ApiTags('Whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) { }

  @Post('/send')
  @ApiCustomResponses()
  async sendSms(
    @Body() body: SendMessageDto
  ): Promise<StandardApiResponse<PublishCommandOutput>> {
    const response = await this.whatsappService.sendMessage(body)
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.SMS_SENT, response)
  }
}

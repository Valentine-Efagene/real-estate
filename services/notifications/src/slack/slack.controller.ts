import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import SlackService from './slack.service';
import { SendMessageDto, SlackResponseDto } from './slack.dto';
import { StandardApiResponse } from '../helpers/StandardApiResponse';
import { ResponseMessage } from '../app.enum';

@Controller('slack')
@ApiTags('Slack')
export class SlackController {
  constructor(private readonly slackService: SlackService) { }

  @Post('/send-slack-message-with-http')
  async sendMessage(
    @Body() body: SendMessageDto
  ): Promise<StandardApiResponse<SlackResponseDto>> {
    const response = await this.slackService.sendMessageWithHttp(body)
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.SENT, response)
  }

  @Post('/send-slack-message-with-sdk')
  async sendMessageWithSdk(
    @Body() body: SendMessageDto
  ): Promise<StandardApiResponse<any>> {
    const response = await this.slackService.sendMessageWithSdk(body)
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.SENT, response)
  }
}

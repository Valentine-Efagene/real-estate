import { App } from '@slack/bolt'
import { SendMessageDto, SlackResponseDto } from './slack.dto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom } from 'rxjs';
import ErrorHelper from '../helpers/ErrorHelper';

// https://www.youtube.com/watch?v=SbUv1nCS7a0
// https://api.slack.com/messaging/sending

@Injectable()
export default class SlackService {
  private readonly postEndpoint = 'https://slack.com/api/chat.postMessage'

  private config: {
    token: string,
    channel: string,
    signingSecret: string
  }

  constructor(
    private readonly httpService: HttpService

  ) {
    this.config = {
      token: process.env.SLACK_TOKEN,
      channel: process.env.SLACK_CHANNEL,
      signingSecret: process.env.SLACK_SIGNING_SECRET
    }
  }

  async sendMessageWithHttp(dto: SendMessageDto): Promise<SlackResponseDto> {
    if (!this.postEndpoint) {
      throw new InternalServerErrorException('Slack API endpoint not set')
    }

    const response = await firstValueFrom(
      this.httpService.post(this.postEndpoint, dto, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        }
      })
        .pipe(catchError((error: AxiosError) => {
          console.log('Error while sending slack message:', error)
          throw ErrorHelper.appropriateError(error)
        }))
    )

    return response?.data
  }

  async sendMessageWithSdk(dto: SendMessageDto): Promise<any> {
    try {
      const app = new App({
        signingSecret: this.config.signingSecret,
        token: this.config.token
      })

      const response = app.client.chat.postMessage({
        token: this.config.token,
        channel: dto.channel,
        text: dto.text
      })

      return response
    } catch (error) {
      console.log(error)
      throw error
    }
  }
}


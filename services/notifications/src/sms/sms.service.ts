// https://docs.aws.amazon.com/pinpoint/latest/developerguide/send-messages-sms.html

import { AxiosError } from 'axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SendSmsDto } from './sms.dto';
import { PublishCommandOutput } from '@aws-sdk/client-sns';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import ErrorHelper from '../helpers/ErrorHelper';

@Injectable()
export default class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private apiUrl: string
  private apikey: string

  constructor(
    private readonly httpService: HttpService
  ) {
    this.apiUrl = 'https://api.africastalking.com/version1/messaging/bulk'
    this.apikey = process.env.SMS_AT_APIKEY
  }

  /**
   * @summary: Uses SNS
   * @param dto: SendSmsDto 
   * @returns Promise<PublishCommandOutput>
   */
  async sendSms(dto: SendSmsDto): Promise<PublishCommandOutput> {
    if (!this.apiUrl) {
      throw new InternalServerErrorException('SMS endpoint not set')
    }

    if (!this.apikey) {
      throw new InternalServerErrorException('SMS API key not set')
    }

    const payload = JSON.stringify({
      username: 'techadmin',
      phoneNumbers: [dto.destinationNumber],
      message: dto.message,
      senderId: 'QSHELTER',
      enqueue: false
    })

    const { data } = await firstValueFrom(
      this.httpService.post(
        this.apiUrl,
        payload,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'apiKey': this.apikey
          }
        })
        .pipe(catchError((error: AxiosError) => {
          throw ErrorHelper.appropriateError(error)
        }))
    )

    return data
  }
}

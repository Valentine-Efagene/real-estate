// https://docs.aws.amazon.com/pinpoint/latest/developerguide/send-messages-sms.html

import { Injectable, Logger } from '@nestjs/common';
import { PinpointClient, SendMessagesCommand, SendMessagesCommandInput, SendMessagesCommandOutput } from '@aws-sdk/client-pinpoint';
import { SendMessageDto } from './whatsapp.dto';
import { PublishCommand, PublishCommandOutput, SNSClient } from '@aws-sdk/client-sns';
import { SendWhatsAppMessageCommand, SendWhatsAppMessageCommandOutput, SendWhatsAppMessageInput, SocialMessagingClient } from '@aws-sdk/client-socialmessaging';

@Injectable()
export default class WhatsappService {
  private senderId: string
  private appId: string
  private readonly logger = new Logger(WhatsappService.name);
  private readonly socialMessagingClient: SocialMessagingClient;

  constructor(
  ) {
    const config = {
      aws_sns_access_key_id: process.env.AWS_SNS_ACCESS_KEY_ID,
      aws_sns_secret_access_key: process.env.AWS_SNS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION ?? "us-east-1"
    }

    this.socialMessagingClient = new SocialMessagingClient({
      region: config.region,
      credentials: {
        accessKeyId: config.aws_sns_access_key_id,
        secretAccessKey: config.aws_sns_secret_access_key
      }
    })

    this.senderId = 'phone-number-id-715653010984126' //process.env.origination_phone_number_id
  }

  /**
   * @summary: Uses SNS
   * @param dto: SendSmsDto 
   * @returns Promise<PublishCommandOutput>
   */
  async sendMessage(dto: SendMessageDto): Promise<SendWhatsAppMessageCommandOutput> {
    const input: SendWhatsAppMessageInput = {
      originationPhoneNumberId: this.senderId, // required
      message: new TextEncoder().encode(JSON.stringify({
        messaging_product: "whatsapp",
        to: dto.destinationNumber,
        type: "text",
        text: {
          body: dto.message,
        }
      })), // e.g. Buffer.from("") or new TextEncoder().encode("")   // required
      metaApiVersion: "v20", // required
    };
    const command = new SendWhatsAppMessageCommand(input)

    const response = this.socialMessagingClient.send(command);
    return response
  }
}

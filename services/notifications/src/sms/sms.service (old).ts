// https://docs.aws.amazon.com/pinpoint/latest/developerguide/send-messages-sms.html

import { Injectable, Logger } from '@nestjs/common';
import { PinpointClient, SendMessagesCommand, SendMessagesCommandInput, SendMessagesCommandOutput } from '@aws-sdk/client-pinpoint';
import { SendSmsDto } from './sms.dto';
import { PublishCommand, PublishCommandOutput, SNSClient } from '@aws-sdk/client-sns';

@Injectable()
export default class SmsService {
  private senderId: string
  private appId: string
  private readonly logger = new Logger(SmsService.name);
  private readonly pinpointClient: PinpointClient;
  private readonly snsClient: SNSClient;

  constructor(
  ) {
    const config = {
      aws_sns_access_key_id: process.env.aws_sns_access_key_id,
      aws_sns_secret_access_key: process.env.aws_sns_secret_access_key,
      region: process.env.aws_region ?? "us-east-1"
    }

    this.senderId = process.env.pinpoint_sms_sender_id
    this.appId = process.env.pinpoint_project_id

    this.pinpointClient = new PinpointClient({
      region: config.region
    });

    this.snsClient = new SNSClient({
      region: config.region,
      credentials: {
        accessKeyId: config.aws_sns_access_key_id,
        secretAccessKey: config.aws_sns_secret_access_key
      }
    });
  }

  /**
   * @summary: Uses SNS
   * @param dto: SendSmsDto 
   * @returns Promise<PublishCommandOutput>
   */
  async sendSms(dto: SendSmsDto): Promise<PublishCommandOutput> {
    // aws sns publish --phone-number "+2349034360573" --message "Your OTP is 123456" --region us-east-1

    const command = new PublishCommand({
      Message: dto.message,
      PhoneNumber: dto.destinationNumber,
    })

    const response = this.snsClient.send(command);
    return response
  }

  async sendSmsWithPinpoint({ destinationNumber, message }: SendSmsDto): Promise<SendMessagesCommandOutput> {

    const params: SendMessagesCommandInput = {
      ApplicationId: this.appId,
      MessageRequest: {
        Addresses: {
          [destinationNumber]: {
            ChannelType: "SMS",
          },
        },
        MessageConfiguration: {
          SMSMessage: {
            Body: message,
            MessageType: "TRANSACTIONAL",
            SenderId: this.senderId
          },
        },
      },
    };

    try {
      const command = new SendMessagesCommand(params);
      const response = await this.pinpointClient.send(command);
      this.logger.log(`SMS sent successfully: ${JSON.stringify(response)}`);
      return response
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      throw error;
    }
  }
}

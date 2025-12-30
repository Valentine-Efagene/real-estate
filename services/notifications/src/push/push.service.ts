import { Injectable } from '@nestjs/common';
import { GetEndpointAttributesCommand, CreatePlatformEndpointCommand, PublishCommand, PublishCommandInput, SNSClient, SNSClientConfig, GetEndpointAttributesCommandOutput, CreatePlatformEndpointCommandInput } from '@aws-sdk/client-sns';
import { NotificationDto, TokenRegistrationDto } from './push.dto';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { DeviceEndpoint } from '../../../../shared/common/entities/device_endpoint.entity';
import { User } from '@valentine-efagene/qshelter-common';
import { Repository } from 'typeorm';

// https://www.youtube.com/watch?v=SbUv1nCS7a0
// https://api.slack.com/messaging/sending

@Injectable()
export default class PushService {
  private snsClient: SNSClient
  private config: SNSClientConfig

  constructor(
    @InjectRepository(DeviceEndpoint)
    private readonly deviceEndpointRepository: Repository<DeviceEndpoint>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {

    this.config = {
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_SNS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY
      }
    }

    this.snsClient = new SNSClient(this.config);
  }

  /**
   * 
   * @param dto 
   * @returns 
   * 
   * @summary Creates an endpoint for the application
   * 
   * @decription You will see a new endpoint in the AWS console. This is the endpoint that will be used to send messages to the application. 
   * the endpoint will be the same if same parameters are resused
   */
  async createApplicationEndpoint(dto: TokenRegistrationDto, request: Request): Promise<string> {
    const { userId, token } = dto
    let endpointArn: string

    const input: CreatePlatformEndpointCommandInput = {
      PlatformApplicationArn: process.env.PLATFORM_APPLICATION_ARN,
      Token: token,
      CustomUserData: `${userId}`,
    };

    console.log('application arn:', process.env.PLATFORM_APPLICATION_ARN)

    try {
      const command = new CreatePlatformEndpointCommand(input);
      const response = await this.snsClient.send(command);
      endpointArn = response.EndpointArn
    } catch (error) {
      console.log(error)
      const err = error as ISesException
      const message = err.Error.message

      const arnRegex = /arn:aws:sns:[a-z\-0-9]+:[0-9]+:endpoint\/[A-Z]+\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9\-]+/;

      // Extract the ARN
      const match = message.match(arnRegex);

      if (match) {
        endpointArn = match[0];
        console.log('Extracted ARN:', endpointArn);
      } else {
        console.log('ARN not found in the message.');
        throw error
      }
    }

    try {
      const deviceEndpoint = await this.deviceEndpointRepository.findOneBy({ endpointArn })

      if (!deviceEndpoint) {
        const user = await this.userRepository.findOneBy({ id: userId })

        if (user) {
          const entity = this.deviceEndpointRepository.create({
            userId,
            token,
            endpointArn,
            userData: user.email,
            userAgent: request.headers['user-agent']
          })
          await this.deviceEndpointRepository.save(entity)
        }
      }
    } catch (error) {
      console.log('Error while creating Device Endpoint:', error)
      throw error
    }

    return endpointArn;
  }

  async verifyEndpoint(endpointArn: string): Promise<GetEndpointAttributesCommandOutput> {
    const command = new GetEndpointAttributesCommand({
      EndpointArn: endpointArn
    });
    const response = await this.snsClient.send(command);

    return response;
  }

  async sendNotification(dto: NotificationDto) {
    const { title, message } = dto

    let payload: any = {
      GCM: JSON.stringify({
        data: {
          message,
          title,
          sound: "default"
        },
      })
    };

    let input: PublishCommandInput = {
      TargetArn: dto.endpointArn,
      Message: JSON.stringify(payload),
      Subject: title,
      MessageStructure: 'json'
    };

    let command = new PublishCommand(input);
    let response = await this.snsClient.send(command);
    return response
  }
}
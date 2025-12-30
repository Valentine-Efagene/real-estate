import { Body, Controller, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import WebPushService from './push.service';
import { EndpointVerificationDto, NotificationDto, TokenRegistrationDto, WebPushDto } from './push.dto';
import { StandardApiResponse } from '../helpers/StandardApiResponse';
import { ResponseMessage } from '../app.enum';
import { CreatePlatformApplicationCommandOutput, PublishCommandOutput } from '@aws-sdk/client-sns';
import { Request } from 'express';

@Controller('push')
@ApiTags('Push')
export class WebPushController {
  constructor(private readonly pushService: WebPushService) { }

  // @Post('/send-push')
  // async sendPush(
  //   @Body() body: WebPushDto
  // ): Promise<StandardApiResponse<string>> {
  //   const response = await this.pushService.sendWebPush(body);
  //   return new StandardApiResponse(HttpStatus.OK, ResponseMessage.SENT, response)
  // }

  @Post('/create-application-endpoint')
  async registerToken(
    @Body() body: TokenRegistrationDto,
    @Req() request: Request,
  ): Promise<StandardApiResponse<string>> {
    const response = await this.pushService.createApplicationEndpoint(body, request);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.SENT, response)
  }

  @Post('/verify-endpoint')
  async verifyEndpoint(
    @Body() body: EndpointVerificationDto
  ): Promise<StandardApiResponse<PublishCommandOutput>> {
    const response = await this.pushService.verifyEndpoint(body.endpointArn);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.SENT, response)
  }

  @Post('/send-notification')
  async sendNotification(
    @Body() body: NotificationDto
  ): Promise<StandardApiResponse<PublishCommandOutput>> {
    const response = await this.pushService.sendNotification(body);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.SENT, response)
  }
}

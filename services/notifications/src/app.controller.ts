import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import {
  TestTempDto,
} from './email/email.dto';
import { ResponseMessage } from './app.enum';
import { StandardApiResponse } from './helpers/StandardApiResponse';
import { ApiCustomResponses } from './email/decorators/ApiCustomResponses';
import EmailService from './email/email.service';

@Controller()
export class AppController {
  constructor(
    private readonly emailService: EmailService,
  ) { }
  @Post('/test-temp')
  @ApiCustomResponses()
  async TestTemp(
    @Body() body: TestTempDto
  ): Promise<StandardApiResponse<string>> {
    const response = await this.emailService.testTemp(body.path)
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, response)
  }
}

import {
  Controller,
  Get,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { EmailPreference } from '../../../../shared/common/entities/email_preference.entity';
import { EmailPreferenceService } from './email_preference.service';
import { SubscribeDto, UnSubscribeDto } from './email_preference.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from '../common/common.dto';
import OpenApiHelper from '../common/OpenApiHelper';
import { ResponseMessage } from '../common/common.enum';
import { SwaggerAuth } from '../common/guard/swagger-auth.guard';
// import { Paginate, Paginated, PaginateQuery } from 'nestjs-paginate';

@SwaggerAuth()
@Controller('email-preference')
@ApiTags('Email Preferences')
@ApiResponse(OpenApiHelper.responseDoc)
export class EmailPreferenceController {
  constructor(
    private readonly emailPreferenceService: EmailPreferenceService,
  ) { }

  @SwaggerAuth()
  @ApiTags('Debug')
  @Get('view')
  //@Roles([UserRole.ADMIN])
  @ApiOperation({
    summary: 'Get email preference for an email',
    tags: ['Admin'],
    description: '',
  })
  public async find(
    @Query('email') email: string
  ): Promise<StandardApiResponse<EmailPreference>> {
    const data = await this.emailPreferenceService.findOneByEmail(email);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @Get('/unsubscribe')
  @ApiOperation({
    summary: 'Unsubscribe',
    description: '',
  })
  async unsubscribe(
    @Query() query: UnSubscribeDto
  ): Promise<StandardApiResponse<EmailPreference>> {
    const data = await this.emailPreferenceService.unsubscribe(query);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Get('/subscribe')
  @ApiOperation({
    summary: 'Subscribe',
    description: '',
  })
  async subscribe(
    @Query() query: SubscribeDto
  ): Promise<StandardApiResponse<EmailPreference>> {
    const data = await this.emailPreferenceService.subscribe(query.email);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  // @SwaggerAuth()
  // @ApiTags('Debug')
  // @Get('paginate')
  // //@Roles([UserRole.ADMIN])
  // @ApiResponse(OpenApiHelper.paginatedResponseDoc)
  // @ApiOperation({
  //   summary: 'Get all email preferences',
  //   tags: ['Admin'],
  //   description: 'Paginated Response',
  // })
  // public async findAllPaginated(
  //   @Paginate() query: PaginateQuery,
  // ): Promise<StandardApiResponse<Paginated<EmailPreference>>> {
  //   const data = await this.emailPreferenceService.findAllPaginated(query);
  //   return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  // }
}

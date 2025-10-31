import {
  Body,
  Controller,
  Post,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  HttpCode,
} from '@nestjs/common';
import { BulkInviteService } from './bulk-invite.service';
import { ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from '../common/common.dto';
import OpenApiHelper from '../common/OpenApiHelper';
import { ResponseMessage } from '../common/common.enum';
import { SwaggerAuth } from '../common/guard/swagger-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import FileValidators from '../common/validator/FileValidators';
import { Request } from 'express';
import { User } from '../user/user.entity';
import { TestDto } from './bulk-invite.dto';

@SwaggerAuth()
@Controller('bulk-invite')
@ApiTags('Bulk invite')
@ApiResponse(OpenApiHelper.responseDoc)
export class BulkInviteController {
  constructor(
    private readonly bulkInviteService: BulkInviteService,
  ) { }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async test(
    @Req() req: Request,
    @Body() dto: TestDto
  ): Promise<StandardApiResponse<void>> {
    const data = await this.bulkInviteService.test(dto.data);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.INITIATED, data);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async queueInvitations(
    @UploadedFile(FileValidators.fileValidator) file: Express.Multer.File,
    @Req() req: Request
  ): Promise<StandardApiResponse<void>> {
    const user = req['user'] as User

    if (!file) {
      throw new BadRequestException('File is required');
    }

    const data = await this.bulkInviteService.queueStaffInvites({
      file,
      userId: user.id
    });
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.INITIATED, data);
  }
}

import {
  Controller,
  Delete,
  Get,
  Param,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { UserSuspension, StandardApiResponse, OpenApiHelper, ResponseMessage, SwaggerAuth } from '@valentine-efagene/qshelter-common';
import { UserSuspensionService } from './user_suspensions.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@SwaggerAuth()
@Controller('user-suspension')
@ApiTags('UserSuspension')
@ApiResponse(OpenApiHelper.responseDoc)
export class UserSuspensionController {
  constructor(private readonly userService: UserSuspensionService) { }

  @Get()
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findAll(): Promise<StandardApiResponse<UserSuspension[]>> {
    const data = await this.userService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Get(':id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<UserSuspension>> {
    const data = await this.userService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  //@UserSuspensions([UserSuspensionUserSuspension.ADMIN])
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @ApiResponse(OpenApiHelper.nullResponseDoc)
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.userService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }
}

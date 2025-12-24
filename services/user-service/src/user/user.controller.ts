import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  HttpStatus,
  ParseIntPipe,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
  Put,
  Patch,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from './user.entity';
import { S3UploaderService } from '../s3-uploader/s3-uploader.service';
import { UserService } from './user.service';
import { AssignRolesDto, AvatarUploadDto, CreateAdminDto, CreateUserDto, SuspendUserDto, UpdateUserControllerDto } from './user.dto';
import { ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse, OpenApiHelper } from '@valentine-efagene/qshelter-common';
import { ResponseMessage, S3Folder } from '../common/common.enum';
import { SwaggerAuth } from '@valentine-efagene/qshelter-common';
import { FileInterceptor } from '@nestjs/platform-express';
import FileValidators from '../common/validator/FileValidators';
import { Paginate, Paginated, PaginateQuery } from 'nestjs-paginate';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequirePermission } from '@valentine-efagene/qshelter-common';
import { PermissionName } from '../permission/permission.enums';
import { Request } from 'express';

@SwaggerAuth()
@UseGuards(ThrottlerGuard)
@Controller('users')
@ApiTags('User')
@ApiResponse(OpenApiHelper.responseDoc)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly uploaderService: S3UploaderService,
  ) { }

  @SwaggerAuth()
  @Post('create-admin')
  async createAdmin(
    @Body() createUserDto: CreateAdminDto,
  ): Promise<StandardApiResponse<User>> {
    const data = await this.userService.createAdmin(createUserDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @SwaggerAuth()
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<StandardApiResponse<User>> {
    const data = await this.userService.create(createUserDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @RequirePermission(PermissionName.READ_USERS)
  @Get('paginate')
  @ApiQuery({
    name: 'firstName',
    type: 'string',
    example: '',
    required: false,
    description: 'First Name'
  })
  @ApiQuery({
    name: 'lastName',
    type: 'string',
    example: '',
    description: 'Last Name',
    required: false,
  })
  @ApiQuery({
    name: 'role',
    type: 'string',
    example: '',
    description: '',
    required: false,
  })
  @ApiQuery({
    name: 'email',
    type: 'string',
    example: '',
    description: '',
    required: false,
  })
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findAllPaginated(
    @Paginate() query: PaginateQuery,
    @Query('firstName') firstName?: string,
    @Query('lastName') lastName?: string,
    @Query('email') email?: string,
  ): Promise<StandardApiResponse<Paginated<User>>> {
    const data = await this.userService.findAllPaginated(query, {
      firstName, lastName, email
    });
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @Put('avatar/:id')
  @ApiOperation({
    summary: 'Upload a file',
    description: '',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @UploadedFile(FileValidators.imageValidator)
    file: Express.Multer.File,
    @Param('id', ParseIntPipe) id: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Body() body: AvatarUploadDto,
  ): Promise<StandardApiResponse<string>> {
    if (!file) {
      throw new BadRequestException();
    }

    const user = await this.userService.findOne(id);

    if (!user) {
      throw new BadRequestException();
    }

    let url = null;

    if (user.avatar) {
      url = await this.uploaderService.replaceFileOnS3(
        file,
        S3Folder.AVATAR,
        user.avatar,
      );
    } else {
      url = await this.uploaderService.uploadImageToS3(file, S3Folder.LOGO);
    }

    await this.userService.updateOne(id, { avatar: url });
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, url);
  }

  @SwaggerAuth()
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update user',
    description: '',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUser(
    @UploadedFile(FileValidators.optionalImageValidator)
    file: Express.Multer.File,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserControllerDto,
  ): Promise<StandardApiResponse<User>> {
    const user = await this.userService.findOne(id);

    if (!user) {
      throw new BadRequestException();
    }

    let url = null;

    if (file) {
      if (user.avatar) {
        url = await this.uploaderService.replaceFileOnS3(
          file,
          S3Folder.AVATAR,
          user.avatar,
        );
      } else {
        url = await this.uploaderService.uploadImageToS3(file, S3Folder.LOGO);
      }

      body['avatar'] = url
    }

    const data = await this.userService.updateOne(id, body);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Patch()
  @ApiOperation({
    summary: 'Update profile',
    description: '',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async updateProfile(
    @UploadedFile(FileValidators.optionalImageValidator)
    file: Express.Multer.File,
    @Body() body: UpdateUserControllerDto,
    @Req() req: Request
  ): Promise<StandardApiResponse<User>> {
    const user = req['user'] as User

    if (!user) {
      throw new UnauthorizedException();
    }

    let url = null;

    if (file) {
      if (user.avatar) {
        url = await this.uploaderService.replaceFileOnS3(
          file,
          S3Folder.AVATAR,
          user.avatar,
        );
      } else {
        url = await this.uploaderService.uploadImageToS3(file, S3Folder.LOGO);
      }

      body['avatar'] = url
    }

    const data = await this.userService.updateOne(user.id, {
      avatar: body.avatar,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
    });
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Get('/suspend/:id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async suspend(
    @Param('id', ParseIntPipe) id: number,
    @Body() suspendUserDto: SuspendUserDto
  ): Promise<StandardApiResponse<User>> {
    const data = await this.userService.suspend(id, suspendUserDto.reason);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Get('/suspend/:id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async reinstate(
    @Param('id', ParseIntPipe) id: number,
    @Body() suspendUserDto: SuspendUserDto
  ): Promise<StandardApiResponse<User>> {
    const data = await this.userService.reinstate(id, suspendUserDto.reason);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Get('/profile')
  @ApiResponse(OpenApiHelper.responseDoc)
  async profile(
    @Req() request: Request,
  ): Promise<StandardApiResponse<User>> {
    const data = await this.userService.getProfile(request);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @Get(':id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<User>> {
    const data = await this.userService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Put('/:id/set-roles')
  @ApiResponse(OpenApiHelper.responseDoc)
  async setRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRolesDto
  ): Promise<StandardApiResponse<User>> {
    const data = await this.userService.setRoles(id, dto);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  // @Put('/:id/assign-roles')
  // @ApiResponse(OpenApiHelper.responseDoc)
  // async assignPermissions(
  //   @Param('id', ParseIntPipe) id: number,
  //   @Body() dto: AssignRolesDto
  // ): Promise<StandardApiResponse<User>> {
  //   const data = await this.userService.assignRoles(id, dto);
  //   return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  // }

  // @Put('/:id/revoke-roles')
  // @ApiResponse(OpenApiHelper.responseDoc)
  // async revokePermissions(
  //   @Param('id', ParseIntPipe) id: number,
  //   @Body() dto: AssignRolesDto
  // ): Promise<StandardApiResponse<User>> {
  //   const data = await this.userService.revokeRoles(id, dto);
  //   return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  // }

  @Delete(':id')
  @SwaggerAuth()
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @ApiResponse(OpenApiHelper.nullResponseDoc)
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.userService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }

  @SwaggerAuth()
  @Get()
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findAll(): Promise<StandardApiResponse<User[]>> {
    const data = await this.userService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }
}

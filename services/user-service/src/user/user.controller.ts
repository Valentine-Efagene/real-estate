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
  Put,
  Patch,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@valentine-efagene/qshelter-common';
import { UserService } from './user.service';
import { AssignRolesDto, CreateAdminDto, CreateUserDto, SuspendUserDto, UpdateUserControllerDto, UpdateAvatarDto } from './user.dto';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse, PaginationHelper, PaginatedResponse } from '@valentine-efagene/qshelter-common';
import { ResponseMessage } from '../common/common.enum';
import { SwaggerAuth } from '@valentine-efagene/qshelter-common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequirePermission } from '@valentine-efagene/qshelter-common';
import { PermissionName } from '../permission/permission.enums';
import { Request } from 'express';

@SwaggerAuth()
@UseGuards(ThrottlerGuard)
@Controller('users')
@ApiTags('User')
export class UserController {
  constructor(
    private readonly userService: UserService,
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
  @ApiQuery({
    name: 'page',
    type: 'number',
    example: 1,
    description: 'Page number',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    type: 'number',
    example: 10,
    description: 'Items per page',
    required: false,
  })
  @ApiQuery({
    name: 'sortBy',
    type: 'string',
    example: 'id',
    description: 'Sort by field',
    required: false,
  })
  @ApiQuery({
    name: 'sortOrder',
    type: 'string',
    example: 'DESC',
    description: 'Sort order (ASC or DESC)',
    required: false,
  })
  async findAllPaginated(
    @Query() queryParams: any,
  ): Promise<StandardApiResponse<PaginatedResponse<User>>> {
    const paginationQuery = PaginationHelper.parseQuery(queryParams);
    const { firstName, lastName, email } = queryParams;

    const data = await this.userService.findAllPaginated(paginationQuery, {
      firstName, lastName, email
    });
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @Put('avatar/:id')
  @ApiOperation({
    summary: 'Update user avatar',
    description: 'Updates user avatar with S3 URL from frontend upload',
  })
  async updateAvatar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAvatarDto,
  ): Promise<StandardApiResponse<User>> {
    const user = await this.userService.findOne(id);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const data = await this.userService.updateOne(id, { avatar: body.avatarUrl });
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Patch('/:id')
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user details including avatar URL',
  })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserControllerDto,
  ): Promise<StandardApiResponse<User>> {
    const user = await this.userService.findOne(id);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const data = await this.userService.updateOne(id, body);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Patch()
  @ApiOperation({
    summary: 'Update profile',
    description: 'Update authenticated user profile including avatar URL',
  })
  async updateProfile(
    @Body() body: UpdateUserControllerDto,
    @Req() req: Request
  ): Promise<StandardApiResponse<User>> {
    const user = req['user'] as User

    if (!user) {
      throw new UnauthorizedException();
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
  async suspend(
    @Param('id', ParseIntPipe) id: number,
    @Body() suspendUserDto: SuspendUserDto
  ): Promise<StandardApiResponse<User>> {
    const data = await this.userService.suspend(id, suspendUserDto.reason);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Get('/suspend/:id')
  async reinstate(
    @Param('id', ParseIntPipe) id: number,
    @Body() suspendUserDto: SuspendUserDto
  ): Promise<StandardApiResponse<User>> {
    const data = await this.userService.reinstate(id, suspendUserDto.reason);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.UPDATED, data);
  }

  @SwaggerAuth()
  @Get('/profile')
  async profile(
    @Req() request: Request,
  ): Promise<StandardApiResponse<User>> {
    const data = await this.userService.getProfile(request);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @SwaggerAuth()
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<User>> {
    const data = await this.userService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Put('/:id/set-roles')
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
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.userService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }

  @SwaggerAuth()
  @Get()
  async findAll(): Promise<StandardApiResponse<User[]>> {
    const data = await this.userService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }
}

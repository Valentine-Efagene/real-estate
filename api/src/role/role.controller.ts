import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  HttpStatus,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { Role } from './role.entity';
import { RoleService } from './role.service';
import { AssignPermissionsDto, CreateRoleDto } from './role.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StandardApiResponse } from '../common/common.dto';
import OpenApiHelper from '../common/OpenApiHelper';
import { ResponseMessage } from '../common/common.enum';
import { SwaggerAuth } from '../common/guard/swagger-auth.guard';

@SwaggerAuth()
@Controller('roles')
@ApiTags('Role')
@ApiResponse(OpenApiHelper.responseDoc)
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  @Post()
  async create(
    @Body() createRoleDto: CreateRoleDto,
  ): Promise<StandardApiResponse<Role>> {
    const data = await this.roleService.create(createRoleDto);
    return new StandardApiResponse(HttpStatus.CREATED, ResponseMessage.CREATED, data);
  }

  @Get()
  @ApiResponse(OpenApiHelper.arrayResponseDoc)
  async findAll(): Promise<StandardApiResponse<Role[]>> {
    const data = await this.roleService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Get(':id')
  @ApiResponse(OpenApiHelper.responseDoc)
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Role>> {
    const data = await this.roleService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Put('/:id/assign-permissions')
  @ApiResponse(OpenApiHelper.responseDoc)
  async assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto
  ): Promise<StandardApiResponse<Role>> {
    const data = await this.roleService.assignPermissions(id, dto);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Put('/:id/revoke-permissions')
  @ApiResponse(OpenApiHelper.responseDoc)
  async revokePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto
  ): Promise<StandardApiResponse<Role>> {
    const data = await this.roleService.revokePermissions(id, dto);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Delete(':id')
  //@Roles([RoleRole.ADMIN])
  @ApiOperation({ summary: '', tags: ['Admin'] })
  @ApiResponse(OpenApiHelper.nullResponseDoc)
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.roleService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }
}

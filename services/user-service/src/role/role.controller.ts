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
import { RoleService } from './role.service';
import { AssignPermissionsDto, CreateRoleDto } from './role.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SwaggerAuth } from '@qshelter/nest-auth';
import { Role } from '@valentine-efagene/entities';
import { ResponseMessage, StandardApiResponse } from '../type';

@SwaggerAuth()
@Controller('roles')
@ApiTags('Role')
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
  async findAll(): Promise<StandardApiResponse<Role[]>> {
    const data = await this.roleService.findAll();
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,): Promise<StandardApiResponse<Role>> {
    const data = await this.roleService.findOne(id);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Put('/:id/assign-permissions')
  async assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto
  ): Promise<StandardApiResponse<Role>> {
    const data = await this.roleService.assignPermissions(id, dto);
    return new StandardApiResponse(HttpStatus.OK, ResponseMessage.FETCHED, data);
  }

  @Put('/:id/revoke-permissions')
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
  async remove(
    @Param('id', ParseIntPipe) id: number): Promise<StandardApiResponse<void>> {
    await this.roleService.remove(id);
    return new StandardApiResponse(HttpStatus.NO_CONTENT, ResponseMessage.DELETED, null);
  }
}

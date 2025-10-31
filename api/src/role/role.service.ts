import { BadRequestException, Injectable, NotFoundException, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from './role.entity';
import { AssignPermissionsDto, CreateRoleDto, UpdateRoleDto } from './role.dto';
import { Permission } from '../permission/permission.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private dataSource: DataSource,
  ) { }

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const entity = this.roleRepository.create(createRoleDto);
    return await this.roleRepository.save(entity);
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find();
  }

  findOne(id: number): Promise<Role> {
    return this.roleRepository.findOneBy({ id: id });
  }

  async updateOne(id: number, updateDto: UpdateRoleDto): Promise<Role> {
    const role = await this.roleRepository.findOneBy({ id });

    if (!role) {
      throw new NotFoundException(`${Role.name} with ID ${id} not found`);
    }

    this.roleRepository.merge(role, updateDto);
    return this.roleRepository.save(role);
  }

  findOneByName(name: string): Promise<Role> {
    return this.roleRepository.findOneBy({ name });
  }

  async assignPermissions(id: number, dto: AssignPermissionsDto): Promise<Role> {
    const role = await this.findOne(id)

    if (!role) {
      throw new BadRequestException('Invalid role ID')
    }

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const permissionPromises = dto.permissionIds?.map(id => {
        return this.dataSource.getRepository(Permission).findOneBy({ id })
      })

      const permissions: Permission[] = await Promise.all(permissionPromises)
      role.permissions = permissions
      await queryRunner.manager.save(role)

      await queryRunner.commitTransaction()
      return role
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async revokePermissions(id: number, dto: AssignPermissionsDto): Promise<Role> {
    const role = await this.findOne(id)

    if (!role) {
      throw new BadRequestException('Invalid role ID')
    }

    const oldPermissionIds = role.permissions
    const newPermissions = oldPermissionIds.filter(permission => !dto.permissionIds.includes(permission.id))

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()


    try {
      role.permissions = newPermissions
      await queryRunner.manager.save(role)

      await queryRunner.commitTransaction()
      return role
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async remove(id: number): Promise<void> {
    await this.roleRepository.delete(id);
  }
}

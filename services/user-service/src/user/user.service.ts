import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Like, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, SetRolesDto, UpdateUserDto } from './user.dto';
import { Request } from 'express';
import { UserStatus } from './user.enums';
import { Role, User } from '@valentine-efagene/qshelter-common';
import { FilterOperator, paginate, Paginated, PaginateQuery } from 'nestjs-paginate';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    private readonly dataSource: DataSource
  ) { }

  async create({ password, roles = ['user'], ...rest }: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    // Check if the email already exists
    const existingUser = await this.userRepository.findOneBy({ email: rest.email });

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const entity = this.userRepository.create({
      ...rest,
      password: hashedPassword
    });

    const newUser = await this.userRepository.save(entity);

    for (const role of roles) {
      const roleEntity = await this.roleRepository.findOneBy({ name: role });

      if (!roleEntity) {
        throw new BadRequestException(`Role ${role} does not exist`);
      }

      // Assign the role to the user
      await this.setRoles(newUser.id, {
        roleIds: [roleEntity.id]
      })
    }

    return newUser
  }

  async createAdmin({ password, roles, ...rest }: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);

    const entity = this.userRepository.create({
      ...rest,
      isEmailVerified: true,
      password: hashedPassword
    });

    const newUser = await this.userRepository.save(entity)

    const adminRole = await this.roleRepository.findOneBy({
      name: 'admin'
    })

    await this.setRoles(newUser.id, {
      roleIds: [adminRole.id]
    })

    return newUser
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  findAllPaginated(
    query: PaginateQuery,
    params: {
      firstName?: string,
      lastName?: string,
      email?: string,
    }
  ): Promise<Paginated<User>> {
    const { firstName, lastName, email } = params

    const whereFilter: FindOptionsWhere<User> | FindOptionsWhere<User>[] = [
      { firstName: Like(`%${firstName}%`) },
      { lastName: Like(`%${lastName}%`) },
      { email: Like(`%${email}%`) },
    ]

    return paginate(query, this.userRepository, {
      sortableColumns: ['id', 'firstName', 'email', 'lastName', 'createdAt', 'updatedAt'],
      //nullSort: 'last',
      defaultSortBy: [['id', 'DESC']],
      loadEagerRelations: true,
      relations: ['roles'],
      searchableColumns: ['id', 'firstName', 'lastName', 'email'],
      //select: ['id'],
      // where: Object.values(params).length > 0 ? whereFilter : undefined,
      filterableColumns: {
        //name: [FilterOperator.EQ, FilterSuffix.NOT],
        price: [FilterOperator.LTE],
        propertyType: true,
        category: true,
        status: true,
        createdAt: true
      },
    });
  }

  findOne(id: number): Promise<User> {
    return this.userRepository.findOne({
      relations: {
        roles: true,
      },
      where: { id }
    });
  }

  getProfile(req: Request): Promise<User> {
    const user = req['user'] as User;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.userRepository.findOne({
      relations: {
        roles: true,
      },
      where: { id: user.id }
    });
  }

  findOneByEmail(email: string): Promise<User> {
    return this.userRepository.findOneBy({ email });
  }

  findOneByEmailVerificationToken(token: string): Promise<User> {
    return this.userRepository.findOneBy({ emailVerificationToken: token });
  }

  async updateOne(id: number, updateDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(`${User.name} with ID ${id} not found`);
    }

    this.userRepository.merge(user, updateDto);
    return this.userRepository.save(user);
  }

  async suspend(id: number, reason: string): Promise<User> {
    const queryRunner = this.dataSource.createQueryRunner()

    try {
      await queryRunner.connect()
      await queryRunner.startTransaction()
      const user: User = await this.findOne(id)

      if (!user) {
        throw new BadRequestException()
      }

      user.status = UserStatus.SUSPENDED

      const userSuspension = new UserSuspension()
      userSuspension.userId = user.id
      userSuspension.reason = reason

      await queryRunner.manager.save(userSuspension)
      await queryRunner.commitTransaction()
      return user
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async reinstate(id: number, reason: string): Promise<User> {
    const user: User = await this.findOne(id)

    if (!user) {
      throw new BadRequestException()
    }

    const updated = this.userRepository.merge(user, {
      status: UserStatus.SUSPENDED
    })

    return await this.userRepository.save(updated)
  }

  async setRoles(id: number, dto: SetRolesDto): Promise<User> {
    const user = await this.findOne(id)

    if (!user) {
      throw new BadRequestException('Invalid user ID')
    }

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const rolePromises = dto.roleIds?.map(id => {
        return this.dataSource.getRepository(Role).findOneBy({ id })
      })

      const roles: Role[] = await Promise.all(rolePromises)
      user.roles = roles
      await queryRunner.manager.save(user)

      await queryRunner.commitTransaction()
      return user
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async remove(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }
}

# Multitenancy - Service Implementation Examples

## Example 1: Using TenantContextService (Recommended)

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private tenantContext: TenantContextService,
  ) {}

  async findAll() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.userRepo.find({
      where: { tenantId },
    });
  }

  async findOne(id: number) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.userRepo.findOne({
      where: { id, tenantId },
    });
  }

  async create(userData: any) {
    const tenantId = this.tenantContext.requireTenantId();
    const user = this.userRepo.create({
      ...userData,
      tenantId,
    });
    return this.userRepo.save(user);
  }

  async update(id: number, userData: any) {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.userRepo.findOne({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    Object.assign(user, userData);
    return this.userRepo.save(user);
  }

  async remove(id: number) {
    const tenantId = this.tenantContext.requireTenantId();
    const user = await this.userRepo.findOne({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepo.softRemove(user);
  }
}
```

## Example 2: Using @CurrentTenantId Decorator in Controller

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { TenantGuard } from '../common/guard/tenant.guard';
import {
  CurrentTenantId,
  CurrentTenant,
} from '../common/decorator/tenant.decorator';
import { Tenant } from '../tenant/tenant.entity';

@Controller('users')
@UseGuards(TenantGuard) // Ensure all routes require tenant
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(@CurrentTenantId() tenantId: number) {
    // Pass tenantId to service if not using TenantContextService
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentTenant() tenant: Tenant) {
    // You can access full tenant object if needed
    console.log(`Accessing user for tenant: ${tenant.name}`);
    return this.userService.findOne(+id);
  }

  @Post()
  create(@Body() userData: any) {
    return this.userService.create(userData);
  }
}
```

## Example 3: Using TenantAwareRepository

```typescript
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Property } from './property.entity';
import { TenantAwareRepository } from '../common/helpers/TenantAwareRepository';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class PropertyService {
  private propertyRepo: TenantAwareRepository<Property>;

  constructor(
    private dataSource: DataSource,
    private tenantContext: TenantContextService,
  ) {
    this.propertyRepo = this.dataSource
      .getRepository(Property)
      .extend(
        TenantAwareRepository.prototype,
      ) as TenantAwareRepository<Property>;
  }

  async findAll() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.propertyRepo.findByTenant(tenantId);
  }

  async findOne(id: number) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.propertyRepo.findOneByTenant(tenantId, {
      where: { id } as any,
    });
  }

  async create(propertyData: any) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.propertyRepo.createForTenant(tenantId, propertyData);
  }

  async update(id: number, propertyData: any) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.propertyRepo.updateForTenant(tenantId, id, propertyData);
  }

  async remove(id: number) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.propertyRepo.softDeleteForTenant(tenantId, id);
  }
}
```

## Example 4: Complex Queries with Relationships

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mortgage } from './mortgage.entity';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class MortgageService {
  constructor(
    @InjectRepository(Mortgage)
    private mortgageRepo: Repository<Mortgage>,
    private tenantContext: TenantContextService,
  ) {}

  async findAllWithRelations() {
    const tenantId = this.tenantContext.requireTenantId();

    return this.mortgageRepo.find({
      where: { tenantId },
      relations: ['property', 'borrower', 'mortgageType'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: string) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.mortgageRepo
      .createQueryBuilder('mortgage')
      .leftJoinAndSelect('mortgage.property', 'property')
      .leftJoinAndSelect('mortgage.borrower', 'borrower')
      .where('mortgage.tenantId = :tenantId', { tenantId })
      .andWhere('mortgage.state = :status', { status })
      .getMany();
  }

  async getStatistics() {
    const tenantId = this.tenantContext.requireTenantId();

    return this.mortgageRepo
      .createQueryBuilder('mortgage')
      .select('mortgage.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(mortgage.principal)', 'totalPrincipal')
      .where('mortgage.tenantId = :tenantId', { tenantId })
      .groupBy('mortgage.state')
      .getRawMany();
  }
}
```

## Example 5: Handling Cross-Tenant Data (Admin Operations)

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private tenantContext: TenantContextService,
  ) {}

  /**
   * Super admin operation - can access data across tenants
   * Make sure to add proper authorization checks!
   */
  async getAllTenantsUsers(requesterRole: string) {
    if (requesterRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only super admins can access cross-tenant data',
      );
    }

    // Query without tenant filter
    return this.userRepo.find({
      relations: ['tenant'],
      order: { tenantId: 'ASC', createdAt: 'DESC' },
    });
  }

  /**
   * Get users for a specific tenant (super admin only)
   */
  async getUsersByTenant(targetTenantId: number, requesterRole: string) {
    if (requesterRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only super admins can access cross-tenant data',
      );
    }

    return this.userRepo.find({
      where: { tenantId: targetTenantId },
      relations: ['tenant'],
    });
  }
}
```

## Testing Tenant Isolation

```typescript
describe('UserService - Tenant Isolation', () => {
  let service: UserService;
  let tenantContext: TenantContextService;

  beforeEach(() => {
    // Mock tenant context
    tenantContext = {
      requireTenantId: jest.fn().mockReturnValue(1),
    } as any;

    service = new UserService(userRepo, tenantContext);
  });

  it('should only return users for the current tenant', async () => {
    const users = await service.findAll();

    // Verify all returned users belong to tenant 1
    users.forEach((user) => {
      expect(user.tenantId).toBe(1);
    });
  });

  it('should not allow access to users from other tenants', async () => {
    // Try to access user from tenant 2 while tenant 1 is active
    tenantContext.requireTenantId = jest.fn().mockReturnValue(1);

    const user = await service.findOne(999); // User belongs to tenant 2
    expect(user).toBeNull();
  });
});
```

## Best Practices

1. **Always use TenantContextService** in request-scoped services
2. **Add TenantGuard** to controllers that need tenant isolation
3. **Never bypass tenant filters** in queries unless you're building super admin features
4. **Test tenant isolation** thoroughly in your e2e tests
5. **Use transactions** when creating related entities to ensure data consistency
6. **Index tenantId columns** for better query performance
7. **Validate tenant status** before processing sensitive operations
8. **Audit log cross-tenant access** for security and compliance

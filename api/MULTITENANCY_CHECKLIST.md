# Multitenancy Migration Checklist

## Phase 1: Infrastructure Setup ✅ COMPLETED

- [x] Create Tenant entity with all required fields
- [x] Create TenantService for CRUD operations
- [x] Create TenantController with REST endpoints
- [x] Create TenantMiddleware for tenant extraction
- [x] Create TenantGuard for route protection
- [x] Create @CurrentTenant and @CurrentTenantId decorators
- [x] Create TenantContextService for request-scoped context
- [x] Create TenantAwareBaseEntity and AbstractTenantAwareEntity
- [x] Create TenantAwareRepository helper class
- [x] Update BaseEntity with tenant support
- [x] Add TenantModule to app.module.ts
- [x] Configure TenantMiddleware in app.module.ts
- [x] Add Tenant to data-source.ts entities
- [x] Build successful

## Phase 2: Entity Migration ⏳ TODO

### High Priority Entities (Core Business Logic)

- [ ] Update User entity to extend TenantAwareBaseEntity
- [ ] Update Property entity to extend TenantAwareBaseEntity
- [ ] Update Mortgage entity (already extends AbstractBaseReviewableEntity - check if updated)
- [ ] Update Transaction entity
- [ ] Update Wallet entity
- [ ] Update MortgageType entity
- [ ] Update Role entity
- [ ] Update Permission entity

### Medium Priority Entities

- [ ] Update PropertyMedia entity
- [ ] Update PropertyDocument entity
- [ ] Update MortgageDocument entity
- [ ] Update MortgageStep entity
- [ ] Update MortgageDownpaymentPlan entity
- [ ] Update MortgageDownpaymentInstallment entity
- [ ] Update MortgageDownpaymentPayment entity
- [ ] Update MortgageTransition entity
- [ ] Update MortgageTransitionEvent entity
- [ ] Update MortgageStateHistory entity

### Low Priority Entities (May not need tenant isolation)

- [ ] Evaluate RefreshToken entity
- [ ] Evaluate UserSuspension entity
- [ ] Evaluate PasswordResetToken entity
- [ ] Evaluate Settings entity
- [ ] Evaluate Amenity entity
- [ ] Evaluate BulkInviteTask entity

## Phase 3: Service Migration ⏳ TODO

### Core Services

- [ ] Update UserService to use TenantContextService
- [ ] Update PropertyService to use TenantContextService
- [ ] Update MortgageService to use TenantContextService
- [ ] Update TransactionService to use TenantContextService
- [ ] Update WalletService to use TenantContextService
- [ ] Update PaymentReconciliationService to filter by tenant
- [ ] Update MortgageFSMService to handle tenant context

### Supporting Services

- [ ] Update PropertyMediaService
- [ ] Update PropertyDocumentService
- [ ] Update MortgageDocumentService
- [ ] Update MortgageStepService
- [ ] Update MortgageTypeService
- [ ] Update MortgageDownpaymentService
- [ ] Update MortgageTransitionService
- [ ] Update RoleService
- [ ] Update PermissionService
- [ ] Update AmenityService

## Phase 4: Controller Migration ⏳ TODO

### Apply TenantGuard to Controllers

- [ ] UserController - Add @UseGuards(TenantGuard)
- [ ] PropertyController - Add @UseGuards(TenantGuard)
- [ ] MortgageController - Add @UseGuards(TenantGuard)
- [ ] TransactionController - Add @UseGuards(TenantGuard)
- [ ] WalletController - Add @UseGuards(TenantGuard)
- [ ] PropertyMediaController - Add @UseGuards(TenantGuard)
- [ ] PropertyDocumentController - Add @UseGuards(TenantGuard)
- [ ] MortgageDocumentController - Add @UseGuards(TenantGuard)
- [ ] MortgageStepController - Add @UseGuards(TenantGuard)
- [ ] MortgageTypeController - Add @UseGuards(TenantGuard)
- [ ] MortgageDownpaymentController - Add @UseGuards(TenantGuard)

### Exclude from TenantGuard (Public/Auth Routes)

- [ ] AuthController - Should NOT require tenant
- [ ] TenantController - Admin-only, special handling
- [ ] QrCodeController - Review if needs tenant guard

## Phase 5: Database Migration ⏳ TODO

- [ ] Generate migration: `npm run typeorm migration:generate -- -n AddTenantSupport`
- [ ] Review generated migration SQL
- [ ] Test migration on development database
- [ ] Backup production database
- [ ] Run migration on staging: `npm run typeorm migration:run`
- [ ] Verify staging database schema
- [ ] Create rollback plan
- [ ] Run migration on production: `npm run typeorm migration:run`

## Phase 6: Data Migration ⏳ TODO

- [ ] Create seed script for default tenant
- [ ] Identify existing data that needs tenant assignment
- [ ] Create data migration script
- [ ] Test data migration on development copy
- [ ] Assign all existing users to default tenant
- [ ] Assign all existing properties to default tenant
- [ ] Assign all existing mortgages to default tenant
- [ ] Verify data integrity after migration
- [ ] Test application with migrated data

## Phase 7: Testing ⏳ TODO

### Unit Tests

- [ ] Test TenantService CRUD operations
- [ ] Test TenantMiddleware tenant extraction
- [ ] Test TenantContextService methods
- [ ] Test TenantGuard validation
- [ ] Test TenantAwareRepository methods

### Integration Tests

- [ ] Test tenant creation flow
- [ ] Test tenant update flow
- [ ] Test tenant suspension/activation
- [ ] Test tenant deletion (cascade)

### E2E Tests

- [ ] Test user can only see their tenant's data
- [ ] Test user cannot access another tenant's data
- [ ] Test tenant switching via subdomain
- [ ] Test tenant switching via headers
- [ ] Test operations without tenant context
- [ ] Test operations with invalid tenant
- [ ] Test operations with suspended tenant
- [ ] Test cross-tenant data leakage prevention
- [ ] Test performance with multiple tenants
- [ ] Test concurrent requests from different tenants

## Phase 8: Security Review ⏳ TODO

- [ ] Review all queries for tenant filtering
- [ ] Verify no raw queries bypass tenant filter
- [ ] Check for potential cross-tenant data leaks
- [ ] Review admin routes for proper authorization
- [ ] Verify cascade deletes work correctly
- [ ] Test tenant isolation in relationships
- [ ] Review logs for sensitive tenant information
- [ ] Set up tenant-specific audit logging

## Phase 9: Performance Optimization ⏳ TODO

- [ ] Verify all tenantId columns are indexed
- [ ] Add composite indexes where needed (tenantId + other columns)
- [ ] Profile query performance with multiple tenants
- [ ] Consider database partitioning by tenantId
- [ ] Set up monitoring for slow queries
- [ ] Optimize N+1 queries with proper eager loading
- [ ] Test application with large number of tenants
- [ ] Set up tenant-specific caching strategy

## Phase 10: Documentation ⏳ TODO

- [ ] Update API documentation with tenant requirements
- [ ] Document tenant identification strategies
- [ ] Create tenant onboarding guide
- [ ] Create tenant migration guide for existing data
- [ ] Document admin operations for tenant management
- [ ] Create troubleshooting guide
- [ ] Update deployment documentation
- [ ] Create runbook for tenant-related issues

## Phase 11: Deployment ⏳ TODO

### Pre-deployment

- [ ] All tests passing
- [ ] Code review completed
- [ ] Database migration tested on staging
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Backup strategy confirmed

### Deployment Steps

- [ ] Deploy to staging environment
- [ ] Run smoke tests on staging
- [ ] Monitor staging for 24 hours
- [ ] Deploy to production (low traffic period)
- [ ] Run database migrations
- [ ] Verify all services healthy
- [ ] Run production smoke tests
- [ ] Monitor error rates
- [ ] Monitor performance metrics

### Post-deployment

- [ ] Verify tenant isolation working
- [ ] Check logs for errors
- [ ] Monitor query performance
- [ ] Verify data integrity
- [ ] Collect feedback from users
- [ ] Address any issues found

## Phase 12: Monitoring & Maintenance ⏳ TODO

- [ ] Set up tenant-specific metrics
- [ ] Monitor tenant growth
- [ ] Track tenant activity
- [ ] Monitor tenant-specific errors
- [ ] Set up alerts for tenant issues
- [ ] Regular security audits
- [ ] Regular performance reviews
- [ ] Plan for tenant data archival

## Known Issues / Technical Debt

- [ ] Some entities may still need migration to tenant-aware base classes
- [ ] Need to review and update all existing services
- [ ] Need to add TenantGuard to all controllers
- [ ] Database migrations need to be generated and tested
- [ ] Existing data needs tenant assignment
- [ ] Need comprehensive testing suite
- [ ] Need performance benchmarks with multiple tenants

## Quick Start for Next Steps

1. **Start with User entity migration**:

   ```typescript
   // Already done! ✅
   export class User extends TenantAwareBaseEntity {
   ```

2. **Update UserService**:

   ```typescript
   constructor(
       @InjectRepository(User) private userRepo: Repository<User>,
       private tenantContext: TenantContextService, // Add this
   ) { }
   ```

3. **Filter queries by tenant**:

   ```typescript
   async findAll() {
       const tenantId = this.tenantContext.requireTenantId();
       return this.userRepo.find({ where: { tenantId } });
   }
   ```

4. **Repeat for all entities and services**

---

**Current Status**: Phase 1 Complete ✅
**Next Action**: Begin Phase 2 - Entity Migration
**Priority**: High - Update core business entities first

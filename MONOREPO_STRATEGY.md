# Monorepo Structure (Temporary)

This root directory is a **temporary workspace** for development. Each module is designed to be **independently deployable** and will eventually be migrated to its own GitHub repository.

## Future Repository Structure

Each module will become its own repository:

```
GitHub Organization: real-estate-platform/
├── infrastructure          (AWS CDK stack)
├── user-service           (Auth, users, roles, permissions)
├── mortgage-service       (Mortgage workflows, payments)
├── property-service       (Property listings, media)
├── authorizer-service     (Lambda authorizer)
└── shared                 (Database entities, common utilities)
```

## Module Independence

Each module is **self-contained**:

- ✅ Own `package.json` with dependencies
- ✅ Own `tsconfig.json` for compilation
- ✅ Own build/deploy scripts
- ✅ Own README with setup instructions
- ✅ No dependencies on root-level files

## Current Structure

```
real-estate/ (temporary workspace - not for production)
├── infrastructure/         # Will become: github.com/org/infrastructure
├── services/
│   ├── user-service/      # Will become: github.com/org/user-service
│   ├── mortgage-service/  # Will become: github.com/org/mortgage-service
│   ├── property-service/  # Will become: github.com/org/property-service
│   └── authorizer-service/# Will become: github.com/org/authorizer-service
└── shared/                # Will become: github.com/org/shared
```

## Migration Path

When ready to split into separate repositories:

### 1. Create Repository for Each Module

```bash
# Example for infrastructure
cd infrastructure
git init
git remote add origin git@github.com:org/infrastructure.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 2. Update Infrastructure Service References

In `infrastructure/lib/real-estate-stack.ts`, change service paths:

```typescript
// Before (monorepo)
code: lambda.Code.fromAsset(path.join(__dirname, "../services/user-service"));

// After (separate repos - using git submodules or build artifacts)
code: lambda.Code.fromAsset(path.join(__dirname, "../dist/user-service"));
```

### 3. Shared Module Strategy

**Option A: NPM Package** (Recommended)

```bash
cd shared
npm publish @real-estate/shared
```

Then in services:

```json
{
  "dependencies": {
    "@real-estate/shared": "^1.0.0"
  }
}
```

**Option B: Git Submodule**

```bash
git submodule add git@github.com:org/shared.git shared
```

**Option C: Duplicate Code** (least preferred)

- Copy shared code into each service
- Maintain separately

### 4. CI/CD Pipeline

Each repository will have its own GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy Service
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm run deploy # Or trigger CDK deploy
```

## Why Separate Repositories?

1. **Independent Versioning**: Each service can version independently
2. **Access Control**: Different teams can own different services
3. **CI/CD Isolation**: Deploy one service without affecting others
4. **Cleaner History**: Git history focused on one service
5. **Smaller Clones**: Faster git operations
6. **Team Ownership**: Clear boundaries of responsibility

## Development Workflow (Current)

While in monorepo mode:

```bash
# Work on any service independently
cd services/user-service
npm install
npm run start:dev

# Deploy all services
cd infrastructure
cdk deploy
```

## Development Workflow (Future)

After migration to separate repos:

```bash
# Clone only what you need
git clone git@github.com:org/user-service.git
cd user-service
npm install
npm run start:dev

# Infrastructure team deploys all
git clone git@github.com:org/infrastructure.git
cd infrastructure
# Add service repos as submodules or reference build artifacts
cdk deploy
```

## Notes

- **No root package.json**: Each module manages its own dependencies
- **No root build**: Build happens per module
- **Infrastructure references services**: Uses relative paths (for now)
- **Shared module**: Will become npm package or git submodule

---

**Current Status**: ✅ All modules are independent and ready for repository split when needed.

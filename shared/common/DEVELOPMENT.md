# QShelter Common Package

Shared database schemas and utilities for QShelter services.

## Development Workflow

### After modifying the Prisma schema:

1. **Generate Prisma Client:**

   ```bash
   pnpm run generate:prisma
   ```

   This will:

   - Generate the Prisma Client
   - Automatically create/update `generated/client/models/index.ts`

2. **Build the package:**

   ```bash
   pnpm run build
   ```

3. **Publish (if needed):**
   ```bash
   pnpm run patch  # Increments version, builds, and publishes
   ```

### Running migrations:

For local development:

```bash
NODE_ENV=local pnpm run migrate:dev
```

## Scripts

- `generate:prisma` - Generate Prisma Client and models index
- `build` - Build TypeScript to dist/
- `migrate:dev` - Run Prisma migrations
- `patch` - Version bump, build, and publish
- `dev` - Watch mode for TypeScript compilation

## Automatic Index Generation

The `scripts/generate-models-index.mjs` script automatically creates an index file that exports all Prisma models. This runs automatically after `prisma generate`, ensuring that new models are immediately available for import.

## Usage in Services

After publishing a new version, update it in your service:

```bash
npm i @valentine-efagene/qshelter-common@latest
```

Or in a pnpm workspace, just run:

```bash
pnpm install
```

# LocalStack Integration Tests

**True end-to-end tests that run against deployed services via API endpoints only.**

This folder contains integration tests that treat the QShelter platform as a black box. Tests only interact with deployed services via HTTP APIs - no direct imports from services, no shared database connections.

## Philosophy

- **API-only**: Tests call REST endpoints, never import service code
- **Deployed services**: All services must be deployed to LocalStack before running
- **Real auth flow**: Tests use the actual authorizer, login, and get real JWTs
- **Isolated**: This folder has its own `package.json` - it's a separate project

## Prerequisites

1. **LocalStack running** with Docker Compose:

   ```bash
   cd local-dev && ./scripts/start.sh
   ```

2. **All services deployed** to LocalStack:

   ```bash
   ./scripts/deploy-all.sh
   ```

3. **Database migrated**:
   ```bash
   cd local-dev && ./scripts/migrate.sh
   ```

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suite
npm run test:full-mortgage

# Or use the full script (deploys + runs)
npm run run:full-e2e
```

## Environment Variables

The test runner script (`scripts/run-full-e2e-localstack.sh`) automatically fetches API Gateway URLs from LocalStack. Required environment variables:

| Variable                | Description                       | Auto-detected                     |
| ----------------------- | --------------------------------- | --------------------------------- |
| `USER_SERVICE_URL`      | User service API Gateway URL      | ✅                                |
| `PROPERTY_SERVICE_URL`  | Property service API Gateway URL  | ✅                                |
| `MORTGAGE_SERVICE_URL`  | Mortgage service API Gateway URL  | ✅                                |
| `DOCUMENTS_SERVICE_URL` | Documents service API Gateway URL | ✅                                |
| `BOOTSTRAP_SECRET`      | Secret for tenant bootstrap       | Default: `local-bootstrap-secret` |

## Test Suites

### Full Mortgage Flow (`full-mortgage-flow/`)

Complete end-to-end mortgage application flow:

1. **Tenant Bootstrap** - Create tenant, admin user, roles
2. **Property Setup** - Admin creates property with variants and units
3. **Payment Configuration** - Admin sets up payment plans and methods
4. **Customer Registration** - Chidi registers and logs in
5. **Application Creation** - Chidi applies for Unit 14B
6. **Document Upload** - Chidi uploads KYC documents
7. **Document Review** - Admin approves documents
8. **Downpayment** - Chidi pays 10% downpayment
9. **Mortgage Phase** - Chidi enters mortgage repayment phase

## Adding New Tests

1. Create a new folder under `tests/localstack/`
2. Add test files with `.test.ts` extension
3. Only use HTTP calls via `supertest` - no service imports
4. Document the test flow in a `SCENARIO.md` file

## Troubleshooting

### Services not found

```
❌ ERROR: Required services not deployed: user-service property-service
```

Deploy the missing services:

```bash
cd services/<service-name> && npm run deploy:localstack
```

### API Gateway returns 403

Check that the authorizer service is deployed:

```bash
cd services/authorizer-service && npm run deploy:localstack
```

### Database connection errors

Ensure LocalStack MySQL is running and migrated:

```bash
cd local-dev && ./scripts/start.sh && ./scripts/migrate.sh
```

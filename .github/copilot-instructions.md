# QShelter Platform - Development Guidelines

## Core Architecture

- **Multi-tenant SaaS platform** for real estate management with user authentication, property listings, mortgage/installment purchases, and document workflows.
- **Serverless-first architecture**: AWS Lambda functions behind API Gateway, deployed via Serverless Framework.
- **Database**: MySQL with Prisma ORM. Schema lives in `shared/common/prisma/schema.prisma`.
- **Local development**: LocalStack for AWS emulation, Docker Compose for MySQL.
- **Tech stack**: Node.js, TypeScript, Express, Prisma, Zod, AWS (Lambda, API Gateway, S3, SNS, SSM, Secrets Manager).

Note: **NEVER delete the CDKToolkit CloudFormation stack** — not manually, not from scripts, not from the deploy script. CDKToolkit is the CDK bootstrap stack that persists across deploy/teardown cycles. The `cdk bootstrap` command is idempotent and will recreate any missing resources (S3 bucket, IAM roles) without needing to destroy the stack. Only the `clean` step in deploy-staging.sh may touch it, and only when it's stuck in a bad state (REVIEW_IN_PROGRESS, ROLLBACK_COMPLETE).

**IMPORTANT - Database Migrations**: The local MySQL database is often not running. Always run Prisma migrations against the **AWS staging database** using:

```bash
./scripts/deploy-staging.sh migrations
```

This script handles fetching credentials from AWS Secrets Manager and running migrations against the staging RDS instance.

## Terinal

- Errors like this `The test was interrupted (exit code 130 — SIGINT) at Step 8 because my ps aux | grep command ran in the same terminal as the Playwright test, killing it. Step 8 wasn't a real failure — the test was waiting for getByLabel(/Category/i) when it got killed.` are a problem, and must be avoided. Don't inject commands in a way that they could break running tasks.

## Demo Frontend (`demo-frontend/`)

The demo-frontend is a **Next.js application** inside this monorepo (`demo-frontend/`) for interactively testing the QShelter API. It is hosted on **AWS Amplify** (see Post-Deployment Checklist for sync instructions).

- It imports `@valentine-efagene/qshelter-common` from the **npm registry** (not a workspace link).
- After backend deployments that change service URLs, you must sync env vars to Amplify and trigger a rebuild.

### Environment Targeting

| Context                                  | Backend Target                     | Config Source                 |
| ---------------------------------------- | ---------------------------------- | ----------------------------- |
| **Local development & Playwright tests** | LocalStack (`localhost:3001–3007`) | `demo-frontend/.env`          |
| **AWS Amplify hosted deployment**        | AWS staging (API Gateway URLs)     | Amplify environment variables |

- **`demo-frontend/.env`** contains `NEXT_PUBLIC_*_SERVICE_URL=http://localhost:300x` values pointing at the LocalStack environment. This is what `pnpm dev` and Playwright tests use.
- **AWS Amplify** has its own set of `NEXT_PUBLIC_*` env vars pointing at the real AWS API Gateway URLs. These are set via `aws amplify update-branch` and baked in at build time.
- When running Playwright E2E tests locally, the LocalStack services must be running (`cd local-dev && ./scripts/start.sh`).
- When deploying to Amplify, ensure the Amplify env vars are updated to match the current AWS staging URLs.

### Playwright Full Mortgage Flow Test (`demo-frontend/e2e/full-mortgage-flow.spec.ts`)

**This test is the canonical reference for the demo scenario.** It must be kept in sync with the app. Whenever you change the demo-frontend UI, update the Playwright test to match.

- The test does ALL setup through the UI (reset DB, bootstrap, create orgs, properties, plans, etc.) — it does **not** call the demo-bootstrap API.
- **Never replace the UI-driven setup with API calls.** The purpose is to exercise the admin UI end-to-end.
- Run with: `cd demo-frontend && BOOTSTRAP_SECRET=<secret> npx playwright test full-mortgage-flow --reporter=line`

**Key Demo Scenario (Emeka/Sunrise Heights Mortgage — canonical Playwright scenario):**

| Actor      | Role         | Email                | Description                   |
| ---------- | ------------ | -------------------- | ----------------------------- |
| **Adaeze** | Admin        | `adaeze@mailsac.com` | QShelter operations manager   |
| **Yinka**  | mortgage_ops | `yinka@mailsac.com`  | QShelter mortgage ops         |
| **Nneka**  | agent        | `nneka@mailsac.com`  | Lekki Gardens developer agent |
| **Eniola** | lender_ops   | `eniola@mailsac.com` | Access Bank loan officer      |
| **Emeka**  | Customer     | `emeka@mailsac.com`  | First-time homebuyer          |

**Property:** Sunrise Heights Estate, Unit A-201, ₦75M, MREIF 10/90 Mortgage (10% down, 5 phases)

> ⚠️ The Playwright test is the **single source of truth** for scenario details. All Postman examples and documentation must align with it.

## Development Philosophy

### No Backward Compatibility

We are in active development - **delete unused code, don't deprecate it**:

- When replacing a model or feature, **remove the old code entirely**
- Don't add `@deprecated` markers - just delete
- Don't retain old models/types/functions to "keep tests passing" - update the tests
- If tests fail after schema changes, fix the tests to use the new architecture
- The goal is a clean codebase, not a museum of old approaches
- Don't use the `head` command in bash. It conflicts with a PERL command, and the error just wastes time and tokens.
- Maximize token efficiency using compact commands and avoiding unnecessary output

## Shared Library (`@valentine-efagene/qshelter-common`)

- All entities, enums, types, and utilities must come from this published npm package.
- Frontend also imports this package—ensure all necessary types/enums are exported.
- **Never import directly from local paths or other services**. Always use the published package.
- After schema changes: `npm run generate:prisma` then `npm run patch` to publish.
- IMPORTANT (publish): When publishing is needed, run `npm run patch` in the **interactive terminal** (not via a tool). npm OTP prompts require an interactive session — running it through a tool will hang waiting for OTP input. Paste the command into the terminal directly and let the user approve the OTP email link. Do NOT skip publishing because of OTP concerns.
- Services must update to the latest version after publishing: `npm i @valentine-efagene/qshelter-common@latest`.
- **CRITICAL — Always publish before deploying**: When you change code in `shared/common/`, you **must** publish a new version (`npm run patch`) and update the consuming services (`npm i @valentine-efagene/qshelter-common@latest`) **before** deploying those services. Services resolve `@valentine-efagene/qshelter-common` from the npm registry at build time, not from the local workspace. If you skip publishing, the deployed Lambda will run with the **old** version of the common package. Never use workspace links, `file:` references, or local path imports as a shortcut — the published npm package is the only source of truth.
- Husky errors seem to be wasting tokens. Remove all husky settings and scripts to avoid this issue. The token cost of husky errors is not worth the benefit of pre-commit hooks in this case.
- Whenever I ask to teardown the aws infrastructure, I mean everything, especially the database. The database is the most expensive part to maintain, and we want to avoid unnecessary costs. Please use the teardown script that handles everything properly, rather than manually deleting stacks or resources in the AWS console.
- I like the full mortgage flow to have a counterpart playwright test, so we have a matching front end and backend test for the same scenario. This way we can ensure that the API documentation and the actual API implementation remain in sync, and we have both an API-level test and a UI-level test for the critical mortgage flow scenario.

## Service Structure

```
services/
├── documents-service/      # Document storage and presigned URLs
├── mortgage-service/       # Applications, phases, payments, documents
├── notification-service/   # Email/SMS notifications via SNS
├── payment-service/        # Payment processing
├── property-service/       # Property listings and units
├── uploader-service/       # File upload via presigned S3 URLs
└── user-service/           # User management and authentication
```

### Authentication Architecture

Auth is handled by **JWT verification in shared Express middleware** — there is no Lambda authorizer or DynamoDB policy store:

- Each service calls `setupAuth()` at Lambda cold start to fetch the JWT secret from Secrets Manager
- The `extractAuthContext()` middleware verifies the JWT signature and extracts `userId`, `tenantId`, `email`, `roles`
- Role-based access control uses `requireRole()`, `requireAdmin()`, `isAdmin()` from the shared middleware
- Flow: `Client → Bearer token → Express middleware (JWT verify) → Route handler`

## Multi-Tenancy

- All data is isolated by tenant using `tenantId`.
- Use `createTenantPrisma()` wrapper from `shared/common/src/prisma/tenant.ts` for automatic tenant filtering.
- **When adding a new model with `tenantId`**: Add its name (camelCase) to `TENANT_SCOPED_MODELS` array.
- Models with optional `tenantId` (e.g., global templates): Add to `OPTIONAL_TENANT_MODELS`.
- User model is NOT tenant-scoped (users can exist across tenants).

## Organizations

Each tenant has organizations representing different parties in property transactions.

### Organization Types (Dynamic Lookup Table)

Organization types are stored in the `OrganizationType` model (tenant-scoped):

| Code         | Description                                                       | Example             |
| ------------ | ----------------------------------------------------------------- | ------------------- |
| `PLATFORM`   | The tenant's own organization (marked with `isPlatformOrg: true`) | QShelter            |
| `BANK`       | Financial institutions providing mortgages                        | Access Bank         |
| `DEVELOPER`  | Property developers                                               | Lekki Gardens       |
| `LEGAL`      | Legal firms for conveyancing                                      | Ade & Co Solicitors |
| `INSURER`    | Insurance companies                                               | AIICO               |
| `GOVERNMENT` | Government agencies                                               | Lagos Land Registry |

**Many-to-Many Relationship**: Organizations can have multiple types via `OrganizationTypeAssignment`:

- QShelter can be both `PLATFORM` and `DEVELOPER`
- Each assignment has an `isPrimary` flag for the primary type

**System Organization Types**: Seeded at bootstrap via `SYSTEM_ORGANIZATION_TYPES` constant in bootstrap.service.ts.

### Key Design Decisions

- **No role on OrganizationMember**: Abilities are defined via RBAC roles, not organization membership
- **No canApprove/approvalLimit on OrganizationMember**: Authorization handled by RBAC permissions
- **organizationTypeCode in API payloads**: Resolved to `organizationTypeId` (FK) for storage
- **Customer reviews**: Use `organizationId = null` with `organizationTypeId` still set for type context

### Organization Endpoints

```
POST /organizations
  Body: { name, typeCodes: ['PLATFORM', 'DEVELOPER'], primaryTypeCode?, ... }

GET /organizations?typeCode=BANK
  Filter by organization type code
```

- Platform organization employees (like Adaeze, the operations manager) are linked via `OrganizationMember`.
- External partners (banks, developers) are also organizations with their own members.

## RBAC Roles

Roles define what a person can DO in the system, independent of which organization they belong to.

### System Roles (Seeded at Bootstrap)

| Role           | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `admin`        | Full administrative access to all resources                    |
| `user`         | Basic user - property browsing, own applications, profile      |
| `mortgage_ops` | Mortgage operations - manage applications, phases, payments    |
| `finance`      | Finance team - payments, refunds, financial reports            |
| `legal`        | Legal team - documents, terminations, compliance               |
| `agent`        | Real estate agent - manage properties, listings, sales docs    |
| `lender_ops`   | Lender operations - mortgage preapprovals, offers, doc reviews |

### Key Design Principle: Roles ≠ Organization Types

**Organization types** (PLATFORM, BANK, DEVELOPER) describe WHAT the organization IS.
**Roles** (admin, agent, lender_ops) describe WHAT a person can DO.

A staff member at Lekki Gardens (a DEVELOPER organization) would have:

- OrganizationMember link to Lekki Gardens (organization membership)
- `agent` role (can manage properties)
- Optionally `admin` role for full organization admin rights

A loan officer at Access Bank (a BANK organization) would have:

- OrganizationMember link to Access Bank (organization membership)
- `lender_ops` role (can manage mortgage documents)
- Optionally `mortgage_ops` for application management

**Wrong**: Creating roles named "DEVELOPER" or "LENDER" - these are organization types!
**Correct**: Using roles like `agent`, `lender_ops`, `mortgage_ops` that describe job functions.

### Role Assignment

- New users signing up get `user` role by default
- New organization members also get `user` role by default
- Additional roles (agent, mortgage_ops, etc.) are assigned by admins via `TenantMembership`
- Organization type does NOT automatically determine role

## Stage-Based Document Review

Documents go through sequential approval stages, where each stage is responsible for reviewing documents from specific uploaders:

```typescript
// Configure approval stages in documentation plans
{
    name: 'Mortgage KYC Documentation',
    approvalStages: [
        {
            name: 'QShelter Staff Review',
            order: 1,
            organizationTypeCode: 'PLATFORM',  // Reviews CUSTOMER and PLATFORM uploads
            autoTransition: false,
            waitForAllDocuments: true,
            onRejection: 'CASCADE_BACK',
            slaHours: 24,
        },
        {
            name: 'Bank Review',
            order: 2,
            organizationTypeCode: 'BANK',  // Reviews LENDER uploads (auto-approved)
            autoTransition: true,
            waitForAllDocuments: true,
            slaHours: 48,
        },
    ],
}
```

### Stage Organization Type to Uploader Mapping

| Stage Organization Type | Reviews Documents Uploaded By |
| ----------------------- | ----------------------------- |
| PLATFORM                | CUSTOMER, PLATFORM            |
| BANK                    | LENDER                        |
| DEVELOPER               | DEVELOPER                     |
| LEGAL                   | LEGAL                         |
| INSURER                 | INSURER                       |
| GOVERNMENT              | GOVERNMENT                    |

### Auto-Approval Behavior

When a document is uploaded by a party that matches the current stage's organization type, the document is **automatically approved**. This is by design: uploaders don't need to review their own documents.

Example: When a lender uploads a preapproval letter during the BANK stage, it's auto-approved.

### Review API

**Endpoint:** `POST /applications/:id/documents/:documentId/review`

```json
{
  "status": "APPROVED",
  "organizationTypeCode": "PLATFORM",
  "comment": "Document verified"
}
```

- `status`: APPROVED, REJECTED, or CHANGES_REQUESTED
- `organizationTypeCode`: Must match the current active stage's organization type
- `ReviewDecision`: PENDING, APPROVED, REJECTED, CHANGES_REQUESTED, WAIVED

## Application Flow (Loan Origination System)

Applications progress through configurable phases:

1. **QUESTIONNAIRE** phases: Collect customer information, calculate eligibility
2. **DOCUMENTATION** phases: Document upload, review, and approval workflows
3. **PAYMENT** phases: Downpayment, installments, or mortgage payments

Phases are configured via `PaymentMethod` linked to properties. Each phase references a plan template:

- `QuestionnairePlan` → Defines questions and scoring rules
- `DocumentationPlan` → Defines required documents and review requirements
- `PaymentPlan` → Defines payment schedule and terms

## Testing

There are two types of tests:

### Service E2E Tests (`services/<service>/tests/e2e/`)

- Run directly against the service code (no deployment needed)
- Can use direct database access via Prisma for setup/verification
- Use named actors with realistic Nigerian contexts
- Run with: `npm run test:e2e:chidi` or `npm run test:e2e:amara`

### LocalStack Integration Tests (`tests/localstack/`)

- **True end-to-end tests** that run against deployed services
- **API-only**: Only call REST endpoints, never import service code
- Has its own `package.json` - treated as a separate project
- Requires all services deployed to LocalStack first
- Tests real auth flow with JWT tokens via shared middleware

```bash
# Deploy all services to LocalStack
cd tests/localstack && ./scripts/deploy-all.sh

# Run integration tests
cd tests/localstack && npm run run:full-e2e
```

### AWS Staging Full E2E Tests (`tests/aws/full-mortgage-flow/`)

- **True end-to-end tests** against deployed AWS staging services
- **API-only**: Only calls REST endpoints via HTTP, no direct database access
- Tests the complete Emeka/Sunrise Heights mortgage flow scenario (mirrors the Playwright test)
- Run with: `cd tests/aws && ./scripts/run-full-e2e-staging.sh`

**API Documentation:**

- **PDF**: `tests/aws/full-mortgage-flow/MORTGAGE_FLOW_API_DOCUMENTATION.pdf`
- **Markdown**: `tests/aws/full-mortgage-flow/MORTGAGE_FLOW_API_DOCUMENTATION.md`

This documentation describes the complete API flow with endpoints, payloads, and responses for each step of the mortgage journey. Share the PDF with the team for onboarding.

To regenerate the PDF after changes:

```bash
cd tests/aws/full-mortgage-flow
npx md-to-pdf MORTGAGE_FLOW_API_DOCUMENTATION.md
```

**IMPORTANT**: This test mirrors the Playwright test (`demo-frontend/e2e/full-mortgage-flow.spec.ts`). When making changes to either test, ensure they remain synchronized:

- Same business flow and phases
- Same actor names (Adaeze as admin, Emeka as customer, Yinka/Nneka/Eniola as staff)
- Same property details (Sunrise Heights Estate, ₦75M, MREIF 10/90 mortgage)
- AWS test uses HTTP APIs only; Playwright test exercises the full UI

### Incremental Debug Tests (`tests/aws/incremental-debug/`)

- **Step-by-step debugging tests** that mirror the Postman collection flow
- Useful for debugging API issues before running in Postman
- Each step can be run in isolation using Jest test patterns

```bash
# Run all steps
cd tests/aws && ./scripts/run-incremental-debug.sh

# Run specific steps
./scripts/run-incremental-debug.sh "Step 1"           # Reset & Bootstrap
./scripts/run-incremental-debug.sh "Step 1|Step 2"    # Multiple steps
./scripts/run-incremental-debug.sh "Step 3"           # Organizations
```

### Generating PDF Documentation from Tests

We use `md-to-pdf` to generate beautiful PDF documentation from Markdown files. The PDF documents serve as the **official API documentation** for the team.

**Prerequisites:**

```bash
# md-to-pdf is installed automatically via npx (no global install needed)
```

**Regenerating PDFs:**

| Test Suite         | Command                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| Full Mortgage Flow | `cd tests/aws/full-mortgage-flow && npx md-to-pdf MORTGAGE_FLOW_API_DOCUMENTATION.md` |

**When to regenerate:**

- After modifying test steps or adding new phases
- After changing endpoint paths or request/response formats
- Before sharing documentation with new team members
- After any API schema changes

**Documentation files location:**

```
tests/aws/full-mortgage-flow/
├── MORTGAGE_FLOW_API_DOCUMENTATION.md    # Source (edit this)
├── MORTGAGE_FLOW_API_DOCUMENTATION.pdf   # Generated PDF (share this)
└── MORTGAGE_FLOW_API_DOCUMENTATION.html  # HTML version (optional)
```

**Tips for maintaining documentation:**

1. Always edit the `.md` file, never the PDF directly
2. Regenerate PDF after any changes to the Markdown
3. Commit both `.md` and `.pdf` files to the repository
4. The PDF should match the actual test implementation

## Scenario-Based Development

- Document features as **scenario flows** in `docs/` folder before coding.
- Scenarios use concrete narratives with named actors, specific properties, and realistic terms.
- E2E tests implement these scenarios directly.
- Key scenario docs:
  - `docs/SIMPLIFIED_LOS_FLOW.md` - Core mortgage/purchase flow
  - `docs/PROPERTY_TRANSFER_SCENARIO.md` - Unit transfers
  - `docs/INSTALLMENT_PAYMENT_SCENARIO.md` - Installment purchases

## API Documentation

- Zod schemas generate OpenAPI/Swagger docs automatically.
- Keep Postman collection (`postman/QShelter-API.postman_collection.json`) up to date.
- Keep Postman environments updated:
  - `postman/QShelter-Local.postman_environment.json` - LocalStack URLs
  - `postman/QShelter-AWS-Staging.postman_environment.json` - AWS staging URLs
- New endpoints need both Zod validation and Postman examples.

### Postman Examples — Emeka/Sunrise Heights Mortgage Scenario

**All Postman request examples must align with the Playwright canonical scenario** defined in:

- `demo-frontend/e2e/full-mortgage-flow.spec.ts` - Canonical Playwright test (source of truth)
- `docs/FULL_E2E_MORTGAGE_FLOW.md` - API-level documentation of the same scenario

**Actors (use these in all examples):**

| Actor      | Role         | Email                | Description                   |
| ---------- | ------------ | -------------------- | ----------------------------- |
| **Adaeze** | Admin        | `adaeze@mailsac.com` | QShelter operations manager   |
| **Yinka**  | mortgage_ops | `yinka@mailsac.com`  | QShelter mortgage operations  |
| **Nneka**  | agent        | `nneka@mailsac.com`  | Lekki Gardens developer agent |
| **Eniola** | lender_ops   | `eniola@mailsac.com` | Access Bank loan officer      |
| **Emeka**  | Customer     | `emeka@mailsac.com`  | First-time homebuyer          |

**Property Details:**

- **Property**: Sunrise Heights Estate
- **Unit**: A-201
- **Price**: ₦75,000,000 (NGN)
- **Variant**: 3-Bedroom Luxury Apartment

**Payment Structure (MREIF 10/90 Mortgage):**

- Phase 1: Prequalification (QUESTIONNAIRE)
- Phase 2: Sales Offer (DOCUMENTATION)
- Phase 3: KYC Documentation (DOCUMENTATION)
- Phase 4: 10% Downpayment (₦7,500,000) (PAYMENT)
- Phase 5: Mortgage Offer (DOCUMENTATION)

**Organizations:**

| Name            | Type      | Email                      |
| --------------- | --------- | -------------------------- |
| QShelter        | PLATFORM  | `support@mailsac.com`      |
| Access Bank PLC | BANK      | `mortgages@mailsac.com`    |
| Lekki Gardens   | DEVELOPER | `lekkigardens@mailsac.com` |

**All email addresses must use `@mailsac.com` domain** for testable email verification.

### Postman Variable Format

**Main request bodies should use `{{variableName}}` format** for configurable values:

```json
{
  "name": "Access Bank PLC",
  "type": {{organizationType}},
  "email": "{{organizationEmail}}",
  "propertyUnitId": "{{propertyUnitId}}",
  "totalAmount": {{totalAmount}}
}
```

**Rules:**

- Use `{{variable}}` (no quotes) for non-string values (numbers, enums, booleans)
- Use `"{{variable}}"` (with quotes) for string values
- Main requests use variables; saved example responses use hardcoded scenario values
- Variable names should be descriptive: `{{organizationType}}` not `{{type}}`

### Swagger UI in Serverless

**Do NOT use `swagger-ui-express` package** - it requires bundling large static assets that don't work well in Lambda.

Instead, use the CDN-based approach that serves HTML loading Swagger UI from unpkg:

```typescript
// Serve Swagger UI using CDN (works in serverless)
app.get("/api-docs", (_req, res) => {
  const openApiDocument = generateOpenAPIDocument();
  const specJson = JSON.stringify(openApiDocument);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation - Service Name</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            const url = new URL(window.location.href);
            const basePath = url.pathname.replace(/\\/api-docs\\/?$/, '');
            const currentPath = url.origin + basePath;
            
            const specString = ${JSON.stringify(specJson)};
            const spec = JSON.parse(specString);
            
            if (spec.servers && spec.servers[0]) {
                spec.servers[0].url = currentPath;
            }
            
            window.ui = SwaggerUIBundle({
                spec: spec,
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [SwaggerUIBundle.presets.apis]
            });
        };
    </script>
</body>
</html>`;
  res.send(html);
});
```

This approach:

- Loads CSS/JS from unpkg CDN (no bundling needed)
- Embeds the OpenAPI spec directly in the HTML
- Dynamically sets the server URL based on the current origin

**CRITICAL Implementation Notes:**

1. **Regex escaping**: The regex `/\\/api-docs\\/?$/` uses double backslashes because it's inside a template literal. Single backslashes will break the JavaScript in the browser (blank page).

2. **JSON embedding**: Use `${JSON.stringify(specJson)}` to safely embed the JSON string. Do NOT use `.replace(/"/g, '\\"')` - this causes double-escaping and breaks JSON.parse.

3. **No redirects**: Do NOT add redirect logic like `if (!req.originalUrl.endsWith('/')) return res.redirect(...)`. The redirected URL with trailing slash will hit the `/{proxy+}` route which requires authorization.

4. **Both routes**: Define handlers for both `/api-docs` and `/api-docs/` to handle both cases:

   ```typescript
   app.get("/api-docs", (req, res) => res.send(getSwaggerHtml()));
   app.get("/api-docs/", (req, res) => res.send(getSwaggerHtml()));
   ```

5. **serverless.yml**: List `/api-docs` as a public route:
   ```yaml
   - httpApi:
       path: /api-docs
       method: GET
   ```

## Deployment

### AWS Staging Deployment

Use the deployment script for seamless AWS deployment:

```bash
# Full deployment (recommended for first time or after teardown)
./scripts/deploy-staging.sh all

# Individual steps
./scripts/deploy-staging.sh clean      # Clean orphaned CDK resources
./scripts/deploy-staging.sh bootstrap  # Bootstrap CDK
./scripts/deploy-staging.sh infra      # Deploy infrastructure
./scripts/deploy-staging.sh migrations # Run Prisma migrations
./scripts/deploy-staging.sh services   # Deploy all services
```

### Teardown

```bash
./scripts/teardown-staging.sh  # Requires typing "DELETE staging" to confirm
```

### Critical Deployment Learnings

**CDK Bootstrap Failures:**

- CDK bootstrap can fail if orphaned resources exist from previous failed deployments
- Orphaned S3 bucket: `cdk-hnb659fds-assets-{account}-{region}` (versioned, needs special deletion)
- Orphaned IAM role: `cdk-hnb659fds-cfn-exec-role-{account}-{region}`
- CDKToolkit stack can get stuck in `REVIEW_IN_PROGRESS` state
- **Solution**: Run `./scripts/deploy-staging.sh clean` before bootstrap

**CloudFormation Limitations:**

- CloudFormation does NOT support creating SSM `SecureString` parameters
- Use Secrets Manager instead for sensitive configuration
- The CDK stack stores sensitive config in `qshelter/{stage}/notification-config` secret

**Service Deployment Order:**

1. `user-service` - Must be first, creates the HTTP API Gateway, stores ID in `/qshelter/{stage}/http-api-id`
2. All other services attach to the existing HTTP API

**Database Access:**

- RDS is publicly accessible but protected by security group
- The deploy script automatically adds your IP to the security group for migrations
- DATABASE_URL is constructed from Secrets Manager credentials
- The database is serverless, and will pause after inactivity. First connection may take 30-60 seconds.

**SSM Parameter Pagination (CRITICAL):**

- ConfigService MUST paginate through SSM parameters using `do...while (nextToken)` loop
- Default MaxResults is 10, but we have 20+ parameters
- Fixed in @valentine-efagene/qshelter-common@2.0.131
- Without pagination, services fail with missing config errors

**Database Secret IAM Permissions:**

- CDK auto-generates secret names like `RealEstateStackstagingAuror-HXRnyq4N3o9I`
- This does NOT match the wildcard `qshelter/{stage}/*` in IAM policies
- **Solution**: Add explicit permission using SSM reference in serverless.yml:
  ```yaml
  - ${ssm:/qshelter/${self:provider.stage}/database-secret-arn}
  ```

**AWS Profile Conflicts:**

- Serverless Framework may use different AWS credentials than AWS CLI
- Always use `AWS_PROFILE=default` when deploying services
- Check with `aws sts get-caller-identity` to verify correct account

**Health Endpoint Routing:**

- All services should expose `/health` at the root (not prefixed)
- Add explicit route in serverless.yml:
  ```yaml
  - httpApi:
      path: /health
      method: GET
  ```

**esbuild Configuration:**

- Output must match serverless.yml handler path exactly
- Use `outfile: 'dist/lambda.mjs'` with handler `dist/lambda.handler`
- External dependencies: `@prisma/client`, `@aws-sdk/*`
- Include banner for CommonJS compatibility in ESM modules

### SSM Parameters Reference

| Parameter                                | Created By   | Description                            |
| ---------------------------------------- | ------------ | -------------------------------------- |
| `/qshelter/{stage}/database-secret-arn`  | CDK          | Secrets Manager ARN for DB credentials |
| `/qshelter/{stage}/db-host`              | CDK          | Aurora MySQL endpoint                  |
| `/qshelter/{stage}/db-port`              | CDK          | Database port (3306)                   |
| `/qshelter/{stage}/db-security-group-id` | CDK          | RDS security group ID                  |
| `/qshelter/{stage}/http-api-id`          | user-service | HTTP API Gateway ID                    |
| `/qshelter/{stage}/s3-bucket-name`       | CDK          | Uploads S3 bucket                      |

### Post-Deployment Checklist

After every AWS deployment, you MUST:

1. **Update Postman environment file** (`postman/QShelter-AWS-Staging.postman_environment.json`):
   - Update all service URLs from CloudFormation outputs
   - Get bootstrap secret from SSM if changed
2. **Update `DEPLOYMENT_STATUS.md`**:
   - New endpoint URLs
   - Package sizes
   - Health check status
   - Deployment date

3. **Verify health endpoints**:

   ```bash
   curl -s https://<user-service-url>/health
   curl -s https://<property-service-url>/health
   # ... all services
   ```

4. **Update `demo-frontend/.env`** with new service URLs and **sync to Amplify**:
   - Update all `NEXT_PUBLIC_*_SERVICE_URL` variables in `demo-frontend/.env`
   - Sync to Amplify and trigger a rebuild (see [Demo Frontend → AWS Amplify Hosting](#aws-amplify-hosting)):

   ```bash
   # Get all new service URLs
   for service in user property mortgage documents payment notification uploader; do
     echo "NEXT_PUBLIC_${service^^}_SERVICE_URL=$(cd services/${service}-service && npx serverless info --stage staging 2>/dev/null | grep -o 'https://[^ ]*')"
   done

   # Update Amplify env vars (replace <APP_ID> and <BRANCH> with actual values)
   aws amplify update-branch \
     --app-id <APP_ID> \
     --branch-name <BRANCH> \
     --environment-variables \
       NEXT_PUBLIC_USER_SERVICE_URL=https://<url>,\
       NEXT_PUBLIC_PROPERTY_SERVICE_URL=https://<url>,\
       NEXT_PUBLIC_MORTGAGE_SERVICE_URL=https://<url>,\
       NEXT_PUBLIC_DOCUMENTS_SERVICE_URL=https://<url>,\
       NEXT_PUBLIC_PAYMENT_SERVICE_URL=https://<url>,\
       NEXT_PUBLIC_NOTIFICATION_SERVICE_URL=https://<url>,\
       NEXT_PUBLIC_UPLOADER_SERVICE_URL=https://<url>,\
       NEXT_PUBLIC_GOOGLE_CLIENT_ID=<client-id>

   # Trigger rebuild (NEXT_PUBLIC_* vars are inlined at build time)
   aws amplify start-job --app-id <APP_ID> --branch-name <BRANCH> --job-type RELEASE
   ```

### Postman Environments

Two environment files exist:

| Environment | File                                                    | Purpose             |
| ----------- | ------------------------------------------------------- | ------------------- |
| LocalStack  | `postman/QShelter-Local.postman_environment.json`       | Local development   |
| AWS Staging | `postman/QShelter-AWS-Staging.postman_environment.json` | AWS staging testing |

**After deployment**, update the AWS Staging environment with new URLs:

```bash
# Get all service endpoints from CloudFormation
aws cloudformation describe-stacks --stack-name qshelter-user-service-staging \
  --query "Stacks[0].Outputs[?contains(OutputKey, 'HttpApiUrl')].OutputValue" --output text

# Or use serverless info
cd services/user-service && npx serverless info --stage staging
```

**Variables to populate after bootstrap**:

- `tenantId` - From bootstrap response
- `adminUserId` - From bootstrap response
- `accessToken` - From /auth/login response
- `bootstrapSecret` - From SSM: `aws ssm get-parameter --name /qshelter/staging/bootstrap-secret --with-decryption`

## Code Style

- Structure code into modules.
- Use TypeScript features (interfaces, types, generics) effectively.
- Don't add `.js` extensions to import statements.
- Production-ready code: proper error handling, logging, security.
- All authorization via API Gateway Lambda authorizer—services trust the authorizer.
- File uploads use presigned S3 URLs (backend generates, frontend uploads directly).

## API Documentation (Swagger/OpenAPI)

**IMPORTANT**: When adding new API endpoints, always update the OpenAPI/Swagger documentation.

Each service has its own Swagger configuration in `src/config/swagger.ts`. When adding a new endpoint:

1. **Add Zod schema with `.openapi()`**: In the validator file, ensure the schema has `.openapi('SchemaName')` call.
2. **Register the path**: In `swagger.ts`, add a `registry.registerPath({...})` call with:
   - `method`: HTTP method (get, post, put, delete)
   - `path`: Route path with parameters like `{id}`
   - `tags`: Array of tag names (e.g., `['Application Phases']`)
   - `summary`: Brief description
   - `description`: Detailed description of behavior
   - `security`: Auth requirements (usually `[{ bearerAuth: [] }]`)
   - `request.params/body`: Zod schemas for request validation
   - `responses`: Status codes with descriptions and schemas

Example:

```typescript
registry.registerPath({
  method: 'post',
  path: '/applications/{id}/phases/{phaseId}/reopen',
  tags: ['Application Phases'],
  summary: 'Reopen a completed phase',
  description: 'Detailed description of what this endpoint does...',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string(), phaseId: z.string() }),
    body: { content: { 'application/json': { schema: ReopenPhaseSchema } } },
  },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: z.object({...}) } } },
    400: { description: 'Bad request' },
    403: { description: 'Forbidden' },
  },
});
```

**Viewing docs**: Each service exposes `/api-docs` for Swagger UI and `/openapi.json` for the raw spec.

## Common Commands

```bash
# Local development
cd local-dev && ./scripts/start.sh

# Generate Prisma client after schema changes
cd shared/common && npm run generate:prisma

# Publish common package
cd shared/common && npm run patch

# Update service to latest common
cd services/mortgage-service && npm i @valentine-efagene/qshelter-common@latest

# Run migrations
cd shared/common && npx prisma migrate dev --name <migration_name>

# Run E2E tests
cd services/mortgage-service && npm run test:e2e:chidi
cd services/mortgage-service && npm run test:e2e:amara
```

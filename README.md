# QShelter API Monorepo

Backend monorepo for QShelter, a multi-tenant real-estate platform.

## What this contains

```
api/
├── services/               # Lambda-backed microservices
├── shared/common/          # Shared package (@valentine-efagene/qshelter-common)
├── infrastructure/         # CDK stacks (AWS + LocalStack)
├── local-dev/              # LocalStack + Docker MySQL tooling
├── tests/                  # AWS and LocalStack integration/e2e tests
├── postman/                # Postman collection + environments
└── docs/                   # Scenario docs and architecture docs
```

## Services

- `user-service`
- `property-service`
- `mortgage-service`
- `documents-service`
- `payment-service`
- `notification-service`
- `uploader-service`

## Architecture summary

- Serverless-first: API Gateway + AWS Lambda (Express)
- Database: Aurora MySQL (Prisma)
- Auth: JWT verification in shared middleware (no Lambda authorizer)
- Multi-tenancy: tenant-scoped data with shared tenant-aware Prisma utilities
- Events: SNS/SQS orchestration between services

## Quick start

### LocalStack environment

```bash
cd local-dev
./scripts/start.sh
```

### AWS staging deploy

```bash
cd scripts
./deploy-staging.sh all
```

### Teardown staging (destructive)

```bash
cd scripts
./teardown-staging.sh
```

## Common workflows

### Publish shared package changes

```bash
cd shared/common
npm run generate:prisma
npm run patch
```

Then update consuming services to latest `@valentine-efagene/qshelter-common` and regenerate lockfile from `api/` root.

### Run key tests

```bash
# LocalStack integration tests
cd tests/localstack
npm run run:full-e2e

# AWS full mortgage flow API test
cd tests/aws
./scripts/run-full-e2e-staging.sh
```

## Documentation

Root-level documentation markdown files have been consolidated into this README.

Use these maintained sources:

- Product and scenario docs: `docs/`
- Infrastructure docs: `infrastructure/README.md`
- Local development docs: `local-dev/README.md`
- Postman docs: `postman/README.md`

## Notes

- Always work from `api/` as the backend project root.
- Prefer service deploy scripts (`npm run deploy:staging` / `npm run deploy:localstack`) over raw `npx sls deploy`.
- After backend URL changes, sync `demo-frontend/.env` and Amplify env vars.
- [ ] CloudFront CDN
- [ ] Custom domain + ACM certificates
- [ ] Multi-region deployment
- [ ] Service mesh (App Mesh)
- [ ] Observability (X-Ray tracing)
- [ ] WAF rules
- [ ] Automated backups

## Contributing

Each module can be developed independently:

1. Make changes in respective service/module
2. Test locally
3. Build: `npm run build`
4. Deploy: `cd infrastructure && cdk deploy`

## License

MIT

## Support

- Infrastructure issues: Check [infrastructure/README.md](infrastructure/README.md)
- Service issues: Check respective service README
- Deployment: Use [`scripts/deploy-staging.sh`](scripts/deploy-staging.sh)

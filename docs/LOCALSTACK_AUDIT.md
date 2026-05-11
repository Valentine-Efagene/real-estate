# LocalStack Environment Audit

> Audited: May 11, 2026

---

## Critical Issues

- [x] ~~**`event-bus-name` vs `eventbridge-bus-name` SSM key mismatch**~~
  - `localstack-stack.ts` creates: `/qshelter/${stage}/event-bus-name`
  - `config.service.ts` (`getInfrastructureConfig`) reads: `/qshelter/${stage}/eventbridge-bus-name`
  - `real-estate-stack.ts` correctly creates: `/qshelter/${stage}/eventbridge-bus-name`
  - **Fix**: In `infrastructure/lib/localstack-stack.ts` line ~220, rename `event-bus-name` → `eventbridge-bus-name`
  - **Impact**: `getInfrastructureConfig()` throws on any service that calls it in LocalStack

- [x] ~~**Missing `encryption` Secrets Manager secret in LocalStack CDK**~~
  - AWS CDK creates: `qshelter/${stage}/encryption`
  - LocalStack CDK does not create this secret
  - `config.service.ts` has `getEncryptionSecrets()` pointing to this name
  - **Fix**: Add `encryption` secret to `infrastructure/lib/localstack-stack.ts` using values from `local-dev/.env` (`ENCRYPTION_PASSWORD`, `ENCRYPTION_SALT`)
  - **Impact**: Any service calling `getEncryptionSecrets()` will fail (latent — no service currently calls it)

---

## Route Gaps (LocalStack configs missing routes vs AWS configs)

- [x] ~~**`property-service` serverless.localstack.yml has stale routes**~~
  - Has `/api` and `/api-json` (old NestJS era) instead of `/api-docs` and `/openapi.json`
  - **Fix**: Replace `/api` + `/api-json` with `/api-docs` + `/openapi.json` in `services/property-service/serverless.localstack.yml`

- [x] ~~**`mortgage-service` serverless.localstack.yml has stale routes**~~
  - Has `/api` and `/api-json` (old NestJS era) instead of `/api-docs` and `/openapi.json`
  - **Fix**: Replace `/api` + `/api-json` with `/api-docs` + `/openapi.json` in `services/mortgage-service/serverless.localstack.yml`

- [x] ~~**`payment-service` serverless.localstack.yml missing `/api-docs` and `/openapi.json`**~~
  - **Fix**: Add `/api-docs` and `/openapi.json` routes to `services/payment-service/serverless.localstack.yml`

- [ ] **`user-service` serverless.localstack.yml missing explicit public routes**
  - Missing: `/auth/{proxy+}`, `/admin/bootstrap-tenant`, `/admin/bootstrap-tenant/{proxy+}`, `/admin/demo-bootstrap`, `/admin/demo-bootstrap/{proxy+}`, `/admin/public/{proxy+}`, `/invitations/accept`
  - Note: All are covered by `/{proxy+}` catch-all so functionality is unaffected; this is a parity/documentation gap only

---

## Environment Variable Gaps (LocalStack configs vs AWS configs)

- [x] ~~**`user-service` missing Google OAuth and service-to-service URL env vars**~~
  - Missing: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `PROPERTY_SERVICE_URL`, `MORTGAGE_SERVICE_URL`, `PAYMENT_SERVICE_URL`
  - SSM params for Google OAuth exist in `localstack-stack.ts` but are not wired into `serverless.localstack.yml`
  - **Fix**: Add these to `services/user-service/serverless.localstack.yml` provider environment section with SSM references and empty-string fallbacks

- [x] ~~**`mortgage-service` missing notification and payment env vars**~~
  - Missing: `PAYMENTS_TOPIC_ARN`, `OPS_EMAIL`, `DASHBOARD_URL`, `PAYMENT_URL`
  - **Fix**: Add these to `services/mortgage-service/serverless.localstack.yml` with SSM references and fallback defaults

---

## Low Severity / Won't Break Startup

- [x] ~~**`BUDPAY_SECRET_KEY` SSM parameter not created by LocalStack CDK**~~
  - `payment-service/serverless.localstack.yml` reads `/qshelter/${stage}/BUDPAY_SECRET_KEY` (with `''` default fallback)
  - Neither CDK stack creates this parameter
  - **Fix**: Add `BudpaySecretKeyParameter` to `infrastructure/lib/localstack-stack.ts` using `process.env.PAYSTACK_SECRET_KEY` or a placeholder
  - **Impact**: Budpay integration non-functional but service starts fine due to fallback

---

## What's Working

- All 7 services have `deploy:localstack` npm scripts that build before deploying ✓
- All services on aligned `@valentine-efagene/qshelter-common@^2.0.221` ✓
- DB credentials SSM params (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) exist in LocalStack CDK with correct uppercase keys ✓
- JWT secrets (`jwt-access-secret`, `jwt-refresh-secret`) created in LocalStack CDK ✓
- SQS/SNS resources (notifications, payments, mortgage-events, contract-events) created and subscribed correctly ✓
- Notification service SSM params (SMTP, Office365, SQS_URL, etc.) all created in LocalStack CDK ✓
- `fix-apigw-stage.sh` is called after every deploy to handle LocalStack's stage-dropping issue ✓
- LocalStack CDK creates both `uploads` and `documents` S3 buckets ✓
- Docker Compose includes LocalStack, MySQL, Redis, and Adminer ✓

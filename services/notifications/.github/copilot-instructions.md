## AI Coding Agent Instructions for contrib-notifications

### Project Architecture

- This is a multi-channel notification service built with NestJS, deployed via AWS Lambda using Serverless Framework (`serverless.yaml`).
- Major domains: `email`, `sms`, `push`, `slack`, `office365`, `whatsapp`, each with its own module, controller, service, and DTO/entity files under `src/`.
- Shared logic and helpers are in `src/common/` and `src/helpers/`.
- Environment-specific config is managed via `serverless.yaml` (`customValues` for each environment) and injected as process env vars.

### Developer Workflows

- **Build:** Use `npm run build` (compiles TypeScript to `dist/`).
- **Local Dev:** Use `npm run start:dev` for local NestJS server. For Lambda simulation, use `serverless offline`.
- **Deploy:** Use `serverless deploy --stage <env>` (see `serverless.yaml` for stages).
- **Test:** Run unit tests with `npm test` and e2e tests in `test/` via `jest`.

### Conventions & Patterns

- **Modules:** Each notification channel is a NestJS module (e.g., `email`, `sms`, `push`).
- **DTOs/Entities:** Use DTOs for request validation and entities for data models. Place in respective module folders.
- **Error Handling:** Use custom error classes in `src/common/exception/` and helpers in `src/helpers/ErrorHelper.ts`.
- **Config Access:** Always use environment variables as defined in `serverless.yaml` (e.g., `process.env.OFFICE365_SENDER_NAME`).
- **External Integrations:**
  - AWS SES/SNS/SQS: IAM permissions and ARNs configured in `serverless.yaml`.
  - Office365: Credentials and sender info from env/config.
  - Slack: Token and channel from env/config.
- **Testing:** Place e2e specs in `test/`, unit specs in each module folder. Use NestJS testing utilities.

### Key Files & Directories

- `src/common/`: Shared types, errors, helpers, OpenAPI helpers.
- `src/helpers/`: Utility functions for data, requests, templates, error handling.
- `serverless.yaml`: Source of truth for environment config, IAM, and deployment.
- `src/<channel>/`: Each notification channel's logic (controller, service, DTO/entity).
- `test/`: E2E test specs and Jest config.

### Examples

- To add a new notification channel, create a new module in `src/`, following the structure of existing channels (controller, service, DTO/entity).
- To update environment config, modify `serverless.yaml` under the appropriate `customValues` section.
- To add a new error type, extend from base error in `src/common/exception/` and use helpers from `src/helpers/ErrorHelper.ts`.

### Additional Notes

- Do not hardcode secrets; always use env vars and config from `serverless.yaml`.
- Follow NestJS module/service/controller patterns for all new features.
- For AWS integration, ensure IAM permissions are updated in `serverless.yaml` as needed.

# QShelter API - Postman Collection

This folder contains the Postman collection and environments for testing the QShelter Real Estate Platform APIs.

## Files

| File                                                | Description                              |
| --------------------------------------------------- | ---------------------------------------- |
| `QShelter-API.postman_collection.json`              | Complete API reference (all endpoints)   |
| `QShelter-E2E-Flow.postman_collection.json`         | End-to-end Chidi mortgage scenario       |
| `QShelter-User-Service.postman_collection.json`     | User service only (auth, users, invites) |
| `QShelter-Property-Service.postman_collection.json` | Property service only                    |
| `QShelter-Mortgage-Service.postman_collection.json` | Mortgage service only                    |
| `QShelter-Local.postman_environment.json`           | Environment variables for LocalStack     |
| `QShelter-AWS-Staging.postman_environment.json`     | Environment variables for AWS staging    |

## Environments

### LocalStack (Local Development)

Use `QShelter-Local.postman_environment.json` for local testing with LocalStack.

```bash
# Start LocalStack
cd local-dev && ./scripts/start.sh
```

### AWS Staging

Use `QShelter-AWS-Staging.postman_environment.json` for testing against deployed AWS services.

**Setup Steps:**

1. Import the environment into Postman
2. Get the bootstrap secret:
   ```bash
   aws ssm get-parameter --name /qshelter/staging/bootstrap-secret --with-decryption --query "Parameter.Value" --output text
   ```
3. Bootstrap a tenant (run "Bootstrap Tenant" in Admin Bootstrap folder)
4. Login to get access token (run "Login" in Authentication folder)
5. **IMPORTANT**: Access tokens expire in 15 minutes - refresh via login when needed

**Current AWS Staging Endpoints:**

| Service       | URL                                                    |
| ------------- | ------------------------------------------------------ |
| User          | https://90wc5do2hf.execute-api.us-east-1.amazonaws.com |
| Property      | https://mknu68wfp4.execute-api.us-east-1.amazonaws.com |
| Mortgage      | https://znfftqvky9.execute-api.us-east-1.amazonaws.com |
| Documents     | https://ibt80hnb5c.execute-api.us-east-1.amazonaws.com |
| Notifications | https://gccen9bc1j.execute-api.us-east-1.amazonaws.com |
| Payments      | https://0xty8vn1xb.execute-api.us-east-1.amazonaws.com |

## Services Included

| Service              | Description                                     | Port (Local) |
| -------------------- | ----------------------------------------------- | ------------ |
| **User Service**     | Authentication, users, roles, tenants, API keys | 3002         |
| **Property Service** | Properties, amenities, media                    | 3003         |
| **Mortgage Service** | Payment plans, methods, applications, payments  | LocalStack   |

## Quick Start

1. **Import the Collection**: Import `QShelter-API.postman_collection.json` into Postman
2. **Import the Environment**: Import `QShelter-Local.postman_environment.json`
3. **Select Environment**: Choose "QShelter - LocalStack" from the environment dropdown
4. **Start LocalStack**: Run `cd local-dev && ./scripts/start.sh` to start LocalStack with all services
5. **Deploy Services**: Run `pnpm run deploy:local` in each service directory to deploy to LocalStack

## Authentication

All requests require these headers (automatically set via environment variables):

| Header        | Description               |
| ------------- | ------------------------- |
| `x-tenant-id` | Your tenant ID            |
| `x-user-id`   | The authenticated user ID |

## API Structure

### User Service

- **Authentication** - Login, signup, password reset, Google OAuth
- **Users** - User management and profiles
- **Roles** - Role-based access control
- **Tenants** - Multi-tenant organization management
- **API Keys** - Partner integration keys
- **Social Profiles** - Social login management

### Property Service

- **Properties** - Property listings CRUD
- **Amenities** - Property amenity management
- **Media** - Property images and videos
- **Documents** - Property documents

### Mortgage Service

#### Templates (Admin)

- **Payment Plans** - Define installment structures (frequency, count, grace period)
- **Payment Methods** - Complete workflow templates with phases and steps

#### Applications (Buyer/Admin)

- **Applications** - Instantiated from payment methods
- **Application Phases** - Track progress through KYC, Downpayment, Mortgage phases
- **Application Payments** - Payment records and processing

#### Operations

- **Property Transfer** - Request to move application to different property
- **Payment Method Change** - Request to change application payment terms

## Scenario Flows

Use the Collection Runner in Postman to execute these flows. The requests are organized in folders matching each step.

### Flow 1: Complete Mortgage Journey (Chidi Lekki Example)

End-to-end flow simulating a mortgage application. Available in multiple forms:

- **Response Examples**: Key endpoints in `QShelter-API.postman_collection.json` include saved response examples showing Chidi's scenario. Click on any endpoint and look for the "Examples" dropdown to see success/failure cases.
- **E2E Collection**: `QShelter-E2E-Flow.postman_collection.json` → Separate collection for Collection Runner

**Scenario:**

- **Property**: Lekki Gardens Estate, Unit 14B (₦85,000,000)
- **Buyer**: Chidi (age 40, employed, ₦2.5M/month income)
- **Payment**: 10% downpayment (₦8.5M) + 90% mortgage (₦76.5M) at 9.5% p.a. over 20 years
- **Flow**: Prequalification → KYC Documentation → Downpayment → Final Documentation → Mortgage

**Endpoints with Response Examples:**

| Endpoint                                                        | Examples                                            |
| --------------------------------------------------------------- | --------------------------------------------------- |
| `POST /payment-plans`                                           | 10% Downpayment Plan, Flexible Mortgage Plan (9.5%) |
| `POST /questionnaire-plans`                                     | Prequalification with conditional document triggers |
| `POST /documentation-plans`                                     | KYC with conditional steps, Final Offer workflow    |
| `POST /payment-methods`                                         | 5-Phase 10/90 Mortgage workflow                     |
| `POST /applications`                                            | ₦85M mortgage application with selected term        |
| `POST /applications/{id}/transition`                            | SUBMIT action                                       |
| `POST /applications/{id}/phases/{phaseId}/questionnaire/submit` | Age 40, SINGLE, EMPLOYED, ₦2.5M income              |
| `POST /applications/{id}/phases/{phaseId}/documents`            | ID Card, Bank Statement uploads                     |
| `POST /applications/{id}/documents/{docId}/review`              | Approve/Reject examples                             |
| `POST /applications/{id}/phases/{phaseId}/installments`         | Downpayment (₦8.5M), Mortgage (240 × ₦715K)         |
| `POST /applications/{id}/payments`                              | Record ₦8.5M downpayment                            |
| `POST /applications/payments/process`                           | Confirm payment, auto-activate next phase           |
| `POST /applications/{id}/sign`                                  | Final activation with congratulations message       |

**Key Features Demonstrated:**

- Flexible-term mortgage with retirement age constraint (age + term ≤ 60)
- Conditional document steps (Spouse ID for JOINT, Business Registration for SELF_EMPLOYED)
- Automatic phase activation on previous phase completion
- Payment processing with confirmation flow

**Step Completion Behavior:**

- **UPLOAD steps**: Auto-complete to `AWAITING_REVIEW` when document uploaded, then `COMPLETED` when document is approved
- **APPROVAL steps**: Auto-complete when all documents in the phase are approved
- **SIGNATURE steps**: Manually completed by user signing

| Phase                    | Step | Request                    | Description                                      |
| ------------------------ | ---- | -------------------------- | ------------------------------------------------ |
| **1. Admin Setup**       | 1.1  | Create Downpayment Plan    | ONE_TIME plan (10%)                              |
|                          | 1.2  | Create Mortgage Plan       | Flexible-term at 9.5% p.a.                       |
|                          | 1.3  | Create Questionnaire Plan  | Prequalification with age/income validation      |
|                          | 1.4  | Create KYC Doc Plan        | With conditional steps                           |
|                          | 1.5  | Create Final Doc Plan      | Final offer upload and signature                 |
|                          | 1.6  | Create Payment Method      | 5-phase workflow                                 |
|                          | 1.7  | Link to Property           | Attach method to Lekki Gardens                   |
| **2. Application**       | 2.1  | Create Application         | Chidi applies for Unit 14B (₦85M)                |
|                          | 2.2  | Get Application Phases     | Verify 5 phases created                          |
|                          | 2.3  | Submit Application         | DRAFT → PENDING, auto-activates prequalification |
| **3. Prequalification**  | 3.1  | Get Phase                  | See questionnaire fields                         |
|                          | 3.2  | Submit Answers             | Age, employment, income, term preference         |
| **4. KYC/Documentation** | 4.1  | Get Phase                  | Conditional steps should be SKIPPED              |
|                          | 4.2  | Upload ID Card             | Step → AWAITING_REVIEW                           |
|                          | 4.3  | Upload Bank Statement      | Step → AWAITING_REVIEW                           |
|                          | 4.4  | Upload Employment Letter   | Step → AWAITING_REVIEW                           |
|                          | 4.5  | Approve Documents          | Admin approves (steps → COMPLETED)               |
|                          | 4.6  | Lender Uploads Preapproval | Auto-completes (no manual review)                |
|                          | 4.7  | Sign Preapproval           | Customer signs → phase COMPLETED                 |
| **5. Downpayment**       | 5.1  | Generate Installment       | Create ₦8.5M installment                         |
|                          | 5.2  | Record Payment             | Record bank transfer                             |
|                          | 5.3  | Process Payment            | Confirm → phase COMPLETED                        |
| **6. Final Docs**        | 6.1  | Upload Final Offer         | Admin uploads (step → AWAITING_REVIEW)           |
|                          | 6.2  | Approve Final Offer        | Admin approves (step → COMPLETED)                |
|                          | 6.3  | Sign Final Offer           | Customer signs → phase COMPLETED                 |
| **7. Mortgage**          | 7.1  | Generate Installments      | Create 240 monthly installments                  |
|                          | 7.2  | Sign & Activate            | Application status → ACTIVE                      |

### Flow 2: Property Transfer

Transfer an existing application to a different property:

| Step | Folder            | Request                           | Description                    |
| ---- | ----------------- | --------------------------------- | ------------------------------ |
| 1    | Applications      | Get Application by ID             | Get existing application       |
| 2    | Property Transfer | Create Transfer Request           | Buyer requests transfer        |
| 3    | Property Transfer | Get All Pending Transfer Requests | Admin views pending requests   |
| 4    | Property Transfer | Get Transfer Request by ID        | Admin reviews details          |
| 5    | Property Transfer | Approve Transfer Request (Admin)  | Admin approves transfer        |
| 6    | Applications      | Get Application by ID             | Verify original is TRANSFERRED |
| 7    | Applications      | Get Application by ID             | Verify new application created |

### Flow 3: Payment Method Change

Change application payment terms (e.g., 10/90 to 20/80):

| Step | Folder                | Request                    | Description                  |
| ---- | --------------------- | -------------------------- | ---------------------------- |
| 1    | Applications          | Get Application by ID      | Get existing application     |
| 2    | Payment Method Change | Create Change Request      | Buyer requests change        |
| 3    | Payment Method Change | Submit Documents           | Buyer submits required docs  |
| 4    | Payment Method Change | Get Pending Requests       | Admin views pending requests |
| 5    | Payment Method Change | Start Review (Admin)       | Admin starts review          |
| 6    | Payment Method Change | Approve (Admin)            | Admin approves change        |
| 7    | Payment Method Change | Execute (Admin)            | Admin executes change        |
| 8    | Application Phases    | Get Phases for Application | Verify new phases created    |

### Flow 4: Admin Setup

Initial setup of payment plans and methods:

| Step | Folder          | Request                 | Body                                                                                   |
| ---- | --------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| 1    | Payment Plans   | Create Payment Plan     | `{ "name": "OneTime", "paymentFrequency": "ONE_TIME", "numberOfInstallments": 1 }`     |
| 2    | Payment Plans   | Create Payment Plan     | `{ "name": "Monthly12", "paymentFrequency": "MONTHLY", "numberOfInstallments": 12 }`   |
| 3    | Payment Plans   | Create Payment Plan     | `{ "name": "Monthly240", "paymentFrequency": "MONTHLY", "numberOfInstallments": 240 }` |
| 4    | Payment Methods | Create Payment Method   | Outright Purchase (100%)                                                               |
| 5    | Payment Methods | Create Payment Method   | 10/90 Mortgage                                                                         |
| 6    | Payment Methods | Create Payment Method   | 20/80 Mortgage                                                                         |
| 7    | Payment Methods | Get All Payment Methods | Verify methods created                                                                 |

## Environment Variables

| Variable        | Description            | Example                                                               |
| --------------- | ---------------------- | --------------------------------------------------------------------- |
| `baseUrl`       | API base URL           | `http://localhost:4566/restapis/g8b5hpkucu/localstack/_user_request_` |
| `tenantId`      | Tenant identifier      | `tenant-001`                                                          |
| `userId`        | Buyer user ID          | `buyer-001`                                                           |
| `adminUserId`   | Admin user ID          | `admin-001`                                                           |
| `applicationId` | Current application ID | (auto-populated)                                                      |
| `phaseId`       | Current phase ID       | (auto-populated)                                                      |

> **Note**: The `baseUrl` uses LocalStack's API Gateway format. If the API ID differs after redeployment, run `awslocal apigateway get-rest-apis` to get the correct API ID and stage.

## Tips

1. **Run E2E Flow in Order**: Use the Collection Runner to execute requests sequentially

2. **Auto-populate Variables**: Responses automatically save IDs to variables for subsequent requests

3. **Step Auto-Completion**:
   - **UPLOAD steps**: Upload → `AWAITING_REVIEW` → Document Approved → `COMPLETED`
   - **APPROVAL steps**: Auto-complete when all phase documents are approved
   - **SIGNATURE steps**: Require explicit completion via `/steps/complete`
   - **GENERATE_DOCUMENT steps**: Auto-generate and complete

4. **Check Phase Progress**: Use `GET /applications/:id/phases` to see current step statuses

5. **Phase Categories**:
   - `DOCUMENTATION` - For KYC, document uploads, reviews
   - `PAYMENT` - For collecting payments

6. **Step Types**:
   - `UPLOAD` - User uploads document (auto-completes on approval)
   - `APPROVAL` - Requires approval (auto-completes when all docs approved)
   - `SIGNATURE` - Requires signature (manual completion)
   - `GENERATE_DOCUMENT` - Auto-generate offer letter

## Related Documentation

- [API Documentation](../API_DOCUMENTATION.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [Scenario: Chidi Lekki Mortgage](../docs/SIMPLIFIED_LOS_FLOW.md)
- [Scenario: Property Transfer](../docs/PROPERTY_TRANSFER_SCENARIO.md)

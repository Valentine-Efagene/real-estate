# QShelter API - Postman Collection

This folder contains the Postman collection and environment for testing the QShelter Real Estate Platform APIs.

## Files

| File                                                | Description                                          |
| --------------------------------------------------- | ---------------------------------------------------- |
| `QShelter-API.postman_collection.json`              | Complete API reference (all endpoints)               |
| `QShelter-E2E-Flow.postman_collection.json`         | End-to-end Chidi mortgage scenario                   |
| `QShelter-User-Service.postman_collection.json`     | User service only (auth, users, invites)             |
| `QShelter-Property-Service.postman_collection.json` | Property service only (properties, variants, units)  |
| `QShelter-Mortgage-Service.postman_collection.json` | Mortgage service only (plans, methods, applications) |
| `QShelter-Local.postman_environment.json`           | Environment variables for local dev                  |

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

End-to-end flow simulating a mortgage application. Uses `QShelter-E2E-Flow.postman_collection.json`.

**Step Completion Behavior:**

- **UPLOAD steps**: Auto-complete to `AWAITING_REVIEW` when document uploaded, then `COMPLETED` when document is approved
- **APPROVAL steps**: Auto-complete when all documents in the phase are approved
- **SIGNATURE steps**: Manually completed by user signing

| Phase               | Step | Request                  | Description                                   |
| ------------------- | ---- | ------------------------ | --------------------------------------------- |
| **1. Bootstrap**    | 1.1  | Bootstrap Tenant         | Create tenant, roles, permissions, admin      |
|                     | 1.2  | Admin Login              | Get admin access token                        |
| **2. Customer**     | 2.1  | Customer Signup          | Register Chidi                                |
| **3. Property**     | 3.1  | Create Property          | Lekki Gardens Estate                          |
|                     | 3.2  | Create Variant           | 3-Bedroom Flat (₦85M)                         |
|                     | 3.3  | Create Unit              | Unit 14B                                      |
|                     | 3.4  | Publish Property         | Make visible to buyers                        |
| **4. Config**       | 4.1  | Create Downpayment Plan  | ONE_TIME plan                                 |
|                     | 4.2  | Create Mortgage Plan     | Flexible-term at 9.5%                         |
|                     | 4.3  | Create Payment Method    | 4-phase KYC→Downpayment→Verification→Mortgage |
|                     | 4.4  | Link to Property         | Attach method to property                     |
| **5. Application**  | 5.1  | Create Application       | Chidi applies for Unit 14B                    |
|                     | 5.2  | Submit Application       | Trigger SUBMIT action                         |
|                     | 5.3  | Activate KYC Phase       | Start KYC process                             |
| **6. KYC**          | 6.1  | Upload ID Card           | Upload ID (step→AWAITING_REVIEW)              |
|                     | 6.2  | Upload Bank Statement    | Upload bank statement                         |
|                     | 6.3  | Upload Employment Letter | Upload employment letter                      |
|                     | 6.4  | Get Documents            | Get doc IDs for approval                      |
|                     | 6.5  | Approve Doc 1            | Approve ID (step→COMPLETED)                   |
|                     | 6.6  | Approve Doc 2            | Approve bank statement                        |
|                     | 6.7  | Approve Doc 3            | Approve employment (APPROVAL step→COMPLETED)  |
|                     | 6.8  | Sign Provisional Offer   | Customer signs offer                          |
| **7. Downpayment**  | 7.1  | Generate Installment     | Create ₦8.5M installment                      |
|                     | 7.2  | Record Payment           | Record payment initiation                     |
|                     | 7.3  | Process Payment          | Confirm payment completion                    |
| **8. Verification** | 8.1  | Upload Final Offer       | Admin uploads (step→AWAITING_REVIEW)          |
|                     | 8.2  | Approve Final Offer      | Approve document (step→COMPLETED)             |
|                     | 8.3  | Sign Final Offer         | Customer signs final offer                    |
| **9. Mortgage**     | 9.1  | Generate Installments    | Create 240 monthly installments               |
|                     | 9.2  | Sign & Activate          | Activate mortgage                             |

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

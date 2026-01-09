# QShelter API - Postman Collection

This folder contains the Postman collection and environment for testing the QShelter Real Estate Platform APIs.

## Files

| File                                      | Description                              |
| ----------------------------------------- | ---------------------------------------- |
| `QShelter-API.postman_collection.json`    | Complete API collection for all services |
| `QShelter-Local.postman_environment.json` | Environment variables for LocalStack     |

## Services Included

| Service              | Description                                     | Port (Local) |
| -------------------- | ----------------------------------------------- | ------------ |
| **User Service**     | Authentication, users, roles, tenants, API keys | 3002         |
| **Property Service** | Properties, amenities, media                    | 3003         |
| **Mortgage Service** | Payment plans, methods, contracts, payments     | LocalStack   |

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

#### Contracts (Buyer/Admin)

- **Contracts** - Instantiated from payment methods
- **Contract Phases** - Track progress through KYC, Downpayment, Mortgage phases
- **Contract Payments** - Payment records and processing

#### Operations

- **Property Transfer** - Request to move contract to different property
- **Payment Method Change** - Request to change contract payment terms

## Scenario Flows

Use the Collection Runner in Postman to execute these flows. The requests are organized in folders matching each step.

### Flow 1: Complete Mortgage Journey (Chidi Lekki Example)

End-to-end flow simulating a mortgage application:

| Step | Folder            | Request                   | Description                                 |
| ---- | ----------------- | ------------------------- | ------------------------------------------- |
| 1    | Payment Plans     | Create Payment Plan       | Create "Monthly12" plan for downpayment     |
| 2    | Payment Plans     | Create Payment Plan       | Create "Monthly240" plan for mortgage       |
| 3    | Payment Methods   | Create Payment Method     | Create 10/90 method with phases             |
| 4    | Payment Methods   | Link to Property          | Link payment method to property             |
| 5    | Contracts         | Create Contract           | Buyer creates contract for property         |
| 6    | Contract Phases   | Get Phases for Contract   | Get all phases (KYC, Downpayment, Mortgage) |
| 7    | Contracts         | Transition Contract       | Submit contract (trigger: SUBMIT)           |
| 8    | Contract Phases   | Activate Phase            | Activate KYC phase                          |
| 9    | Contract Phases   | Upload Document           | Upload ID document                          |
| 10   | Contract Phases   | Complete Step             | Mark upload step complete                   |
| 11   | Contract Phases   | Review Document           | Admin approves document                     |
| 12   | Contract Phases   | Generate Installments     | Generate downpayment schedule               |
| 13   | Contract Payments | Create Payment            | Make first payment                          |
| 14   | Contract Payments | Process Payment (Webhook) | Process payment callback                    |
| 15   | Contract Phases   | Generate Installments     | Generate mortgage schedule                  |
| 16   | Contracts         | Sign Contract             | Sign the contract                           |
| 17   | Contracts         | Get Contract by ID        | Verify status is ACTIVE                     |

### Flow 2: Property Transfer

Transfer an existing contract to a different property:

| Step | Folder            | Request                           | Description                    |
| ---- | ----------------- | --------------------------------- | ------------------------------ |
| 1    | Contracts         | Get Contract by ID                | Get existing contract          |
| 2    | Property Transfer | Create Transfer Request           | Buyer requests transfer        |
| 3    | Property Transfer | Get All Pending Transfer Requests | Admin views pending requests   |
| 4    | Property Transfer | Get Transfer Request by ID        | Admin reviews details          |
| 5    | Property Transfer | Approve Transfer Request (Admin)  | Admin approves transfer        |
| 6    | Contracts         | Get Contract by ID                | Verify original is TRANSFERRED |
| 7    | Contracts         | Get Contract by ID                | Verify new contract created    |

### Flow 3: Payment Method Change

Change contract payment terms (e.g., 10/90 to 20/80):

| Step | Folder                | Request                 | Description                  |
| ---- | --------------------- | ----------------------- | ---------------------------- |
| 1    | Contracts             | Get Contract by ID      | Get existing contract        |
| 2    | Payment Method Change | Create Change Request   | Buyer requests change        |
| 3    | Payment Method Change | Submit Documents        | Buyer submits required docs  |
| 4    | Payment Method Change | Get Pending Requests    | Admin views pending requests |
| 5    | Payment Method Change | Start Review (Admin)    | Admin starts review          |
| 6    | Payment Method Change | Approve (Admin)         | Admin approves change        |
| 7    | Payment Method Change | Execute (Admin)         | Admin executes change        |
| 8    | Contract Phases       | Get Phases for Contract | Verify new phases created    |

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

| Variable      | Description         | Example                                                               |
| ------------- | ------------------- | --------------------------------------------------------------------- |
| `baseUrl`     | API base URL        | `http://localhost:4566/restapis/g8b5hpkucu/localstack/_user_request_` |
| `tenantId`    | Tenant identifier   | `tenant-001`                                                          |
| `userId`      | Buyer user ID       | `buyer-001`                                                           |
| `adminUserId` | Admin user ID       | `admin-001`                                                           |
| `contractId`  | Current contract ID | (auto-populated)                                                      |
| `phaseId`     | Current phase ID    | (auto-populated)                                                      |

> **Note**: The `baseUrl` uses LocalStack's API Gateway format. If the API ID differs after redeployment, run `awslocal apigateway get-rest-apis` to get the correct API ID and stage.

## Tips

1. **Run Admin Setup First**: Create payment plans and methods before testing buyer flows

2. **Use Collection Runner**: Select a folder and run all requests in sequence for end-to-end testing

3. **Auto-populate Variables**: Many requests save response data to variables for use in subsequent requests

4. **Check Current Action**: Use `GET /contracts/:id/current-action` to see what the user should do next

5. **Phase Categories**:

   - `DOCUMENTATION` - For KYC, document uploads, reviews
   - `PAYMENT` - For collecting payments

6. **Step Types**:
   - `UPLOAD` - User uploads document
   - `REVIEW` - Admin reviews documents
   - `SIGNATURE` - Requires signature
   - `APPROVAL` - Requires approval
   - `GENERATE_DOCUMENT` - Auto-generate offer letter

## Related Documentation

- [API Documentation](../API_DOCUMENTATION.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [Scenario: Chidi Lekki Mortgage](../docs/SIMPLIFIED_LOS_FLOW.md)
- [Scenario: Property Transfer](../docs/PROPERTY_TRANSFER_SCENARIO.md)

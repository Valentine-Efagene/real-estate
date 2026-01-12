# Full End-to-End Mortgage Flow Scenario

> **Purpose**: Complete API-driven flow from tenant bootstrap through mortgage completion.  
> **Use Case**: Guide Postman Flows design and E2E testing.  
> **Last Updated**: 2025-01-XX

## Summary

This scenario walks through the complete lifecycle of a 10/90 mortgage application, starting from tenant creation through to the first mortgage payment. All operations are performed via REST APIs—nothing is seeded manually or via direct database access.

**Key Characteristics**:

- 10% downpayment is **ONE_TIME** (single payment, not instalments)
- 90% mortgage at 9.5% p.a. over 20 years
- All configuration via REST API
- Complete KYC with document approval
- Full payment processing

---

## Actors

| Actor            | Role               | Description                                                             |
| ---------------- | ------------------ | ----------------------------------------------------------------------- |
| **System Admin** | Bootstrap Operator | Uses bootstrap secret to initialize tenant                              |
| **Adaeze**       | Tenant Admin       | Loan operations manager, configures payment methods, approves documents |
| **Chidi**        | Customer           | First-time homebuyer, age 40                                            |

---

## Services Involved

| Service              | Port (Local) | Responsibilities                                  |
| -------------------- | ------------ | ------------------------------------------------- |
| user-service         | 3002         | Auth, users, roles, permissions, tenant bootstrap |
| property-service     | 3003         | Properties, variants, units                       |
| mortgage-service     | Lambda       | Payment plans, methods, applications, phases      |
| notification-service | 3004         | Event handling, notifications                     |
| payment-service      | 3005         | Wallet, payment processing                        |

---

## Prerequisites

- LocalStack running with SNS/SQS configured
- All services deployed locally
- Bootstrap secret configured: `BOOTSTRAP_SECRET=local-bootstrap-secret`

---

## Phase 1: Tenant Bootstrap

### Step 1.1: Bootstrap Tenant with Roles and Admin

The bootstrap endpoint creates the tenant, default roles (admin, user, mortgage_ops, finance, legal), their permissions, and the first admin user in a single idempotent operation.

```http
POST {{userServiceUrl}}/admin/bootstrap-tenant
x-bootstrap-secret: {{bootstrapSecret}}
Content-Type: application/json

{
  "tenant": {
    "name": "QShelter Real Estate",
    "subdomain": "qshelter"
  },
  "admin": {
    "email": "adaeze@qshelter.com",
    "password": "SecureAdmin123!",
    "firstName": "Adaeze",
    "lastName": "Okonkwo"
  }
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "{{tenantId}}",
      "name": "QShelter Real Estate",
      "subdomain": "qshelter",
      "isNew": true
    },
    "roles": [
      { "id": "...", "name": "admin", "isNew": true, "permissionsCount": 1 },
      { "id": "...", "name": "user", "isNew": true, "permissionsCount": 6 },
      {
        "id": "...",
        "name": "mortgage_ops",
        "isNew": true,
        "permissionsCount": 7
      },
      { "id": "...", "name": "finance", "isNew": true, "permissionsCount": 6 },
      { "id": "...", "name": "legal", "isNew": true, "permissionsCount": 5 }
    ],
    "admin": {
      "id": "{{adaezeId}}",
      "email": "adaeze@qshelter.com",
      "isNew": true
    }
  }
}
```

**Store Variables**:

- `tenantId` → from response
- `adaezeId` → from response

### Step 1.2: Admin Logs In

```http
POST {{userServiceUrl}}/auth/login
Content-Type: application/json

{
  "email": "adaeze@qshelter.com",
  "password": "SecureAdmin123!"
}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "accessToken": "{{adaezeAccessToken}}",
    "refreshToken": "...",
    "expiresIn": 900
  }
}
```

**Store Variables**:

- `adaezeAccessToken` → for Authorization header

---

## Phase 2: Customer Registration

### Step 2.1: Chidi Signs Up

```http
POST {{userServiceUrl}}/auth/signup
Content-Type: application/json

{
  "email": "chidi@gmail.com",
  "password": "CustomerPass123!",
  "firstName": "Chidi",
  "lastName": "Nnamdi"
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "accessToken": "{{chidiAccessToken}}",
    "refreshToken": "...",
    "expiresIn": 900,
    "user": {
      "id": "{{chidiId}}",
      "email": "chidi@gmail.com",
      "firstName": "Chidi",
      "lastName": "Nnamdi"
    }
  }
}
```

**Store Variables**:

- `chidiId` → from response
- `chidiAccessToken` → for Authorization header

---

## Phase 3: Property Setup

> **Note**: Property-service needs variant and unit creation endpoints. These are currently missing and need to be implemented.

### Step 3.1: Create Property (Admin)

```http
POST {{propertyServiceUrl}}/properties
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
Content-Type: application/json

{
  "title": "Lekki Gardens Estate",
  "description": "Premium residential estate in Lekki Phase 1",
  "category": "SALE",
  "propertyType": "APARTMENT",
  "country": "Nigeria",
  "currency": "NGN",
  "city": "Lagos",
  "district": "Lekki"
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "{{propertyId}}",
    "title": "Lekki Gardens Estate",
    "status": "DRAFT"
  }
}
```

### Step 3.2: Create Property Variant (Admin) — ⚠️ ENDPOINT NEEDED

```http
POST {{propertyServiceUrl}}/properties/{{propertyId}}/variants
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
Content-Type: application/json

{
  "name": "3-Bedroom Flat",
  "nBedrooms": 3,
  "nBathrooms": 3,
  "nParkingSpots": 1,
  "area": 150,
  "price": 85000000,
  "totalUnits": 20,
  "availableUnits": 15
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "{{variantId}}",
    "name": "3-Bedroom Flat",
    "price": 85000000,
    "status": "AVAILABLE"
  }
}
```

### Step 3.3: Create Property Unit (Admin) — ⚠️ ENDPOINT NEEDED

```http
POST {{propertyServiceUrl}}/properties/{{propertyId}}/variants/{{variantId}}/units
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
Content-Type: application/json

{
  "unitNumber": "14B",
  "floorNumber": 14,
  "blockName": "Block B"
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "{{unitId}}",
    "unitNumber": "14B",
    "floorNumber": 14,
    "status": "AVAILABLE"
  }
}
```

### Step 3.4: Publish Property (Admin) — ⚠️ ENDPOINT NEEDED

```http
PATCH {{propertyServiceUrl}}/properties/{{propertyId}}/publish
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "{{propertyId}}",
    "status": "PUBLISHED",
    "isPublished": true,
    "publishedAt": "2025-01-XX..."
  }
}
```

---

## Phase 4: Payment Configuration

### Step 4.1: Create One-Off Downpayment Plan (Admin)

```http
POST {{mortgageServiceUrl}}/payment-plans
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: adaeze-create-downpayment-plan-{{$timestamp}}
Content-Type: application/json

{
  "name": "10% One-Off Downpayment",
  "description": "Single upfront payment for property reservation",
  "frequency": "ONE_TIME",
  "interestRate": 0,
  "gracePeriodDays": 30
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "{{downpaymentPlanId}}",
    "name": "10% One-Off Downpayment",
    "frequency": "ONE_TIME"
  }
}
```

### Step 4.2: Create Flexible Mortgage Plan (Admin)

```http
POST {{mortgageServiceUrl}}/payment-plans
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: adaeze-create-mortgage-plan-{{$timestamp}}
Content-Type: application/json

{
  "name": "Flexible Mortgage at 9.5%",
  "description": "Monthly payments at 9.5% annual interest, term selected by applicant",
  "frequency": "MONTHLY",
  "allowFlexibleTerm": true,
  "minTermMonths": 60,
  "maxTermMonths": 360,
  "termStepMonths": 12,
  "maxAgeAtMaturity": 65,
  "interestRate": 9.5,
  "gracePeriodDays": 15
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "{{mortgagePlanId}}",
    "name": "Flexible Mortgage at 9.5%",
    "allowFlexibleTerm": true,
    "minTermMonths": 60,
    "maxTermMonths": 360
  }
}
```

### Step 4.3: Create Payment Method with 4 Phases (Admin)

```http
POST {{mortgageServiceUrl}}/payment-methods
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: adaeze-create-payment-method-{{$timestamp}}
Content-Type: application/json

{
  "name": "10/90 Lekki Mortgage",
  "description": "Underwriting → Downpayment → Final Documentation → Mortgage",
  "requiresManualApproval": true,
  "phases": [
    {
      "name": "Underwriting & Documentation",
      "phaseCategory": "DOCUMENTATION",
      "phaseType": "KYC",
      "order": 1,
      "requiredDocumentTypes": ["ID_CARD", "BANK_STATEMENT", "EMPLOYMENT_LETTER"],
      "stepDefinitions": [
        { "name": "Upload Valid ID", "stepType": "UPLOAD", "order": 1 },
        { "name": "Upload Bank Statements", "stepType": "UPLOAD", "order": 2 },
        { "name": "Upload Employment Letter", "stepType": "UPLOAD", "order": 3 },
        { "name": "Admin Reviews Documents", "stepType": "APPROVAL", "order": 4 },
        {
          "name": "Generate Provisional Offer",
          "stepType": "GENERATE_DOCUMENT",
          "order": 5,
          "metadata": {
            "documentType": "PROVISIONAL_OFFER",
            "autoSend": true,
            "expiresInDays": 30
          }
        },
        { "name": "Customer Signs Provisional Offer", "stepType": "SIGNATURE", "order": 6 }
      ]
    },
    {
      "name": "10% Downpayment",
      "phaseCategory": "PAYMENT",
      "phaseType": "DOWNPAYMENT",
      "order": 2,
      "percentOfPrice": 10,
      "paymentPlanId": "{{downpaymentPlanId}}"
    },
    {
      "name": "Final Documentation",
      "phaseCategory": "DOCUMENTATION",
      "phaseType": "VERIFICATION",
      "order": 3,
      "stepDefinitions": [
        {
          "name": "Admin Uploads Final Offer",
          "stepType": "UPLOAD",
          "order": 1,
          "metadata": {
            "documentType": "FINAL_OFFER",
            "uploadedBy": "ADMIN"
          }
        },
        { "name": "Customer Signs Final Offer", "stepType": "SIGNATURE", "order": 2 }
      ]
    },
    {
      "name": "20-Year Mortgage",
      "phaseCategory": "PAYMENT",
      "phaseType": "MORTGAGE",
      "order": 4,
      "percentOfPrice": 90,
      "interestRate": 9.5,
      "paymentPlanId": "{{mortgagePlanId}}"
    }
  ]
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "{{paymentMethodId}}",
    "name": "10/90 Lekki Mortgage",
    "phases": [
      {
        "id": "...",
        "name": "Underwriting & Documentation",
        "phaseType": "KYC"
      },
      { "id": "...", "name": "10% Downpayment", "phaseType": "DOWNPAYMENT" },
      {
        "id": "...",
        "name": "Final Documentation",
        "phaseType": "VERIFICATION"
      },
      { "id": "...", "name": "20-Year Mortgage", "phaseType": "MORTGAGE" }
    ]
  }
}
```

### Step 4.4: Link Payment Method to Property (Admin)

```http
POST {{mortgageServiceUrl}}/payment-methods/{{paymentMethodId}}/properties
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: adaeze-link-payment-method-{{$timestamp}}
Content-Type: application/json

{
  "propertyId": "{{propertyId}}",
  "isDefault": true
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "paymentMethodId": "{{paymentMethodId}}",
    "propertyId": "{{propertyId}}",
    "isDefault": true
  }
}
```

### Step 4.5: Configure Document Requirement Rules (Admin) — ⚠️ ENDPOINT NEEDED

```http
POST {{mortgageServiceUrl}}/payment-methods/{{paymentMethodId}}/document-rules
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
Content-Type: application/json

{
  "rules": [
    {
      "context": "APPLICATION_PHASE",
      "phaseType": "KYC",
      "documentType": "ID_CARD",
      "isRequired": true,
      "description": "Valid government-issued ID (NIN, Passport, or Driver License)",
      "maxSizeBytes": 5242880,
      "allowedMimeTypes": ["image/jpeg", "image/png", "application/pdf"]
    },
    {
      "context": "APPLICATION_PHASE",
      "phaseType": "KYC",
      "documentType": "BANK_STATEMENT",
      "isRequired": true,
      "description": "Last 6 months bank statements",
      "maxSizeBytes": 10485760,
      "allowedMimeTypes": ["application/pdf"],
      "expiryDays": 90
    },
    {
      "context": "APPLICATION_PHASE",
      "phaseType": "KYC",
      "documentType": "EMPLOYMENT_LETTER",
      "isRequired": true,
      "description": "Employment confirmation letter",
      "maxSizeBytes": 5242880,
      "allowedMimeTypes": ["application/pdf"]
    }
  ]
}
```

---

## Phase 5: Customer Application

### Step 5.1: Chidi Creates Application

```http
POST {{mortgageServiceUrl}}/applications
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-create-application-{{$timestamp}}
Content-Type: application/json

{
  "propertyUnitId": "{{unitId}}",
  "paymentMethodId": "{{paymentMethodId}}",
  "title": "Purchase Agreement - Lekki Gardens Unit 14B",
  "applicationType": "MORTGAGE",
  "totalAmount": 85000000,
  "monthlyIncome": 2500000,
  "monthlyExpenses": 800000,
  "applicantAge": 40,
  "selectedMortgageTermMonths": 240
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "{{applicationId}}",
    "applicationNumber": "APP-2025-XXXX",
    "status": "DRAFT",
    "phases": [
      { "id": "{{kycPhaseId}}", "phaseType": "KYC", "status": "PENDING" },
      {
        "id": "{{downpaymentPhaseId}}",
        "phaseType": "DOWNPAYMENT",
        "status": "PENDING"
      },
      {
        "id": "{{verificationPhaseId}}",
        "phaseType": "VERIFICATION",
        "status": "PENDING"
      },
      {
        "id": "{{mortgagePhaseId}}",
        "phaseType": "MORTGAGE",
        "status": "PENDING"
      }
    ]
  }
}
```

**Store Variables**:

- `applicationId`
- `kycPhaseId`
- `downpaymentPhaseId`
- `verificationPhaseId`
- `mortgagePhaseId`

### Step 5.2: Verify Phase Amounts

```http
GET {{mortgageServiceUrl}}/applications/{{applicationId}}/phases
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": [
    { "phaseType": "KYC", "totalAmount": 0 },
    { "phaseType": "DOWNPAYMENT", "totalAmount": 8500000 },
    { "phaseType": "VERIFICATION", "totalAmount": 0 },
    { "phaseType": "MORTGAGE", "totalAmount": 76500000, "interestRate": 9.5 }
  ]
}
```

### Step 5.3: Submit Application

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/transition
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-submit-application-{{$timestamp}}
Content-Type: application/json

{
  "action": "SUBMIT",
  "note": "Submitting for processing"
}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "{{applicationId}}",
    "status": "PENDING"
  }
}
```

### Step 5.4: Activate KYC Phase

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/activate
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-activate-kyc-{{$timestamp}}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "{{kycPhaseId}}",
    "status": "IN_PROGRESS"
  }
}
```

---

## Phase 6: KYC Document Upload & Approval

### Step 6.1: Upload Documents (Customer)

**Upload ID Card**:

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/documents
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-doc-id-card-{{$timestamp}}
Content-Type: application/json

{
  "documentType": "ID_CARD",
  "url": "https://s3.amazonaws.com/qshelter/chidi/id.pdf",
  "fileName": "id.pdf"
}
```

**Upload Bank Statement**:

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/documents
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-doc-bank-statement-{{$timestamp}}
Content-Type: application/json

{
  "documentType": "BANK_STATEMENT",
  "url": "https://s3.amazonaws.com/qshelter/chidi/bank.pdf",
  "fileName": "bank.pdf"
}
```

**Upload Employment Letter**:

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/documents
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-doc-employment-{{$timestamp}}
Content-Type: application/json

{
  "documentType": "EMPLOYMENT_LETTER",
  "url": "https://s3.amazonaws.com/qshelter/chidi/employment.pdf",
  "fileName": "employment.pdf"
}
```

### Step 6.2: Complete Upload Steps (Customer)

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/steps/complete
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-step-upload-id-{{$timestamp}}
Content-Type: application/json

{ "stepName": "Upload Valid ID" }
```

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/steps/complete
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-step-upload-bank-{{$timestamp}}
Content-Type: application/json

{ "stepName": "Upload Bank Statements" }
```

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/steps/complete
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-step-upload-employment-{{$timestamp}}
Content-Type: application/json

{ "stepName": "Upload Employment Letter" }
```

### Step 6.3: Admin Retrieves Documents for Review

```http
GET {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/documents
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": [
    { "id": "{{docId1}}", "documentType": "ID_CARD", "status": "PENDING" },
    {
      "id": "{{docId2}}",
      "documentType": "BANK_STATEMENT",
      "status": "PENDING"
    },
    {
      "id": "{{docId3}}",
      "documentType": "EMPLOYMENT_LETTER",
      "status": "PENDING"
    }
  ]
}
```

### Step 6.4: Admin Approves Each Document

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/documents/{{docId1}}/review
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: adaeze-approve-doc-1-{{$timestamp}}
Content-Type: application/json

{
  "status": "APPROVED",
  "note": "ID verified successfully"
}
```

(Repeat for docId2 and docId3)

### Step 6.5: Admin Completes Review Step

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/steps/complete
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: adaeze-review-complete-{{$timestamp}}
Content-Type: application/json

{
  "stepName": "Admin Reviews Documents",
  "note": "All documents verified and approved"
}
```

### Step 6.6: Generate Provisional Offer (Auto-Executes)

The "Generate Provisional Offer" step auto-executes after approval.

### Step 6.7: Customer Signs Provisional Offer

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/steps/complete
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-sign-provisional-{{$timestamp}}
Content-Type: application/json

{ "stepName": "Customer Signs Provisional Offer" }
```

KYC phase should now be COMPLETED, and Downpayment phase should auto-activate.

---

## Phase 7: Downpayment (One-Time Payment)

### Step 7.1: Generate Downpayment Installment

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{downpaymentPhaseId}}/installments
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-generate-downpayment-{{$timestamp}}
Content-Type: application/json

{
  "startDate": "{{$isoTimestamp}}"
}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "installments": [
      {
        "id": "{{downpaymentInstallmentId}}",
        "amount": 8500000,
        "dueDate": "...",
        "status": "PENDING"
      }
    ]
  }
}
```

### Step 7.2: Record Payment

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/payments
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-pay-downpayment-{{$timestamp}}
Content-Type: application/json

{
  "phaseId": "{{downpaymentPhaseId}}",
  "installmentId": "{{downpaymentInstallmentId}}",
  "amount": 8500000,
  "paymentMethod": "BANK_TRANSFER",
  "externalReference": "TRF-CHIDI-DOWNPAYMENT-001"
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "{{paymentId}}",
    "reference": "{{paymentReference}}",
    "amount": 8500000,
    "status": "PENDING"
  }
}
```

### Step 7.3: Process Payment Confirmation (Webhook Simulation)

```http
POST {{mortgageServiceUrl}}/applications/payments/process
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: process-downpayment-{{$timestamp}}
Content-Type: application/json

{
  "reference": "{{paymentReference}}",
  "status": "COMPLETED",
  "gatewayTransactionId": "GW-TRX-123456"
}
```

**Expected**: Downpayment phase COMPLETED, Verification phase auto-activates.

---

## Phase 8: Final Documentation

### Step 8.1: Admin Uploads Final Offer Letter

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{verificationPhaseId}}/documents
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: adaeze-upload-final-offer-{{$timestamp}}
Content-Type: application/json

{
  "documentType": "FINAL_OFFER",
  "url": "https://s3.amazonaws.com/qshelter/applications/chidi-final-offer.pdf",
  "fileName": "chidi-final-offer.pdf"
}
```

### Step 8.2: Admin Completes Upload Step

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{verificationPhaseId}}/steps/complete
Authorization: Bearer {{adaezeAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: adaeze-step-final-offer-{{$timestamp}}
Content-Type: application/json

{ "stepName": "Admin Uploads Final Offer" }
```

### Step 8.3: Customer Signs Final Offer

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{verificationPhaseId}}/steps/complete
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-sign-final-offer-{{$timestamp}}
Content-Type: application/json

{ "stepName": "Customer Signs Final Offer" }
```

**Expected**: Verification phase COMPLETED, Mortgage phase auto-activates.

---

## Phase 9: Mortgage Activation

### Step 9.1: Generate Mortgage Installments

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{mortgagePhaseId}}/installments
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-generate-mortgage-{{$timestamp}}
Content-Type: application/json

{
  "startDate": "{{$isoTimestamp}}"
}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "installments": [
      // 240 monthly installments
      {
        "id": "...",
        "amount": "...",
        "dueDate": "...",
        "installmentNumber": 1
      },
      { "id": "...", "amount": "...", "dueDate": "...", "installmentNumber": 2 }
      // ... (240 total)
    ],
    "summary": {
      "totalInstallments": 240,
      "monthlyPayment": "...",
      "totalAmount": 76500000,
      "totalInterest": "..."
    }
  }
}
```

### Step 9.2: Sign and Activate Application

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/sign
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-sign-application-{{$timestamp}}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "{{applicationId}}",
    "status": "ACTIVE",
    "signedAt": "2025-01-XX..."
  }
}
```

---

## Phase 10: First Mortgage Payment (Optional)

### Step 10.1: Get Pending Installment

```http
GET {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{mortgagePhaseId}}/installments?status=PENDING&limit=1
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
```

### Step 10.2: Record First Monthly Payment

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/payments
Authorization: Bearer {{chidiAccessToken}}
x-tenant-id: {{tenantId}}
x-idempotency-key: chidi-mortgage-payment-1-{{$timestamp}}
Content-Type: application/json

{
  "phaseId": "{{mortgagePhaseId}}",
  "installmentId": "{{firstInstallmentId}}",
  "amount": "{{monthlyPaymentAmount}}",
  "paymentMethod": "BANK_TRANSFER",
  "externalReference": "TRF-CHIDI-MORTGAGE-001"
}
```

---

## Missing Endpoints Summary

The following endpoints need to be implemented:

### Property Service

| Method | Endpoint                                    | Description             |
| ------ | ------------------------------------------- | ----------------------- |
| POST   | `/properties/:id/variants`                  | Create property variant |
| GET    | `/properties/:id/variants`                  | List property variants  |
| PUT    | `/properties/:id/variants/:variantId`       | Update variant          |
| DELETE | `/properties/:id/variants/:variantId`       | Delete variant          |
| POST   | `/properties/:id/variants/:variantId/units` | Create property unit    |
| GET    | `/properties/:id/variants/:variantId/units` | List units in variant   |
| PUT    | `/units/:unitId`                            | Update unit             |
| DELETE | `/units/:unitId`                            | Delete unit             |
| PATCH  | `/properties/:id/publish`                   | Publish property        |
| PATCH  | `/properties/:id/unpublish`                 | Unpublish property      |

### Mortgage Service

| Method | Endpoint                              | Description                            |
| ------ | ------------------------------------- | -------------------------------------- |
| POST   | `/payment-methods/:id/document-rules` | Bulk create document requirement rules |
| GET    | `/payment-methods/:id/document-rules` | List document requirement rules        |

---

## Postman Flow Design

The Postman Flow should be organized in these folders:

```
📁 QShelter E2E Flow
├── 📁 1. Bootstrap
│   ├── Bootstrap Tenant
│   └── Admin Login
├── 📁 2. Customer Registration
│   └── Customer Signup
├── 📁 3. Property Setup
│   ├── Create Property
│   ├── Create Variant
│   ├── Create Unit
│   └── Publish Property
├── 📁 4. Payment Configuration
│   ├── Create Downpayment Plan
│   ├── Create Mortgage Plan
│   ├── Create Payment Method
│   ├── Link to Property
│   └── Configure Document Rules
├── 📁 5. Application Creation
│   ├── Create Application
│   ├── Verify Phase Amounts
│   ├── Submit Application
│   └── Activate KYC Phase
├── 📁 6. KYC Process
│   ├── Upload Documents (×3)
│   ├── Complete Upload Steps (×3)
│   ├── Admin Review Documents (×3)
│   ├── Complete Review Step
│   └── Sign Provisional Offer
├── 📁 7. Downpayment
│   ├── Generate Installment
│   ├── Record Payment
│   └── Process Payment
├── 📁 8. Final Documentation
│   ├── Admin Upload Final Offer
│   ├── Complete Upload Step
│   └── Sign Final Offer
├── 📁 9. Mortgage Activation
│   ├── Generate Installments
│   └── Sign Application
└── 📁 10. Monthly Payment (Optional)
    └── Record First Payment
```

---

## Environment Variables

```json
{
  "userServiceUrl": "http://localhost:3002",
  "propertyServiceUrl": "http://localhost:3003",
  "mortgageServiceUrl": "http://localhost:3001",
  "notificationServiceUrl": "http://localhost:3004",
  "paymentServiceUrl": "http://localhost:3005",
  "bootstrapSecret": "local-bootstrap-secret",
  "tenantId": "",
  "adaezeId": "",
  "adaezeAccessToken": "",
  "chidiId": "",
  "chidiAccessToken": "",
  "propertyId": "",
  "variantId": "",
  "unitId": "",
  "downpaymentPlanId": "",
  "mortgagePlanId": "",
  "paymentMethodId": "",
  "applicationId": "",
  "kycPhaseId": "",
  "downpaymentPhaseId": "",
  "verificationPhaseId": "",
  "mortgagePhaseId": ""
}
```

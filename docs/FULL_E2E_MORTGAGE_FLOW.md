# Full End-to-End Mortgage Flow Scenario

> **Purpose**: Complete API-driven flow from tenant bootstrap through mortgage completion.
> **Use Case**: Guide Postman Flows design, E2E testing, and demo frontend.
> **Last Updated**: 2025-01-15
> **Test Location**: [`tests/aws/full-mortgage-flow/`](../tests/aws/full-mortgage-flow/)
> **Service Test**: [`services/mortgage-service/tests/e2e/chidi-lekki-mortgage/`](../services/mortgage-service/tests/e2e/chidi-lekki-mortgage/)

## Summary

This scenario walks through the complete lifecycle of a 10/90 mortgage application, from tenant bootstrap through all 5 phases to application completion. All operations are performed via REST APIs — nothing is seeded manually or via direct database access.

**Key Characteristics**:

- 4 actors across 3 organizations
- 5-phase customer journey: Prequalification → Sales Offer → KYC → Downpayment → Mortgage Offer
- 10% downpayment (₦8.5M) as ONE_TIME single payment via wallet
- Event-driven payment flow: wallet credit → auto-allocation → phase completion → SNS/SQS → next phase activation
- Conditional documents (spouse ID only for joint mortgages)
- Multi-stage document review (PLATFORM stage + BANK stage)
- Auto-approval when uploader matches stage organization type
- JWT-based authorization via Lambda authorizer
- Cross-tenant isolation and ownership verification

---

## Actors

| Actor      | Role                 | Email                | Organization                    | Description                                                |
| ---------- | -------------------- | -------------------- | ------------------------------- | ---------------------------------------------------------- |
| **Adaeze** | Admin / Mortgage Ops | `adaeze@mailsac.com` | QShelter Real Estate (PLATFORM) | Operations manager, configures system, reviews documents   |
| **Chidi**  | Customer             | `chidi@mailsac.com`  | —                               | First-time homebuyer, age 40                               |
| **Emeka**  | Developer / Agent    | `emeka@mailsac.com`  | Lekki Gardens (DEVELOPER)       | Sales manager, creates properties, uploads sales offers    |
| **Nkechi** | Lender / lender_ops  | `nkechi@mailsac.com` | Access Bank PLC (BANK)          | Loan officer, uploads preapproval & mortgage offer letters |

**All email addresses use `@mailsac.com`** for testable email verification.

---

## Organizations

| Name                              | Type      | Email                      | Description           |
| --------------------------------- | --------- | -------------------------- | --------------------- |
| QShelter Real Estate              | PLATFORM  | `support@mailsac.com`      | The platform operator |
| Lekki Gardens Development Company | DEVELOPER | `lekkigardens@mailsac.com` | Property developer    |
| Access Bank PLC                   | BANK      | `mortgages@mailsac.com`    | Mortgage lender       |

---

## Property Details

| Field     | Value                   |
| --------- | ----------------------- |
| Property  | Lekki Gardens Estate    |
| Unit      | 14B (Block B, Floor 14) |
| Variant   | 3-Bedroom Flat, 150 sqm |
| Bedrooms  | 3                       |
| Bathrooms | 3                       |
| Parking   | 1                       |
| Price     | ₦85,000,000 (NGN)       |
| Category  | SALE                    |
| Type      | APARTMENT               |

---

## Payment Structure (5-Phase Journey)

| Order | Phase Name                | Category      | Type         | Details                                        |
| ----- | ------------------------- | ------------- | ------------ | ---------------------------------------------- |
| 1     | Prequalification          | QUESTIONNAIRE | PRE_APPROVAL | 6 questions, scoring, manual approval          |
| 2     | Sales Offer               | DOCUMENTATION | VERIFICATION | Developer uploads offer letter, auto-approved  |
| 3     | Preapproval Documentation | DOCUMENTATION | KYC          | Customer + lender docs, two-stage review       |
| 4     | 10% Downpayment           | PAYMENT       | DOWNPAYMENT  | ₦8,500,000 via wallet credit + auto-allocation |
| 5     | Mortgage Offer            | DOCUMENTATION | VERIFICATION | Lender uploads offer letter, auto-approved     |

---

## Services Involved

| Service          | Description                                         |
| ---------------- | --------------------------------------------------- |
| user-service     | Auth, users, roles, organizations, tenant bootstrap |
| property-service | Properties, variants, units                         |
| mortgage-service | Applications, phases, plans, document workflows     |
| payment-service  | Wallets, credits, auto-allocation, installments     |

All services are deployed to AWS staging behind API Gateway with a Lambda authorizer.

---

## Prerequisites

- All services deployed to AWS staging
- Bootstrap secret configured in SSM: `aws ssm get-parameter --name /qshelter/staging/bootstrap-secret --with-decryption`
- Role policies DynamoDB table exists for authorizer
- SNS topic and SQS queues configured for event-driven payment flow

---

## Phase 1: Bootstrap & Admin Setup

### Step 1.0: Reset Database

Clears all data for a clean test run.

```http
POST {{userServiceUrl}}/admin/reset
x-bootstrap-secret: {{bootstrapSecret}}
```

**Expected Response** (200 OK):

```json
{
  "success": true,
  "totalDeleted": 42
}
```

### Step 1.1: Bootstrap Tenant with Admin (Adaeze)

Creates the tenant, default roles (admin, user, mortgage_ops, finance, legal, agent, lender_ops), their permissions, and the first admin user in a single idempotent operation.

```http
POST {{userServiceUrl}}/admin/bootstrap-tenant
x-bootstrap-secret: {{bootstrapSecret}}
Content-Type: application/json

{
  "tenant": {
    "name": "QShelter Demo",
    "subdomain": "qshelter-demo"
  },
  "admin": {
    "email": "adaeze@mailsac.com",
    "password": "password",
    "firstName": "Adaeze",
    "lastName": "Okonkwo"
  }
}
```

**Expected Response** (201 Created):

```json
{
  "tenant": {
    "id": "{{tenantId}}",
    "name": "QShelter Demo",
    "subdomain": "qshelter-demo"
  },
  "roles": [
    { "id": "{{adminRoleId}}", "name": "admin" },
    { "id": "{{userRoleId}}", "name": "user" },
    { "id": "{{mortgageOpsRoleId}}", "name": "mortgage_ops" },
    { "id": "...", "name": "finance" },
    { "id": "...", "name": "legal" },
    { "id": "{{agentRoleId}}", "name": "agent" },
    { "id": "{{lenderOpsRoleId}}", "name": "lender_ops" }
  ],
  "admin": {
    "id": "{{adaezeId}}",
    "email": "adaeze@mailsac.com"
  }
}
```

**Store Variables**: `tenantId`, `adaezeId`, `adminRoleId`, `agentRoleId`, `lenderOpsRoleId`

**Side-effect**: Polls DynamoDB for `admin` role policy sync before proceeding.

### Step 1.2: Admin (Adaeze) Logs In

```http
POST {{userServiceUrl}}/auth/login
Content-Type: application/json

{
  "email": "adaeze@mailsac.com",
  "password": "password"
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

**Store Variables**: `adaezeAccessToken` (JWT contains `sub`, `tenantId`, `roles`)

---

## Phase 2: Organization & Staff Setup

Admin creates organizations, then invites staff with explicit roles.

### Step 2.1: Create QShelter Platform Organization

```http
POST {{userServiceUrl}}/organizations
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "name": "QShelter Real Estate",
  "typeCodes": ["PLATFORM"],
  "isPlatformOrg": true,
  "email": "support@mailsac.com",
  "phone": "+2348001234567",
  "address": "123 Victoria Island",
  "city": "Lagos",
  "state": "Lagos",
  "country": "Nigeria",
  "website": "https://qshelter.com",
  "description": "Real estate platform for property transactions"
}
```

**Store Variables**: `qshelterOrgId`

### Step 2.2: Add Adaeze to QShelter as Member

```http
POST {{userServiceUrl}}/organizations/{{qshelterOrgId}}/members
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "userId": "{{adaezeId}}",
  "title": "Mortgage Operations Officer",
  "department": "Mortgage Operations"
}
```

### Step 2.3: Create Lekki Gardens (Developer Organization)

```http
POST {{userServiceUrl}}/organizations
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "name": "Lekki Gardens Development Company",
  "typeCodes": ["DEVELOPER"],
  "email": "lekkigardens@mailsac.com",
  "phone": "+2348012345678",
  "address": "15 Admiralty Way",
  "city": "Lekki",
  "state": "Lagos",
  "country": "Nigeria",
  "website": "https://lekkigardens.com",
  "cacNumber": "RC-123456",
  "description": "Premium property developer in Lagos"
}
```

**Store Variables**: `lekkiGardensOrgId`

### Step 2.4: Invite Emeka to Lekki Gardens (Agent Role)

```http
POST {{userServiceUrl}}/organizations/{{lekkiGardensOrgId}}/invitations
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "email": "emeka@mailsac.com",
  "firstName": "Emeka",
  "lastName": "Okafor",
  "roleId": "{{agentRoleId}}",
  "title": "Sales Manager",
  "department": "Sales"
}
```

**Expected**: `201` with invitation `token` and `role.name === "agent"`

Then Emeka accepts the invitation (creates account + auto-login):

```http
POST {{userServiceUrl}}/invitations/accept?token={{invitationToken}}
Content-Type: application/json

{
  "password": "password"
}
```

**Store Variables**: `emekaId`, `emekaAccessToken`

**Side-effect**: Polls DynamoDB for `agent` policy sync.

### Step 2.5: Create Access Bank (Bank Organization)

```http
POST {{userServiceUrl}}/organizations
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "name": "Access Bank PLC",
  "typeCodes": ["BANK"],
  "email": "mortgages@mailsac.com",
  "phone": "+2341234567890",
  "address": "999C Danmole Street",
  "city": "Victoria Island",
  "state": "Lagos",
  "country": "Nigeria",
  "website": "https://accessbankplc.com",
  "bankCode": "044",
  "swiftCode": "ABNGNGLA",
  "description": "Leading Nigerian commercial bank"
}
```

**Store Variables**: `accessBankOrgId`

### Step 2.6: Invite Nkechi to Access Bank (lender_ops Role)

```http
POST {{userServiceUrl}}/organizations/{{accessBankOrgId}}/invitations
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "email": "nkechi@mailsac.com",
  "firstName": "Nkechi",
  "lastName": "Adebayo",
  "roleId": "{{lenderOpsRoleId}}",
  "title": "Mortgage Loan Officer",
  "department": "Retail Banking"
}
```

Then Nkechi accepts (same pattern as Emeka).

**Store Variables**: `nkechiId`, `nkechiAccessToken`

**Side-effect**: Polls DynamoDB for `lender_ops` policy sync.

---

## Phase 3: Payment Configuration

Admin creates all plan templates and assembles the 5-phase payment method.

### Step 3.1: Create Downpayment Plan (One-Off)

```http
POST {{mortgageServiceUrl}}/payment-plans
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "name": "10% One-Off Downpayment",
  "description": "Single payment for 10% downpayment",
  "frequency": "ONE_TIME",
  "numberOfInstallments": 1,
  "interestRate": 0,
  "gracePeriodDays": 0
}
```

**Store Variables**: `downpaymentPlanId`

### Step 3.2: Create Prequalification Questionnaire Plan

```http
POST {{mortgageServiceUrl}}/questionnaire-plans
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "name": "Mortgage Prequalification",
  "description": "Collects applicant age, income, and employment to validate mortgage eligibility",
  "isActive": true,
  "passingScore": 100,
  "scoringStrategy": "MIN_ALL",
  "autoDecisionEnabled": false,
  "estimatedMinutes": 5,
  "category": "PREQUALIFICATION",
  "questions": [
    {
      "questionKey": "applicant_age",
      "questionText": "What is your current age?",
      "questionType": "NUMBER",
      "order": 1,
      "isRequired": true,
      "validationRules": { "min": 18, "max": 59 },
      "scoringRules": [
        { "operator": "LESS_THAN_OR_EQUAL", "value": 55, "score": 100 },
        { "operator": "GREATER_THAN", "value": 55, "score": 0 }
      ],
      "scoreWeight": 1,
      "category": "ELIGIBILITY"
    },
    {
      "questionKey": "mortgage_type",
      "questionText": "What type of mortgage are you applying for?",
      "questionType": "SELECT",
      "order": 2,
      "isRequired": true,
      "options": [
        { "value": "SINGLE", "label": "Single (Individual)", "score": 100 },
        { "value": "JOINT", "label": "Joint (With Spouse)", "score": 100 }
      ],
      "scoreWeight": 0,
      "category": "APPLICATION_TYPE"
    },
    {
      "questionKey": "employment_status",
      "questionText": "What is your employment status?",
      "questionType": "SELECT",
      "order": 3,
      "isRequired": true,
      "options": [
        { "value": "EMPLOYED", "label": "Employed", "score": 100 },
        { "value": "SELF_EMPLOYED", "label": "Self-Employed", "score": 80 }
      ],
      "scoreWeight": 1,
      "category": "EMPLOYMENT"
    },
    {
      "questionKey": "monthly_income",
      "questionText": "What is your monthly gross income?",
      "questionType": "CURRENCY",
      "order": 4,
      "isRequired": true,
      "validationRules": { "min": 0 },
      "scoringRules": [
        { "operator": "GREATER_THAN_OR_EQUAL", "value": 500000, "score": 100 },
        { "operator": "LESS_THAN", "value": 500000, "score": 0 }
      ],
      "scoreWeight": 1,
      "category": "AFFORDABILITY"
    },
    {
      "questionKey": "monthly_expenses",
      "questionText": "What are your total monthly expenses?",
      "questionType": "CURRENCY",
      "order": 5,
      "isRequired": true,
      "validationRules": { "min": 0 },
      "scoreWeight": 0,
      "category": "AFFORDABILITY"
    },
    {
      "questionKey": "desired_term_years",
      "questionText": "What mortgage term (in years) would you prefer?",
      "questionType": "NUMBER",
      "order": 6,
      "isRequired": true,
      "validationRules": { "min": 5, "max": 30 },
      "scoringRules": [
        { "operator": "GREATER_THAN_OR_EQUAL", "value": 5, "score": 100 },
        { "operator": "LESS_THAN", "value": 5, "score": 0 }
      ],
      "scoreWeight": 1,
      "category": "PREFERENCES"
    }
  ]
}
```

**Key**: `mortgage_type` has `scoreWeight: 0` — it's used for conditional document logic, not scoring.

**Store Variables**: `prequalificationPlanId`

### Step 3.3: Create Sales Offer Documentation Plan

Developer uploads the sales offer letter. Single approval stage with auto-transition.

```http
POST {{mortgageServiceUrl}}/documentation-plans
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "name": "Sales Offer Documentation",
  "description": "Developer uploads sales offer letter for customer acceptance",
  "isActive": true,
  "documentDefinitions": [
    {
      "documentType": "SALES_OFFER_LETTER",
      "documentName": "Sales Offer Letter",
      "uploadedBy": "DEVELOPER",
      "order": 1,
      "isRequired": true,
      "description": "Sales offer letter prepared by the property developer",
      "maxSizeBytes": 10485760,
      "allowedMimeTypes": ["application/pdf"]
    }
  ],
  "approvalStages": [
    {
      "name": "Developer Document Verification",
      "order": 1,
      "organizationTypeCode": "DEVELOPER",
      "autoTransition": true,
      "waitForAllDocuments": true,
      "onRejection": "CASCADE_BACK"
    }
  ]
}
```

**Behavior**: Developer uploads → auto-approved (uploader org type matches stage org type) → phase completes immediately.

**Store Variables**: `salesOfferDocPlanId`

### Step 3.4: Create KYC Documentation Plan (with Conditional Document)

Two-stage approval: PLATFORM (QShelter) → BANK (Access Bank). The "Spouse ID" document is **conditional** on `mortgage_type=JOINT` from the prequalification questionnaire.

```http
POST {{mortgageServiceUrl}}/documentation-plans
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "name": "Mortgage KYC Documentation",
  "description": "Standard KYC workflow with conditional spouse document",
  "isActive": true,
  "documentDefinitions": [
    {
      "documentType": "ID_CARD",
      "documentName": "Valid ID Card",
      "uploadedBy": "CUSTOMER",
      "order": 1,
      "isRequired": true,
      "description": "Valid government-issued ID (NIN, driver's license, or passport)",
      "maxSizeBytes": 5242880,
      "allowedMimeTypes": ["image/jpeg", "image/png", "application/pdf"]
    },
    {
      "documentType": "SPOUSE_ID",
      "documentName": "Spouse ID Card",
      "uploadedBy": "CUSTOMER",
      "order": 2,
      "isRequired": true,
      "description": "Spouse's government-issued ID (required for joint mortgage)",
      "maxSizeBytes": 5242880,
      "allowedMimeTypes": ["image/jpeg", "image/png", "application/pdf"],
      "condition": {
        "questionKey": "mortgage_type",
        "operator": "EQUALS",
        "value": "JOINT"
      }
    },
    {
      "documentType": "BANK_STATEMENT",
      "documentName": "Bank Statements",
      "uploadedBy": "CUSTOMER",
      "order": 3,
      "isRequired": true,
      "description": "Last 6 months bank statements",
      "maxSizeBytes": 10485760,
      "allowedMimeTypes": ["application/pdf"]
    },
    {
      "documentType": "EMPLOYMENT_LETTER",
      "documentName": "Employment Letter",
      "uploadedBy": "CUSTOMER",
      "order": 4,
      "isRequired": true,
      "description": "Employment confirmation letter from employer",
      "maxSizeBytes": 5242880,
      "allowedMimeTypes": ["application/pdf"]
    },
    {
      "documentType": "PREAPPROVAL_LETTER",
      "documentName": "Preapproval Letter",
      "uploadedBy": "LENDER",
      "order": 5,
      "isRequired": true,
      "description": "Preapproval letter from partner bank",
      "maxSizeBytes": 10485760,
      "allowedMimeTypes": ["application/pdf"]
    }
  ],
  "approvalStages": [
    {
      "name": "QShelter Staff Review",
      "order": 1,
      "organizationTypeCode": "PLATFORM",
      "autoTransition": false,
      "waitForAllDocuments": true,
      "onRejection": "CASCADE_BACK",
      "slaHours": 24
    },
    {
      "name": "Bank Review",
      "order": 2,
      "organizationTypeCode": "BANK",
      "autoTransition": true,
      "waitForAllDocuments": true,
      "onRejection": "CASCADE_BACK",
      "slaHours": 48
    }
  ]
}
```

**Stage-to-Uploader Mapping**:

- Stage 1 (PLATFORM): Reviews CUSTOMER-uploaded docs (ID_CARD, BANK_STATEMENT, EMPLOYMENT_LETTER)
- Stage 2 (BANK): Reviews LENDER-uploaded docs (PREAPPROVAL_LETTER — auto-approved because lender uploads during BANK stage)

**Conditional Document**: `SPOUSE_ID` is only required when `mortgage_type=JOINT`. Since Chidi answers `SINGLE`, this doc is excluded.

**Store Variables**: `kycDocPlanId`

### Step 3.5: Create Mortgage Offer Documentation Plan

Bank uploads the final mortgage offer letter.

```http
POST {{mortgageServiceUrl}}/documentation-plans
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "name": "Mortgage Offer Documentation",
  "description": "Bank uploads mortgage offer letter for customer acceptance",
  "isActive": true,
  "documentDefinitions": [
    {
      "documentType": "MORTGAGE_OFFER_LETTER",
      "documentName": "Mortgage Offer Letter",
      "uploadedBy": "LENDER",
      "order": 1,
      "isRequired": true,
      "description": "Final mortgage offer letter from bank",
      "maxSizeBytes": 10485760,
      "allowedMimeTypes": ["application/pdf"]
    }
  ],
  "approvalStages": [
    {
      "name": "Bank Document Upload",
      "order": 1,
      "organizationTypeCode": "BANK",
      "autoTransition": true,
      "waitForAllDocuments": true,
      "onRejection": "CASCADE_BACK"
    }
  ]
}
```

**Behavior**: Lender uploads → auto-approved → phase completes immediately.

**Store Variables**: `mortgageOfferDocPlanId`

### Step 3.6: Create Payment Method with 5-Phase Journey

Assembles all plans into the customer journey.

```http
POST {{mortgageServiceUrl}}/payment-methods
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "name": "10/90 Lekki Mortgage",
  "description": "Prequalification → Sales Offer → KYC → 10% Downpayment → Mortgage Offer",
  "requiresManualApproval": true,
  "phases": [
    {
      "name": "Prequalification",
      "phaseCategory": "QUESTIONNAIRE",
      "phaseType": "PRE_APPROVAL",
      "order": 1,
      "questionnairePlanId": "{{prequalificationPlanId}}"
    },
    {
      "name": "Sales Offer",
      "phaseCategory": "DOCUMENTATION",
      "phaseType": "VERIFICATION",
      "order": 2,
      "documentationPlanId": "{{salesOfferDocPlanId}}"
    },
    {
      "name": "Preapproval Documentation",
      "phaseCategory": "DOCUMENTATION",
      "phaseType": "KYC",
      "order": 3,
      "documentationPlanId": "{{kycDocPlanId}}"
    },
    {
      "name": "10% Downpayment",
      "phaseCategory": "PAYMENT",
      "phaseType": "DOWNPAYMENT",
      "order": 4,
      "percentOfPrice": 10,
      "paymentPlanId": "{{downpaymentPlanId}}"
    },
    {
      "name": "Mortgage Offer",
      "phaseCategory": "DOCUMENTATION",
      "phaseType": "VERIFICATION",
      "order": 5,
      "documentationPlanId": "{{mortgageOfferDocPlanId}}"
    }
  ]
}
```

**Expected**: `201`, 5 phases returned.

**Store Variables**: `paymentMethodId`

---

## Phase 4: Customer Registration

### Step 4.1: Chidi Signs Up

```http
POST {{userServiceUrl}}/auth/signup
Content-Type: application/json

{
  "email": "chidi@mailsac.com",
  "password": "password",
  "firstName": "Chidi",
  "lastName": "Nnamdi",
  "tenantId": "{{tenantId}}"
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "accessToken": "{{chidiAccessToken}}",
    "refreshToken": "...",
    "expiresIn": 900
  }
}
```

**Store Variables**: `chidiId` (from JWT `sub` claim), `chidiAccessToken`

---

## Phase 5: Property Setup (by Developer)

Emeka (developer/agent at Lekki Gardens) creates the property. Admin links the payment method.

### Step 5.1: Developer Creates Property

```http
POST {{propertyServiceUrl}}/property/properties
Authorization: Bearer {{emekaAccessToken}}
Content-Type: application/json

{
  "title": "Lekki Gardens Estate",
  "description": "Premium residential estate in Lekki Phase 1",
  "category": "SALE",
  "propertyType": "APARTMENT",
  "country": "Nigeria",
  "currency": "NGN",
  "city": "Lagos",
  "district": "Lekki",
  "organizationId": "{{lekkiGardensOrgId}}"
}
```

**Store Variables**: `propertyId`

### Step 5.2: Create Property Variant

```http
POST {{propertyServiceUrl}}/property/properties/{{propertyId}}/variants
Authorization: Bearer {{emekaAccessToken}}
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

**Store Variables**: `variantId`

### Step 5.3: Create Property Unit

```http
POST {{propertyServiceUrl}}/property/properties/{{propertyId}}/variants/{{variantId}}/units
Authorization: Bearer {{emekaAccessToken}}
Content-Type: application/json

{
  "unitNumber": "14B",
  "floorNumber": 14,
  "blockName": "Block B"
}
```

**Store Variables**: `unitId`

### Step 5.4: Publish Property

```http
PATCH {{propertyServiceUrl}}/property/properties/{{propertyId}}/publish
Authorization: Bearer {{emekaAccessToken}}
```

**Expected**: `200`, `status: "PUBLISHED"`

### Step 5.5: Admin Links Payment Method to Property

```http
POST {{mortgageServiceUrl}}/payment-methods/{{paymentMethodId}}/properties
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "propertyId": "{{propertyId}}",
  "isDefault": true
}
```

---

## Phase 6: Customer Application

### Step 6.1: Chidi Creates Application

```http
POST {{mortgageServiceUrl}}/applications
Authorization: Bearer {{chidiAccessToken}}
Content-Type: application/json

{
  "propertyUnitId": "{{unitId}}",
  "paymentMethodId": "{{paymentMethodId}}",
  "title": "Purchase Agreement - Lekki Gardens Unit 14B",
  "applicationType": "MORTGAGE",
  "totalAmount": 85000000,
  "monthlyIncome": 2500000,
  "monthlyExpenses": 800000,
  "applicantAge": 40
}
```

**Expected Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "{{applicationId}}",
    "status": "PENDING",
    "phases": [
      {
        "id": "{{prequalificationPhaseId}}",
        "order": 1,
        "name": "Prequalification",
        "status": "IN_PROGRESS"
      },
      {
        "id": "{{salesOfferPhaseId}}",
        "order": 2,
        "name": "Sales Offer",
        "status": "PENDING"
      },
      {
        "id": "{{kycPhaseId}}",
        "order": 3,
        "name": "Preapproval Documentation",
        "status": "PENDING"
      },
      {
        "id": "{{downpaymentPhaseId}}",
        "order": 4,
        "name": "10% Downpayment",
        "status": "PENDING"
      },
      {
        "id": "{{mortgageOfferPhaseId}}",
        "order": 5,
        "name": "Mortgage Offer",
        "status": "PENDING"
      }
    ]
  }
}
```

**Key**: Application goes directly to `PENDING` status (smart auto-submit). Prequalification phase is auto-activated to `IN_PROGRESS`.

### Step 6.2: Verify Lekki Gardens Auto-Bound as Developer

Because the property has `organizationId` (Lekki Gardens), the developer is automatically bound to the application.

```http
GET {{mortgageServiceUrl}}/applications/{{applicationId}}/organizations
Authorization: Bearer {{adaezeAccessToken}}
```

**Expected**: Developer binding with `organizationId === lekkiGardensOrgId`, `status: "ACTIVE"`, `isPrimary: true`.

### Step 6.3: Admin Binds Access Bank as Lender

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/organizations
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "organizationId": "{{accessBankOrgId}}",
  "organizationTypeCode": "BANK",
  "isPrimary": true,
  "slaHours": 48
}
```

### Step 6.4: Verify Phase Amounts

```http
GET {{mortgageServiceUrl}}/applications/{{applicationId}}/phases
Authorization: Bearer {{chidiAccessToken}}
```

**Expected**: 5 phases, downpayment phase (order 4) has `totalAmount: 8500000` (10% of ₦85M).

### Step 6.5: Prequalification Phase is Auto-Activated

```http
GET {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{prequalificationPhaseId}}
Authorization: Bearer {{chidiAccessToken}}
```

**Expected**: `status: "IN_PROGRESS"`

---

## Phase 7: Prequalification Questionnaire

### Step 7.1: Chidi Submits Prequalification Answers

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{prequalificationPhaseId}}/questionnaire/submit
Authorization: Bearer {{chidiAccessToken}}
Content-Type: application/json

{
  "answers": [
    { "fieldName": "applicant_age", "value": "40" },
    { "fieldName": "mortgage_type", "value": "SINGLE" },
    { "fieldName": "employment_status", "value": "EMPLOYED" },
    { "fieldName": "monthly_income", "value": "2500000" },
    { "fieldName": "monthly_expenses", "value": "800000" },
    { "fieldName": "desired_term_years", "value": "20" }
  ]
}
```

**Key**: `mortgage_type=SINGLE` means the conditional `SPOUSE_ID` document will NOT be required in the KYC phase.

### Step 7.2: Prequalification Awaits Approval

Phase status changes to `AWAITING_APPROVAL` (because `autoDecisionEnabled: false`).

### Step 7.3: Admin Approves Prequalification

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{prequalificationPhaseId}}/questionnaire/review
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "decision": "APPROVE",
  "notes": "Chidi meets all eligibility criteria. Approved for mortgage."
}
```

**Expected**: `200`, phase `status: "COMPLETED"`. Next phase (Sales Offer) auto-activates.

---

## Phase 8: Sales Offer (Developer Uploads, Auto-Approved)

### Step 8.1: Sales Offer Phase is Auto-Activated

After prequalification completes, the sales offer phase automatically transitions to `IN_PROGRESS`.

### Step 8.2: Developer (Emeka) Uploads Sales Offer Letter

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{salesOfferPhaseId}}/documents
Authorization: Bearer {{emekaAccessToken}}
Content-Type: application/json

{
  "documentType": "SALES_OFFER_LETTER",
  "url": "https://qshelter-uploads-staging.s3.amazonaws.com/mortgage_docs/{{uuid}}/sales-offer-letter.pdf",
  "fileName": "sales-offer-letter.pdf"
}
```

**Auto-Approval**: The uploader (Emeka) is from a DEVELOPER organization, and the approval stage's `organizationTypeCode` is `DEVELOPER`. When the uploader's org type matches the stage org type, the document is automatically approved.

### Step 8.3: Sales Offer Phase Completes

Phase immediately transitions to `COMPLETED` (single doc, auto-approved, `autoTransition: true`).

---

## Phase 9: KYC Documentation (Two-Stage Review)

This phase demonstrates the most complex document workflow:

- **Stage 1 (PLATFORM)**: QShelter staff (Adaeze) reviews customer-uploaded documents
- **Stage 2 (BANK)**: Bank (Nkechi) uploads lender document — auto-approved

### Step 9.1: KYC Phase is Auto-Activated

Status: `IN_PROGRESS`

### Step 9.2: Chidi Uploads KYC Documents

Three uploads (no `SPOUSE_ID` because `mortgage_type=SINGLE`):

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/documents
Authorization: Bearer {{chidiAccessToken}}
Content-Type: application/json

{
  "documentType": "ID_CARD",
  "url": "https://qshelter-uploads-staging.s3.amazonaws.com/kyc_documents/{{uuid}}/chidi-id-card.pdf",
  "fileName": "chidi-id-card.pdf"
}
```

Repeat for `BANK_STATEMENT` and `EMPLOYMENT_LETTER`.

### Step 9.3: Adaeze (Stage 1: PLATFORM) Reviews & Approves Customer Documents

First, fetch the documents:

```http
GET {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/documents
Authorization: Bearer {{adaezeAccessToken}}
```

Then approve each customer document:

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/documents/{{documentId}}/review
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "status": "APPROVED",
  "organizationTypeCode": "PLATFORM",
  "comment": "QShelter review: Document verified by Mortgage Operations"
}
```

Repeat for `ID_CARD`, `BANK_STATEMENT`, `EMPLOYMENT_LETTER`. Stage 1 completes, Stage 2 auto-activates.

### Step 9.4: Nkechi (Stage 2: BANK) Uploads Preapproval Letter (Auto-Approved)

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{kycPhaseId}}/documents
Authorization: Bearer {{nkechiAccessToken}}
Content-Type: application/json

{
  "documentType": "PREAPPROVAL_LETTER",
  "url": "https://qshelter-uploads-staging.s3.amazonaws.com/mortgage_docs/{{uuid}}/preapproval-letter.pdf",
  "fileName": "preapproval-letter.pdf"
}
```

**Auto-Approval**: Nkechi is from a BANK organization, and Stage 2's `organizationTypeCode` is `BANK`. Uploader matches stage → document auto-approved → Stage 2 completes.

### Step 9.5: KYC Phase Completes

Both stages approved → phase status: `COMPLETED`.

---

## Phase 10: Downpayment (Event-Based Payment Flow)

This is the most architecturally interesting phase — it demonstrates the **event-driven** payment flow across two services connected via SNS/SQS.

### Event Flow Diagram

```
Chidi's wallet credited (₦8.5M)
  → WALLET_CREDITED event (payment-service internal)
    → auto-allocates funds to pending installment
      → installment marked PAID
        → payment phase COMPLETED
          → PAYMENT_PHASE_COMPLETED event → SNS → SQS
            → mortgage-service activates Phase 5 (Mortgage Offer)
```

### Step 10.1: Downpayment Phase is Auto-Activated

After KYC completes, downpayment phase transitions to `IN_PROGRESS`.

### Step 10.2: Create Wallet for Chidi

```http
POST {{paymentServiceUrl}}/wallets/me
Authorization: Bearer {{chidiAccessToken}}
Content-Type: application/json

{
  "currency": "NGN"
}
```

**Store Variables**: `chidiWalletId`

**Note**: Handles 201 (new), 200 (exists), or 409 (conflict → fallback to `GET /wallets/me`).

### Step 10.3: Generate Downpayment Installment

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{downpaymentPhaseId}}/installments
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "startDate": "2025-01-15T00:00:00.000Z"
}
```

**Expected**: 1 installment of ₦8,500,000.

**Note**: Installments may already be auto-generated via the `PAYMENT_PHASE_ACTIVATED` event (race condition handled gracefully).

### Step 10.4: Simulate Payment by Crediting Wallet

This simulates a bank transfer being received. In production, BudPay's virtual account webhook fires on any inbound transfer, crediting the wallet automatically.

```http
POST {{paymentServiceUrl}}/wallets/{{chidiWalletId}}/credit
Authorization: Bearer {{adaezeAccessToken}}
Content-Type: application/json

{
  "amount": 8500000,
  "reference": "DOWNPAYMENT-{{uniqueRef}}",
  "description": "Downpayment for Lekki Gardens Unit 14B",
  "source": "manual"
}
```

**Expected**: `200`, `status: "success"`.

**Triggers event chain**: Wallet credit → auto-allocation to pending installment → installment PAID → payment phase COMPLETED → `PAYMENT_PHASE_COMPLETED` SNS event → SQS → mortgage-service activates next phase.

### Step 10.5: Poll for Downpayment Phase Completion

Polls `GET /applications/{{applicationId}}/phases/{{downpaymentPhaseId}}` every 2 seconds for up to 30 seconds.

**Expected**: Phase status transitions from `IN_PROGRESS` → `COMPLETED` via asynchronous event processing.

---

## Phase 11: Mortgage Offer (Event-Activated)

This phase is activated **automatically** by the `PAYMENT_PHASE_COMPLETED` event from Phase 10. The mortgage-service's SQS consumer receives the event and activates the next phase.

### Step 11.1: Verify Phase Was Auto-Activated via Event

Polls `GET /applications/{{applicationId}}/phases/{{mortgageOfferPhaseId}}` every 2 seconds for up to 15 seconds.

**Expected**: `status: "IN_PROGRESS"` (activated by event, not API call).

### Step 11.2: Lender (Nkechi) Uploads Mortgage Offer Letter

```http
POST {{mortgageServiceUrl}}/applications/{{applicationId}}/phases/{{mortgageOfferPhaseId}}/documents
Authorization: Bearer {{nkechiAccessToken}}
Content-Type: application/json

{
  "documentType": "MORTGAGE_OFFER_LETTER",
  "url": "https://qshelter-uploads-staging.s3.amazonaws.com/mortgage_docs/{{uuid}}/mortgage-offer-letter.pdf",
  "fileName": "mortgage-offer-letter.pdf"
}
```

**Auto-Approval**: Lender upload during BANK stage → auto-approved → phase completes.

### Step 11.3: Mortgage Offer Phase Completes

Status: `COMPLETED`

### Step 11.4: Application is Completed 🎉

```http
GET {{mortgageServiceUrl}}/applications/{{applicationId}}
Authorization: Bearer {{chidiAccessToken}}
```

**Expected**: `status: "COMPLETED"` — all 5 phases done!

---

## Authorization & Access Control Tests

The test suite also validates security boundaries.

### Unauthenticated Access

- `GET /applications/{{applicationId}}` with no auth → `400|401|403`

### Customer Cannot Access Admin Endpoints

- `POST /payment-plans` as Chidi → `401|403`
- `POST /payment-methods` as Chidi → `401|403`

### Cross-Tenant Isolation

A second tenant ("Other Real Estate Co" / `other-realestate`) is bootstrapped with its own admin.

- Other admin cannot access Chidi's application → `403|404`
- Other admin listing applications does NOT include Chidi's → application not in results
- Other admin cannot modify the payment method → `403|404`

### Ownership Verification

- Chidi **can** view his own application → `200`, `buyerId === chidiId`
- A different customer (registered in the same tenant) **cannot** access Chidi's application → `403|404`

---

## Environment Variables

| Variable               | Description                          |
| ---------------------- | ------------------------------------ |
| `USER_SERVICE_URL`     | User service endpoint (required)     |
| `PROPERTY_SERVICE_URL` | Property service endpoint (required) |
| `MORTGAGE_SERVICE_URL` | Mortgage service endpoint (required) |
| `PAYMENT_SERVICE_URL`  | Payment service endpoint (required)  |
| `BOOTSTRAP_SECRET`     | Bootstrap secret from SSM (required) |
| `ROLE_POLICIES_TABLE`  | DynamoDB table name for authorizer   |

---

## Running the Tests

```bash
# Full E2E test against AWS staging
cd tests/aws && ./scripts/run-full-e2e-staging.sh

# Or directly
cd tests/aws/full-mortgage-flow && npm test
```

---

## Postman Flow Design

The Postman collection should mirror this exact flow with the following folder structure:

```
QShelter Full Mortgage Flow/
├── Phase 1: Bootstrap & Admin Setup/
│   ├── 1.0 Reset Database
│   ├── 1.1 Bootstrap Tenant
│   └── 1.2 Admin Login
├── Phase 2: Organization & Staff Setup/
│   ├── 2.1 Create QShelter Org
│   ├── 2.2 Add Adaeze to QShelter
│   ├── 2.3 Create Lekki Gardens Org
│   ├── 2.4 Invite Emeka (Agent)
│   ├── 2.5 Create Access Bank Org
│   └── 2.6 Invite Nkechi (Lender)
├── Phase 3: Payment Configuration/
│   ├── 3.1 Create Downpayment Plan
│   ├── 3.2 Create Prequalification Plan
│   ├── 3.3 Create Sales Offer Doc Plan
│   ├── 3.4 Create KYC Doc Plan (Conditional)
│   ├── 3.5 Create Mortgage Offer Doc Plan
│   └── 3.6 Create Payment Method (5 Phases)
├── Phase 4: Customer Registration/
│   └── 4.1 Chidi Signs Up
├── Phase 5: Property Setup/
│   ├── 5.1 Create Property
│   ├── 5.2 Create Variant
│   ├── 5.3 Create Unit
│   ├── 5.4 Publish Property
│   └── 5.5 Link Payment Method
├── Phase 6: Application/
│   ├── 6.1 Create Application
│   ├── 6.2 Verify Developer Auto-Bound
│   ├── 6.3 Bind Lender (Access Bank)
│   ├── 6.4 Verify Phase Amounts
│   └── 6.5 Verify Phase Auto-Activated
├── Phase 7: Prequalification/
│   ├── 7.1 Submit Answers
│   ├── 7.2 Check Awaiting Approval
│   └── 7.3 Admin Approves
├── Phase 8: Sales Offer/
│   ├── 8.1 Verify Phase Activated
│   ├── 8.2 Developer Uploads Offer
│   └── 8.3 Verify Phase Completed
├── Phase 9: KYC Documentation/
│   ├── 9.1 Verify Phase Activated
│   ├── 9.2 Customer Uploads Docs
│   ├── 9.3 QShelter Reviews (Stage 1)
│   ├── 9.4 Bank Uploads Preapproval (Stage 2, Auto-Approved)
│   └── 9.5 Verify Phase Completed
├── Phase 10: Downpayment/
│   ├── 10.1 Verify Phase Activated
│   ├── 10.2 Create Wallet
│   ├── 10.3 Generate Installment
│   ├── 10.4 Credit Wallet (Trigger Events)
│   └── 10.5 Poll Phase Completion
├── Phase 11: Mortgage Offer/
│   ├── 11.1 Poll Phase Activation (Event-Based)
│   ├── 11.2 Lender Uploads Offer
│   ├── 11.3 Verify Phase Completed
│   └── 11.4 Verify Application Completed
└── Authorization Tests/
    ├── Unauthenticated Access
    ├── Customer Admin Restrictions
    ├── Cross-Tenant Isolation
    └── Ownership Verification
```

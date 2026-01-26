# QShelter Mortgage Flow - Complete API Documentation

**Version:** 2.0  
**Last Updated:** January 26, 2026  
**Environment:** AWS Staging

---

## Executive Summary

This document describes the complete end-to-end mortgage application flow for the QShelter platform. It follows the journey of **Chidi Nnamdi**, a 40-year-old first-time homebuyer purchasing a ₦85,000,000 3-bedroom flat at **Lekki Gardens Estate** in Lagos, Nigeria.

### Key Changes in v2.0

- **Organization Types:** Replaced hardcoded `reviewParty` enum with dynamic `organizationTypeCode` (PLATFORM, BANK, DEVELOPER, etc.)
- **Stage-Based Reviews:** Each approval stage is responsible for reviewing documents from specific uploaders
- **Auto-Approval:** Documents uploaded by the party responsible for that stage are automatically approved

### Key Actors

| Actor              | Role                        | Organization  | Email              |
| ------------------ | --------------------------- | ------------- | ------------------ |
| **Adaeze Okonkwo** | Mortgage Operations Officer | QShelter      | adaeze@mailsac.com |
| **Chidi Nnamdi**   | Customer (Buyer)            | —             | chidi@mailsac.com  |
| **Emeka Okafor**   | Developer Rep               | Lekki Gardens | emeka@mailsac.com  |
| **Nkechi Adebayo** | Loan Officer                | Access Bank   | nkechi@mailsac.com |

### Property Details

| Field       | Value                         |
| ----------- | ----------------------------- |
| Property    | Lekki Gardens Estate, Phase 3 |
| Unit        | 14B (Block B, Floor 14)       |
| Type        | 3-Bedroom Flat                |
| Size        | 150 sqm                       |
| Price       | ₦85,000,000                   |
| Downpayment | 10% (₦8,500,000)              |
| Mortgage    | 90% (₦76,500,000)             |

### Application Phases

```
┌─────────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ 1. Prequalification │───▶│ 2. Sales Offer  │───▶│ 3. KYC & Docs   │
│   (Questionnaire)   │    │   (Developer)   │    │   (Customer)    │
└─────────────────────┘    └─────────────────┘    └─────────────────┘
                                                           │
                                                           ▼
┌─────────────────────┐    ┌─────────────────┐
│ 5. Mortgage Offer   │◀───│ 4. Downpayment  │
│    (Lender)         │    │   (Payment)     │
└─────────────────────┘    └─────────────────┘
```

---

## Service Endpoints

| Service          | Base URL                                                        |
| ---------------- | --------------------------------------------------------------- |
| User Service     | `https://[user-api-id].execute-api.us-east-1.amazonaws.com`     |
| Property Service | `https://[property-api-id].execute-api.us-east-1.amazonaws.com` |
| Mortgage Service | `https://[mortgage-api-id].execute-api.us-east-1.amazonaws.com` |

---

## Phase 1: System Bootstrap

### Step 1.1: Bootstrap Tenant

Creates the tenant, default roles, and admin user.

**Endpoint:** `POST /admin/bootstrap-tenant`  
**Service:** User Service  
**Authentication:** Bootstrap Secret Header

#### Request Headers

```
x-bootstrap-secret: {{bootstrapSecret}}
Content-Type: application/json
```

#### Request Body

```json
{
  "tenant": {
    "name": "QShelter Real Estate",
    "subdomain": "qshelter"
  },
  "admin": {
    "email": "adaeze@mailsac.com",
    "password": "SecureAdmin123!",
    "firstName": "Adaeze",
    "lastName": "Okonkwo"
  }
}
```

#### Response (201 Created)

```json
{
  "tenant": {
    "id": "cm...",
    "name": "QShelter Real Estate",
    "subdomain": "qshelter",
    "isNew": true
  },
  "admin": {
    "id": "cm...",
    "email": "adaeze@mailsac.com",
    "isNew": true
  },
  "roles": [
    { "id": "...", "name": "admin", "isNew": true, "permissionsCount": 1 },
    { "id": "...", "name": "user", "isNew": true, "permissionsCount": 6 },
    { "id": "...", "name": "DEVELOPER", "isNew": true, "permissionsCount": 6 },
    { "id": "...", "name": "LENDER", "isNew": true, "permissionsCount": 6 }
  ],
  "syncTriggered": true
}
```

---

### Step 1.2: Admin Login

**Endpoint:** `POST /auth/login`  
**Service:** User Service  
**Authentication:** None

#### Request Body

```json
{
  "email": "adaeze@mailsac.com",
  "password": "SecureAdmin123!"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "...",
    "user": {
      "id": "cm...",
      "email": "adaeze@mailsac.com",
      "firstName": "Adaeze",
      "lastName": "Okonkwo"
    }
  }
}
```

---

## Phase 2: Customer Registration

### Step 2.1: Customer Signup

Chidi creates his account on the platform.

**Endpoint:** `POST /auth/signup`  
**Service:** User Service  
**Authentication:** None

#### Request Body

```json
{
  "email": "chidi@mailsac.com",
  "password": "CustomerPass123!",
  "firstName": "Chidi",
  "lastName": "Nnamdi",
  "tenantId": "{{tenantId}}"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "cm...",
      "email": "chidi@mailsac.com",
      "firstName": "Chidi",
      "lastName": "Nnamdi"
    }
  }
}
```

---

## Phase 2.5: Partner Setup

### Step 2.5.1: Create Developer Organization (Lekki Gardens)

**Endpoint:** `POST /organizations`  
**Service:** User Service  
**Authentication:** Bearer Token (Admin)

#### Request Headers

```
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json
x-idempotency-key: create-lekki-gardens
```

#### Request Body

```json
{
  "name": "Lekki Gardens Development Company",
  "type": "DEVELOPER",
  "email": "lekkigardens@mailsac.com",
  "phone": "+234-1-453-0000",
  "address": "Lekki-Epe Expressway, Lekki, Lagos",
  "city": "Lekki",
  "state": "Lagos",
  "country": "Nigeria",
  "cacNumber": "RC-123456",
  "description": "Premium property developer in Lagos"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "name": "Lekki Gardens Development Company",
    "type": "DEVELOPER",
    "status": "ACTIVE"
  }
}
```

---

### Step 2.5.2: Create Developer User (Emeka)

**Endpoint:** `POST /auth/signup`  
**Service:** User Service

#### Request Body

```json
{
  "email": "emeka@mailsac.com",
  "password": "DeveloperPass123!",
  "firstName": "Emeka",
  "lastName": "Okafor",
  "tenantId": "{{tenantId}}"
}
```

---

### Step 2.5.3: Add Emeka to Lekki Gardens

**Endpoint:** `POST /organizations/{{lekkiGardensOrgId}}/members`  
**Service:** User Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "userId": "{{emekaId}}",
  "role": "OFFICER",
  "title": "Sales Manager",
  "department": "Sales",
  "canApprove": true
}
```

---

### Step 2.5.4: Create Bank Organization (Access Bank)

**Endpoint:** `POST /organizations`  
**Service:** User Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "name": "Access Bank PLC",
  "type": "BANK",
  "email": "mortgages@mailsac.com",
  "phone": "+234-1-280-2800",
  "address": "999c Danmole Street, Victoria Island, Lagos",
  "bankCode": "044",
  "swiftCode": "ABNGNGLA",
  "description": "Leading Nigerian commercial bank"
}
```

---

### Step 2.5.5: Create Lender User (Nkechi)

**Endpoint:** `POST /auth/signup`  
**Service:** User Service

#### Request Body

```json
{
  "email": "nkechi@mailsac.com",
  "password": "LenderPass123!",
  "firstName": "Nkechi",
  "lastName": "Adebayo",
  "tenantId": "{{tenantId}}"
}
```

---

### Step 2.5.6: Add Nkechi to Access Bank

**Endpoint:** `POST /organizations/{{accessBankOrgId}}/members`  
**Service:** User Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "userId": "{{nkechiId}}",
  "role": "MANAGER",
  "title": "Mortgage Loan Officer",
  "department": "Retail Banking",
  "canApprove": true,
  "approvalLimit": 500000000
}
```

---

## Phase 3: Property Setup

### Step 3.1: Create Property

**Endpoint:** `POST /property/properties`  
**Service:** Property Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
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

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "title": "Lekki Gardens Estate",
    "status": "DRAFT"
  }
}
```

---

### Step 3.2: Create Property Variant

**Endpoint:** `POST /property/properties/{{propertyId}}/variants`  
**Service:** Property Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
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

---

### Step 3.3: Create Property Unit

**Endpoint:** `POST /property/properties/{{propertyId}}/variants/{{variantId}}/units`  
**Service:** Property Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "unitNumber": "14B",
  "floorNumber": 14,
  "blockName": "Block B"
}
```

---

### Step 3.4: Publish Property

**Endpoint:** `PATCH /property/properties/{{propertyId}}/publish`  
**Service:** Property Service  
**Authentication:** Bearer Token (Admin)

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "status": "PUBLISHED"
  }
}
```

---

## Phase 4: Payment Configuration

### Step 4.1: Create Downpayment Plan

**Endpoint:** `POST /payment-plans`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "name": "10% One-Off Downpayment",
  "description": "Single payment for 10% downpayment",
  "frequency": "ONE_TIME",
  "numberOfInstallments": 1,
  "interestRate": 0,
  "gracePeriodDays": 0
}
```

---

### Step 4.2: Create Prequalification Questionnaire Plan

**Endpoint:** `POST /questionnaire-plans`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "name": "Mortgage Prequalification",
  "description": "Collects applicant age and income to validate mortgage eligibility",
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
      "questionKey": "monthly_income",
      "questionText": "What is your monthly gross income?",
      "questionType": "CURRENCY",
      "order": 4,
      "isRequired": true,
      "scoringRules": [
        { "operator": "GREATER_THAN_OR_EQUAL", "value": 500000, "score": 100 },
        { "operator": "LESS_THAN", "value": 500000, "score": 0 }
      ],
      "scoreWeight": 1,
      "category": "AFFORDABILITY"
    }
  ]
}
```

---

### Step 4.3: Create Sales Offer Documentation Plan

**Endpoint:** `POST /documentation-plans`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "name": "Sales Offer Documentation",
  "description": "Developer uploads sales offer letter",
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
      "reviewParty": "DEVELOPER",
      "autoTransition": true,
      "waitForAllDocuments": true,
      "onRejection": "CASCADE_BACK"
    }
  ]
}
```

---

### Step 4.4: Create KYC Documentation Plan

**Endpoint:** `POST /documentation-plans`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Admin)

> **Note:** Approval stages now use `organizationTypeCode` instead of `reviewParty`. The organization type codes are dynamically created at bootstrap and include: `PLATFORM`, `BANK`, `DEVELOPER`, `LEGAL`, `INSURER`, `GOVERNMENT`.

#### Request Body

```json
{
  "name": "Mortgage KYC Documentation",
  "description": "Standard KYC documentation workflow",
  "isActive": true,
  "documentDefinitions": [
    {
      "documentType": "ID_CARD",
      "documentName": "Valid ID Card",
      "uploadedBy": "CUSTOMER",
      "order": 1,
      "isRequired": true
    },
    {
      "documentType": "BANK_STATEMENT",
      "documentName": "Bank Statements",
      "uploadedBy": "CUSTOMER",
      "order": 2,
      "isRequired": true
    },
    {
      "documentType": "EMPLOYMENT_LETTER",
      "documentName": "Employment Letter",
      "uploadedBy": "CUSTOMER",
      "order": 3,
      "isRequired": true
    },
    {
      "documentType": "PREAPPROVAL_LETTER",
      "documentName": "Preapproval Letter",
      "uploadedBy": "LENDER",
      "order": 4,
      "isRequired": true
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

> **Stage Responsibilities:**
>
> - **PLATFORM stage** reviews documents with `uploadedBy: CUSTOMER` or `uploadedBy: PLATFORM`
> - **BANK stage** reviews documents with `uploadedBy: LENDER` (auto-approved when lender uploads)

---

### Step 4.5: Create Mortgage Offer Documentation Plan

**Endpoint:** `POST /documentation-plans`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "name": "Mortgage Offer Documentation",
  "description": "Bank (lender) uploads mortgage offer letter",
  "isActive": true,
  "documentDefinitions": [
    {
      "documentType": "MORTGAGE_OFFER_LETTER",
      "documentName": "Mortgage Offer Letter",
      "uploadedBy": "LENDER",
      "order": 1,
      "isRequired": true
    }
  ],
  "approvalStages": [
    {
      "name": "Bank Document Upload",
      "order": 1,
      "organizationTypeCode": "BANK",
      "autoTransition": true,
      "waitForAllDocuments": true
    }
  ]
}
```

---

### Step 4.6: Create Payment Method (5 Phases)

**Endpoint:** `POST /payment-methods`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "name": "10/90 Lekki Mortgage",
  "description": "Prequalification → Sales Offer → KYC → Downpayment → Mortgage Offer",
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

---

### Step 4.7: Link Payment Method to Property

**Endpoint:** `POST /payment-methods/{{paymentMethodId}}/properties`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "propertyId": "{{propertyId}}",
  "isDefault": true
}
```

---

## Phase 5: Customer Application

### Step 5.1: Chidi Creates Application

**Endpoint:** `POST /applications`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Customer - Chidi)

#### Request Body

```json
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

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "title": "Purchase Agreement - Lekki Gardens Unit 14B",
    "status": "PENDING",
    "totalAmount": 85000000,
    "phases": [
      {
        "id": "...",
        "name": "Prequalification",
        "order": 1,
        "status": "IN_PROGRESS"
      },
      { "id": "...", "name": "Sales Offer", "order": 2, "status": "PENDING" },
      {
        "id": "...",
        "name": "Preapproval Documentation",
        "order": 3,
        "status": "PENDING"
      },
      {
        "id": "...",
        "name": "10% Downpayment",
        "order": 4,
        "status": "PENDING",
        "totalAmount": 8500000
      },
      { "id": "...", "name": "Mortgage Offer", "order": 5, "status": "PENDING" }
    ]
  }
}
```

---

## Phase 6: Prequalification Questionnaire

### Step 6.1: Chidi Submits Questionnaire Answers

**Endpoint:** `POST /applications/{{applicationId}}/phases/{{prequalificationPhaseId}}/questionnaire/submit`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Customer - Chidi)

#### Request Body

```json
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

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "phaseId": "...",
    "status": "AWAITING_APPROVAL",
    "score": 100,
    "passingScore": 100,
    "passed": true
  }
}
```

---

### Step 6.2: Admin Approves Prequalification

**Endpoint:** `POST /applications/{{applicationId}}/phases/{{prequalificationPhaseId}}/questionnaire/review`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Admin)

#### Request Body

```json
{
  "decision": "APPROVE",
  "notes": "Chidi meets all eligibility criteria. Approved for mortgage."
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "phaseId": "...",
    "status": "COMPLETED"
  }
}
```

---

## Phase 7: Sales Offer

### Step 7.1: Developer Uploads Sales Offer Letter

**Endpoint:** `POST /applications/{{applicationId}}/phases/{{salesOfferPhaseId}}/documents`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Developer - Emeka)

#### Request Body

```json
{
  "documentType": "SALES_OFFER_LETTER",
  "url": "https://s3.amazonaws.com/qshelter/developer/sales-offer-chidi.pdf",
  "fileName": "sales-offer-letter.pdf"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "...",
    "documentType": "SALES_OFFER_LETTER",
    "status": "UPLOADED"
  }
}
```

> **Note:** Phase auto-completes when developer uploads the required document.

---

## Phase 8: KYC Documentation (Two-Stage Review)

> **Important:** KYC documents go through a **two-stage approval workflow**:
>
> 1. **Stage 1 (PLATFORM):** Adaeze (Mortgage Operations Officer) reviews documents uploaded by CUSTOMER
> 2. **Stage 2 (BANK):** Lender documents (preapproval letter) are **auto-approved** when uploaded by the lender
>
> Each stage is responsible for reviewing documents from specific uploaders:
>
> - **PLATFORM stage** → reviews CUSTOMER and PLATFORM uploads
> - **BANK stage** → reviews LENDER uploads (auto-approved when lender uploads their own documents)
>
> The phase completes when both stages have approved all their respective documents.

### Step 8.1: Chidi Uploads KYC Documents

Customer uploads three documents.

**Endpoint:** `POST /applications/{{applicationId}}/phases/{{kycPhaseId}}/documents`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Customer - Chidi)

#### Document 1: ID Card

```json
{
  "documentType": "ID_CARD",
  "url": "https://s3.amazonaws.com/qshelter/chidi/id.pdf",
  "fileName": "id.pdf"
}
```

#### Document 2: Bank Statements

```json
{
  "documentType": "BANK_STATEMENT",
  "url": "https://s3.amazonaws.com/qshelter/chidi/bank.pdf",
  "fileName": "bank.pdf"
}
```

#### Document 3: Employment Letter

```json
{
  "documentType": "EMPLOYMENT_LETTER",
  "url": "https://s3.amazonaws.com/qshelter/chidi/employment.pdf",
  "fileName": "employment.pdf"
}
```

---

### Step 8.2: Stage 1 - Adaeze (QShelter) Reviews Documents

QShelter Mortgage Operations Officer performs platform verification of CUSTOMER-uploaded documents.

**Endpoint:** `POST /applications/{{applicationId}}/documents/{{documentId}}/review`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Adaeze - Mortgage Operations Officer)

#### Request Body (for each customer document)

```json
{
  "status": "APPROVED",
  "organizationTypeCode": "PLATFORM",
  "comment": "QShelter review: Document verified by Mortgage Operations"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "...",
    "decision": "APPROVED",
    "stageProgressId": "..."
  }
}
```

> **Note:** After all 3 customer documents are approved by PLATFORM, Stage 1 automatically completes and Stage 2 (BANK) activates.

---

### Step 8.3: Stage 2 - Nkechi (Bank) Uploads Preapproval Letter (Auto-Approved)

When the lender uploads their preapproval letter during Stage 2 (BANK), the document is **automatically approved** because the uploader matches the stage's organization type. This is by design: uploaders don't need to review their own documents.

**Endpoint:** `POST /applications/{{applicationId}}/phases/{{kycPhaseId}}/documents`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Lender - Nkechi)

#### Request Body

```json
{
  "documentType": "PREAPPROVAL_LETTER",
  "url": "https://s3.amazonaws.com/qshelter/lender/preapproval-chidi.pdf",
  "fileName": "preapproval-letter.pdf"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "document": {
      "id": "...",
      "documentType": "PREAPPROVAL_LETTER",
      "status": "APPROVED"
    }
  }
}
```

> **Important:** The document status is immediately `APPROVED` because:
>
> 1. Current stage is BANK (Stage 2)
> 2. PREAPPROVAL_LETTER is defined with `uploadedBy: LENDER`
> 3. LENDER maps to BANK organization type
> 4. Uploaders don't review their own documents - they are auto-approved
>
> After the auto-approval, Stage 2 completes and the entire KYC phase becomes COMPLETED.

---

### Step 8.4: Verify KYC Phase Completed

**Endpoint:** `GET /applications/{{applicationId}}/phases/{{kycPhaseId}}`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Customer - Chidi)

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "COMPLETED",
    "type": "DOCUMENTATION"
  }
}
```

---

## Phase 9: Downpayment

### Step 9.1: Generate Downpayment Installment

**Endpoint:** `POST /applications/{{applicationId}}/phases/{{downpaymentPhaseId}}/installments`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Customer - Chidi)

#### Request Body

```json
{
  "startDate": "2026-01-25T00:00:00.000Z"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "installments": [
      {
        "id": "...",
        "amount": 8500000,
        "dueDate": "2026-01-25T00:00:00.000Z",
        "status": "PENDING"
      }
    ]
  }
}
```

---

### Step 9.2: Chidi Makes Payment

**Endpoint:** `POST /applications/{{applicationId}}/payments`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Customer - Chidi)

#### Request Body

```json
{
  "phaseId": "{{downpaymentPhaseId}}",
  "installmentId": "{{downpaymentInstallmentId}}",
  "amount": 8500000,
  "paymentMethod": "BANK_TRANSFER",
  "externalReference": "TRF-CHIDI-DOWNPAYMENT-001"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "...",
    "reference": "PAY-...",
    "amount": 8500000,
    "status": "PENDING"
  }
}
```

---

### Step 9.3: Process Payment Confirmation

**Endpoint:** `POST /applications/payments/process`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Customer)

#### Request Body

```json
{
  "reference": "{{paymentReference}}",
  "status": "COMPLETED",
  "gatewayTransactionId": "GW-TRX-123456"
}
```

> **Note:** Phase completes when payment is confirmed.

---

## Phase 10: Mortgage Offer

### Step 10.1: Lender Uploads Mortgage Offer Letter

**Endpoint:** `POST /applications/{{applicationId}}/phases/{{mortgageOfferPhaseId}}/documents`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Lender - Nkechi)

#### Request Body

```json
{
  "documentType": "MORTGAGE_OFFER_LETTER",
  "url": "https://s3.amazonaws.com/qshelter/lender/mortgage-offer-chidi.pdf",
  "fileName": "mortgage-offer-letter.pdf"
}
```

> **Note:** Application completes when all phases are done.

---

### Step 10.2: Verify Application Completion

**Endpoint:** `GET /applications/{{applicationId}}`  
**Service:** Mortgage Service  
**Authentication:** Bearer Token (Customer - Chidi)

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "...",
    "title": "Purchase Agreement - Lekki Gardens Unit 14B",
    "status": "COMPLETED",
    "totalAmount": 85000000,
    "phases": [
      { "name": "Prequalification", "status": "COMPLETED" },
      { "name": "Sales Offer", "status": "COMPLETED" },
      { "name": "Preapproval Documentation", "status": "COMPLETED" },
      { "name": "10% Downpayment", "status": "COMPLETED" },
      { "name": "Mortgage Offer", "status": "COMPLETED" }
    ]
  }
}
```

---

## Authorization & Access Control

### Authentication

All authenticated endpoints require:

```
Authorization: Bearer {{accessToken}}
```

### Role-Based Permissions

| Role          | Permissions                                           |
| ------------- | ----------------------------------------------------- |
| **admin**     | Full access to all resources                          |
| **user**      | View properties, manage own applications              |
| **DEVELOPER** | Upload sales offer letters for properties they manage |
| **LENDER**    | Upload preapproval and mortgage offer letters         |

### Multi-Tenancy

- All data is isolated by `tenantId`
- Users from one tenant cannot access another tenant's data
- Cross-tenant access returns `403 Forbidden` or `404 Not Found`

### Ownership Verification

- Customers can only view/modify their own applications
- Attempting to access another customer's application returns `403 Forbidden`

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Common Error Codes

| Status | Code               | Description              |
| ------ | ------------------ | ------------------------ |
| 400    | `VALIDATION_ERROR` | Invalid request body     |
| 401    | `UNAUTHORIZED`     | Missing or invalid token |
| 403    | `FORBIDDEN`        | Insufficient permissions |
| 404    | `NOT_FOUND`        | Resource not found       |
| 409    | `CONFLICT`         | Duplicate resource       |
| 500    | `INTERNAL_ERROR`   | Server error             |

---

## Running the Test

```bash
# Navigate to test directory
cd tests/aws

# Run full E2E test
./scripts/run-full-e2e-staging.sh

# Or run specific patterns
npm run test:full-mortgage -- --testNamePattern="Phase 1"
```

---

## Appendix: Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHIDI'S HOME PURCHASE JOURNEY                      │
└─────────────────────────────────────────────────────────────────────────────┘

SETUP (Admin - Adaeze)
├── Bootstrap tenant & roles
├── Create organizations (Lekki Gardens, Access Bank)
├── Add members (Emeka, Nkechi)
├── Create property (Lekki Gardens Estate, Unit 14B)
├── Create questionnaire & documentation plans
└── Create & link payment method (10/90 Mortgage)

CUSTOMER JOURNEY (Chidi)
├── 1️⃣ PREQUALIFICATION
│   ├── Customer: Submit questionnaire (age, income, employment)
│   └── Admin: Review & approve
│
├── 2️⃣ SALES OFFER
│   └── Developer (Emeka): Upload sales offer letter
│
├── 3️⃣ KYC DOCUMENTATION
│   ├── Customer: Upload ID, bank statements, employment letter
│   ├── Admin: Review & approve documents
│   └── Lender (Nkechi): Upload preapproval letter
│
├── 4️⃣ DOWNPAYMENT
│   ├── Customer: Generate installment (₦8.5M)
│   └── Customer: Pay & confirm
│
└── 5️⃣ MORTGAGE OFFER
    └── Lender (Nkechi): Upload mortgage offer letter

✅ APPLICATION COMPLETED
```

---

_Document generated from E2E test: `tests/aws/full-mortgage-flow/full-mortgage-flow.test.ts`_

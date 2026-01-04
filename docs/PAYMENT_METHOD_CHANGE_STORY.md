# Payment Method Change Flow

## Overview

This document describes the scenario where a customer requests to change their payment method mid-contract. This could happen when a customer wants to:

- Switch from a 10-year mortgage to a 20-year mortgage (lower monthly payments)
- Switch from installment payments to a lump-sum payoff
- Change from one payment plan to another offered by the property

## Actors

| Actor             | Role           | Description                                                                 |
| ----------------- | -------------- | --------------------------------------------------------------------------- |
| **Chidi Okonkwo** | Buyer          | Customer with an active mortgage contract who wants to change payment terms |
| **Adaeze Madu**   | Property Admin | Reviews and approves/rejects payment method change requests                 |
| **System**        | Automated      | Recalculates contract, generates new documents, sends notifications         |

## Pre-conditions

1. Chidi has an active contract for Unit 14B at Lekki Gardens Estate
2. The property has multiple payment methods configured
3. Chidi has completed at least one phase (e.g., downpayment) but has remaining balance
4. The new payment method is valid for Chidi's remaining balance

## Scenario: Chidi Switches from 20-Year to 15-Year Mortgage

### Context

Chidi purchased Unit 14B for ₦85,000,000 with:

- 10% downpayment (₦8,500,000) — **COMPLETED**
- 20-year mortgage at 9.5% p.a. for ₦76,500,000 — **IN PROGRESS**

After 2 years, Chidi got a promotion and wants to pay off faster with a 15-year mortgage at 9.0% p.a.

### Flow

#### Step 1: Chidi Requests Payment Method Change

**Trigger:** Chidi opens the app and navigates to his contract settings.

1. Chidi selects "Request Payment Method Change"
2. System shows available payment methods for the property
3. Chidi selects "15-Year Mortgage @ 9.0% p.a."
4. Chidi provides reason: "Got a promotion, want to pay off faster"
5. System creates a `PaymentMethodChangeRequest` with status `PENDING`
6. System sends notification to Adaeze (admin) about the new request
7. System sends confirmation to Chidi that request was submitted

**API:** `POST /contracts/:contractId/payment-method-change-requests`

```json
{
  "newPaymentMethodId": "pm_15yr_mortgage",
  "reason": "Got a promotion, want to pay off faster"
}
```

#### Step 2: System Calculates Impact Preview

**Trigger:** Request is created.

1. System calculates what the new terms would look like:
   - Current remaining balance: ₦74,200,000 (after 2 years of payments)
   - New term: 15 years (180 months remaining)
   - New interest rate: 9.0% p.a.
   - New monthly payment: ₦752,847 (up from ₦688,754)
   - Total interest saved: ₦12,500,000 over life of loan
2. System stores preview in the change request record
3. Preview is visible to both Chidi and Adaeze

#### Step 3: Adaeze Reviews the Request

**Trigger:** Adaeze receives notification and opens the admin dashboard.

1. Adaeze sees pending payment method change requests
2. Adaeze opens Chidi's request and sees:
   - Current payment method details
   - Proposed payment method details
   - Impact preview (new monthly payment, total savings)
   - Chidi's payment history (on-time, no defaults)
   - Chidi's stated reason
3. Adaeze can:
   - **Approve** — proceed with the change
   - **Reject** — decline with reason
   - **Request More Info** — ask Chidi for additional documentation

#### Step 4: Adaeze Approves the Request

**Trigger:** Adaeze clicks "Approve" on the request.

**API:** `POST /contracts/:contractId/payment-method-change-requests/:requestId/approve`

1. System validates the request is still valid:
   - Contract is still active
   - No payments pending/processing
   - New payment method is still available
2. System updates request status to `APPROVED`
3. System marks current mortgage phase as `SUPERSEDED` (new status)
4. System creates new mortgage phase with updated terms:
   - Principal: ₦74,200,000 (remaining balance)
   - Interest rate: 9.0% p.a.
   - Term: 15 years (180 months)
   - Monthly payment: ₦752,847
5. System generates new installment schedule (180 installments)
6. System generates amended offer letter documenting the change
7. System updates contract's `paymentMethodId` to the new method
8. System writes audit events for the change
9. System sends notification to Chidi that request was approved
10. System sends amended offer letter to Chidi for acknowledgment

#### Step 5: Chidi Acknowledges the New Terms

**Trigger:** Chidi receives notification and amended offer letter.

**API:** `POST /offer-letters/:offerId/sign`

1. Chidi reviews the amended terms in the offer letter
2. Chidi signs/acknowledges the new terms
3. System activates the new mortgage phase
4. Chidi's next payment is due according to new schedule

### Alternative Flow: Adaeze Rejects the Request

**Trigger:** Adaeze clicks "Reject" on the request.

**API:** `POST /contracts/:contractId/payment-method-change-requests/:requestId/reject`

```json
{
  "reason": "Property does not allow mid-contract payment method changes for this unit type"
}
```

1. System updates request status to `REJECTED`
2. System records rejection reason
3. System sends notification to Chidi with rejection reason
4. Contract continues unchanged

### Alternative Flow: Chidi Cancels the Request

**Trigger:** Chidi changes his mind before approval.

**API:** `POST /contracts/:contractId/payment-method-change-requests/:requestId/cancel`

1. System validates request is still `PENDING`
2. System updates request status to `CANCELLED`
3. No further action needed

## Edge Cases & Business Rules

### When Changes Are NOT Allowed

1. **Final phase in progress** — Cannot change if in the last phase of the contract
2. **Payment currently processing** — Must wait for pending payments to clear
3. **Contract in default** — Cannot change if customer has missed payments
4. **Within first 6 months** — Some properties may enforce a minimum period before changes
5. **New method not compatible** — New method's minimum amount may not match remaining balance

### Prorated Adjustments

If Chidi has already paid part of the current month:

1. System calculates the per-diem rate for the old plan
2. System credits the paid portion to the new plan
3. New plan starts from the prorated date

### Interest Recalculation

When switching between interest rates:

1. All accrued interest up to change date is finalized
2. New interest rate applies only to remaining principal from change date
3. No retroactive interest adjustments

## Domain Events

| Event                          | When     | Payload                                                 |
| ------------------------------ | -------- | ------------------------------------------------------- |
| `paymentMethodChangeRequested` | Step 1   | requestId, contractId, fromMethodId, toMethodId, reason |
| `paymentMethodChangeApproved`  | Step 4   | requestId, contractId, newPhaseId, effectiveDate        |
| `paymentMethodChangeRejected`  | Alt Flow | requestId, contractId, reason                           |
| `paymentMethodChangeCancelled` | Alt Flow | requestId, contractId                                   |
| `contractAmended`              | Step 4   | contractId, amendmentType, details                      |

## Data Model Changes

### New Status for ContractPhase

Add `SUPERSEDED` to `ContractPhaseStatus` enum — indicates a phase was replaced by a payment method change.

### PaymentMethodChangeRequest (existing model)

```prisma
model PaymentMethodChangeRequest {
  id                     String   @id @default(uuid())
  tenantId               String
  contractId             String
  currentPaymentMethodId String
  newPaymentMethodId     String
  reason                 String?
  status                 PaymentMethodChangeRequestStatus @default(PENDING)

  // Impact preview (calculated when request is created)
  currentMonthlyPayment  Float?
  newMonthlyPayment      Float?
  remainingBalance       Float?
  estimatedSavings       Float?

  // Processing
  requestedAt            DateTime @default(now())
  processedAt            DateTime?
  processedBy            String?
  rejectionReason        String?

  // Link to new phase created on approval
  newPhaseId             String?

  // Relations
  tenant                 Tenant   @relation(...)
  contract               Contract @relation(...)
  currentPaymentMethod   PropertyPaymentMethod @relation("CurrentMethod", ...)
  newPaymentMethod       PropertyPaymentMethod @relation("NewMethod", ...)
  newPhase               ContractPhase? @relation(...)
  processedByUser        User? @relation(...)
}
```

## API Endpoints

| Method | Endpoint                                                           | Description                |
| ------ | ------------------------------------------------------------------ | -------------------------- |
| POST   | `/contracts/:id/payment-method-change-requests`                    | Create change request      |
| GET    | `/contracts/:id/payment-method-change-requests`                    | List requests for contract |
| GET    | `/contracts/:id/payment-method-change-requests/:requestId`         | Get request details        |
| POST   | `/contracts/:id/payment-method-change-requests/:requestId/approve` | Approve request            |
| POST   | `/contracts/:id/payment-method-change-requests/:requestId/reject`  | Reject request             |
| POST   | `/contracts/:id/payment-method-change-requests/:requestId/cancel`  | Cancel request             |
| GET    | `/payment-method-change-requests`                                  | List all requests (admin)  |

## Test Scenarios

1. **Happy path** — Request → Approve → Acknowledge → New schedule active
2. **Rejection** — Request → Reject → Contract unchanged
3. **Cancellation** — Request → Cancel → Contract unchanged
4. **Concurrent payment** — Request while payment processing → Blocked
5. **Default customer** — Customer with missed payments → Blocked
6. **Final phase** — Request during last phase → Blocked
7. **Preview accuracy** — Verify preview calculations match actual new terms

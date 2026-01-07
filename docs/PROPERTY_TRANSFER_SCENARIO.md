# Scenario: Property Transfer with Progress Preservation

Last Updated: 2026-01-07

## Summary

Buyer (Chidi) has an active contract with a 10/90 payment method where the 10% downpayment is paid in 12 monthly instalments. After receiving a provisional offer and paying through month 6, Chidi requests to transfer to a different property while preserving all payments, completed workflow steps, and remaining progress.

## Actors

- **Jinx** — Admin (Loan Operations Manager) who creates payment-method templates and approves transfer requests
- **Chidi** — Buyer who has made payments and requests property transfer
- **System** — Mortgage platform services

## Context / Preconditions

1. Tenant "QShelter" exists with active subscription
2. Jinx created a "10/90 Mortgage" payment method:
   - 10% downpayment phase (split into 12 monthly instalments)
   - 90% mortgage phase (20 years monthly)
3. Two properties exist:
   - **Property X** (Lekki Gardens Unit A1) — ₦10,000,000
   - **Property Y** (Victoria Island Unit B3) — ₦11,000,000
4. Chidi has **Contract A** for Property X with:
   - Pre-approval questionnaire completed ✓
   - KYC documents uploaded and approved ✓
   - Provisional offer letter issued ✓
   - 6 of 12 downpayment instalments paid (₦500,000 total)

## Primary Flow

### Step 1: Chidi Requests Transfer

Chidi submits a transfer request via API:

```json
POST /contracts/{contractAId}/transfer-requests
{
  "targetPropertyUnitId": "property-y-unit-b3",
  "reason": "Prefer location closer to workplace"
}
```

- System creates `PropertyTransferRequest` with status `PENDING`
- System emits `transfer.requested` event
- Admin notification sent to Jinx

### Step 2: Jinx Reviews Transfer Request

Jinx retrieves and reviews the request:

```json
GET /transfer-requests/{requestId}
```

Response includes:

- Source contract summary (payments made, steps completed)
- Target property details (availability, price difference)
- Computed adjustment amount (if any)

### Step 3: Jinx Approves Transfer

```json
PATCH /transfer-requests/{requestId}/approve
{
  "notes": "Approved - price difference to be added to first mortgage payment",
  "priceAdjustmentHandling": "ADD_TO_MORTGAGE"
}
```

### Step 4: System Executes Transfer

Upon approval, the system atomically:

1. **Creates Contract B** for Property Y:

   - Copies buyer info, payment method config
   - Sets `transferredFromId = contractA.id`
   - Calculates new amounts based on Property Y price

2. **Migrates Completed Workflow Steps**:

   - Pre-approval answers → copied
   - KYC documents → referenced (not duplicated)
   - Approval statuses → preserved

3. **Migrates Payment Records**:

   - Creates payment entries in Contract B referencing original transaction IDs
   - Marks as `MIGRATED` for audit trail
   - Recalculates remaining schedule

4. **Updates Contract A**:

   - Status → `TRANSFERRED`
   - Links to Contract B
   - Becomes read-only

5. **Issues New Offer Letter**:

   - Generates provisional offer for Contract B
   - Reflects new property and adjusted amounts

6. **Emits Events**:
   - `contract.transferred`
   - `payments.migrated`
   - `offer_letter.generated`
   - `notification.sent`

### Step 5: Chidi Resumes Workflow

Chidi continues from the correct position:

- Next payment due: Instalment 7 of 12
- All prior approvals remain valid
- New offer letter available for review

## Alternate Flows

### 3a. Jinx Rejects Transfer

```json
PATCH /transfer-requests/{requestId}/reject
{
  "reason": "Target property not available for this payment method"
}
```

- Status → `REJECTED`
- Notification sent to Chidi
- Contract A remains active

### 4a. Price Difference Requires Adjustment Payment

If Property Y costs more and threshold exceeded:

- Transfer pauses with status `PENDING_ADJUSTMENT`
- Chidi must make adjustment payment
- Once paid, transfer completes

### 4b. Target Property Unavailable

- Transfer fails with status `FAILED`
- Reason: "Target unit no longer available"
- Contract A remains active

## API Endpoints

| Method | Endpoint                           | Description                           |
| ------ | ---------------------------------- | ------------------------------------- |
| POST   | `/contracts/:id/transfer-requests` | Create transfer request               |
| GET    | `/transfer-requests`               | List transfer requests (admin)        |
| GET    | `/transfer-requests/:id`           | Get transfer request details          |
| PATCH  | `/transfer-requests/:id/approve`   | Approve transfer                      |
| PATCH  | `/transfer-requests/:id/reject`    | Reject transfer                       |
| GET    | `/contracts/:id`                   | Get contract (includes transfer info) |

## Data Model Changes

### PropertyTransferRequest

```prisma
model PropertyTransferRequest {
  id                  String   @id @default(cuid())
  tenantId            String
  sourceContractId    String
  targetPropertyUnitId String
  requestedById       String   // Buyer who requested
  reviewedById        String?  // Admin who approved/rejected

  status              TransferRequestStatus @default(PENDING)
  reason              String?  @db.Text
  reviewNotes         String?  @db.Text
  priceAdjustment     Float?   // Computed price difference

  // Result
  targetContractId    String?  // New contract created after approval

  createdAt           DateTime @default(now())
  reviewedAt          DateTime?
  completedAt         DateTime?
}

enum TransferRequestStatus {
  PENDING
  APPROVED
  REJECTED
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

### Contract Additions

```prisma
model Contract {
  // ... existing fields ...

  // Transfer tracking
  transferredFromId   String?  // Source contract if this was created via transfer
  transferredToId     String?  // Target contract if this was transferred

  status ContractStatus // Add TRANSFERRED to enum
}
```

## E2E Test Assertions

1. **Transfer Request Created**

   - HTTP 201 returned
   - Status = `PENDING`
   - Price adjustment calculated correctly

2. **After Approval**

   - New Contract B exists with `propertyUnitId = propertyY`
   - Contract B has 6 payment records matching Contract A transaction IDs
   - Contract A status = `TRANSFERRED`
   - Contract A `transferredToId = contractB.id`
   - Contract B `transferredFromId = contractA.id`

3. **Workflow Continuity**

   - Contract B phase 1 (documentation) status = `COMPLETED`
   - Contract B phase 2 (downpayment) shows 6 of 12 paid
   - Next scheduled payment = instalment 7

4. **Notifications**
   - Admin notified of transfer request
   - Buyer notified of approval
   - New offer letter generated

## Test Data

```typescript
const PROPERTY_X = {
  title: "Lekki Gardens",
  price: 10_000_000,
  unitNumber: "A1",
};

const PROPERTY_Y = {
  title: "Victoria Island Towers",
  price: 11_000_000,
  unitNumber: "B3",
};

const PAYMENT_METHOD = {
  name: "10/90 Mortgage",
  downpaymentPercent: 10,
  downpaymentInstalments: 12,
  mortgagePercent: 90,
  mortgageTermMonths: 240,
};

const CHIDI_PAYMENTS = [
  { month: 1, amount: 83333.33 },
  { month: 2, amount: 83333.33 },
  { month: 3, amount: 83333.33 },
  { month: 4, amount: 83333.33 },
  { month: 5, amount: 83333.33 },
  { month: 6, amount: 83333.33 },
]; // Total: ₦500,000 (6 of 12 instalments of 10% of ₦10M)
```

## Implementation Notes

- Use database transaction for atomic transfer operation
- Preserve immutable payment receipts (reference, don't move)
- Emit domain events for each sub-step for handler ecosystem
- Enforce tenant scoping via `createTenantPrisma`
- Admin UI should show transfer request queue with filtering

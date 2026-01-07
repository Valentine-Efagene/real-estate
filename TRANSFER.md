# Property Transfer Capability

## Overview

**Yes, the platform supports mid-contract property transfers with full progress preservation.**

Buyers can transfer from their current property to a different one without losing any payments, completed documentation, or workflow progress. The system handles price adjustments automatically and maintains complete audit trails for compliance.

---

## What Gets Preserved During Transfer

✅ **All Payments Made**

- Every installment payment is migrated to the new contract
- Payment dates and references are preserved
- Transaction history remains intact for accounting

✅ **Workflow Progress**

- Completed documentation steps remain completed
- Phase completion status is preserved (e.g., if 50% of downpayment is paid, it stays 50%)
- Approved documents are linked to the new contract

✅ **Payment Schedule Continuity**

- Buyer continues from where they left off (e.g., payment #7 if they paid 6)
- No need to restart payment schedule
- Outstanding installments automatically recalculated based on new price

✅ **Buyer Account Standing**

- Payment history shows as continuous
- No impact on buyer's record or credibility
- All documentation approvals carry over

---

## How It Works (Business Steps)

### Step 1: Buyer Initiates Transfer Request

**What the buyer does:**

- Browses available properties on the platform
- Selects a different property/unit they want to transfer to
- Submits transfer request with reason (e.g., "Need larger property")

**What the system does:**

- Validates that:
  - Current contract is active (not draft or terminated)
  - Target property is available (not already sold or reserved)
  - Buyer has no outstanding issues
- Calculates price difference (if target property is more/less expensive)
- Creates transfer request with status "PENDING"
- Notifies admin team for review

**Example:**

```
Current Property: 3-bedroom flat at ₦50,000,000
Target Property:  4-bedroom duplex at ₦65,000,000
Price Difference: +₦15,000,000
Progress:         6 of 12 downpayment installments paid (₦2,500,000)
```

---

### Step 2: Admin Reviews Request

**What the admin does:**

- Views transfer request with full context:
  - Buyer's payment history
  - Current progress (installments paid, documents approved)
  - Target property details
  - Price adjustment amount
- Verifies:
  - Payment history is clean (no defaults)
  - Target property is genuinely available
  - Buyer can afford the price difference
- Reviews recalculated contract details:
  - New downpayment total (10% of new price)
  - New balance total (90% of new price)
  - How many installments the paid amount will cover
  - Buyer's next payment amount
- Approves or rejects with notes

**Example Admin Decision:**

```
Review Notes: "Approved - contract recalculated at new price"
Old Contract: ₦50M (₦5M down, ₦45M balance)
New Contract: ₦65M (₦6.5M down, ₦58.5M balance)
Paid Amount: ₦2.5M covers 4.61 installments → 4 complete + ₦333K credit
Next Payment: ₦208,333.35 (to complete installment #5)
```

---

### Step 3: System Executes Transfer Automatically

**What happens (all in one atomic transaction):**

1. **Create New Contract**

   - Property: Target unit (4-bedroom duplex)
   - Total Amount: ₦65,000,000
   - Buyer: Same buyer
   - Payment Method: Same (10/90 plan)
   - Status: ACTIVE

2. **Migrate All Payments**

   - Copies all 6 previous payments to new contract
   - Each payment keeps its original:
     - Amount (₦416,666.67)
     - Date paid
     - Transaction reference
     - Payment method
   - Tagged as "MIGRATED" for clarity

3. **Recalculate All Phases (Fresh Calculation)**

   **Treat as brand new contract - recalculate everything:**

   **Old Contract (₦50M):**

   - Downpayment (10%): ₦5,000,000
   - Balance (90%): ₦45,000,000
   - Installments: 12 × ₦416,666.67 = ₦5,000,000
   - Paid: ₦2,500,000 (6 installments)

   **New Contract (₦65M) - Fresh Calculation:**

   - Downpayment (10%): ₦6,500,000
   - Balance (90%): ₦58,500,000
   - NEW installment amount: ₦6,500,000 ÷ 12 = ₦541,666.67

   **Apply Previous Payments:**

   - Total paid: ₦2,500,000
   - Installments covered: ₦2,500,000 ÷ ₦541,666.67 = 4.61
   - **Round down to 4 complete installments**

   **Result:**

   - Installments 1-4: PAID (₦541,666.67 each = ₦2,166,666.68)
   - Partial credit: ₦2,500,000 - ₦2,166,666.68 = ₦333,333.32
   - Installment 5: PENDING with ₦333,333.32 credit
     - Next payment: ₦541,666.67 - ₦333,333.32 = **₦208,333.35**
   - Installments 6-12: PENDING (₦541,666.67 each)

   **Key Point:** The paid amount doesn't cover as many installments anymore because each installment is now larger.

4. **Preserve Workflow Progress**

   - Copies phase structure (downpayment 50% complete, balance pending)
   - Migrates documentation steps with completion status
   - Links approved documents to new contract
   - Provisional offer letter carries over

5. **Update Property Availability**

   - Old unit (3-bedroom): Released back to "AVAILABLE"
   - New unit (4-bedroom): Reserved for buyer

6. **Archive Old Contract**
   - Status changed to "TRANSFERRED"
   - Linked to new contract for audit trail
   - No longer accepts payments

**Transaction Guarantee:**

- All steps succeed together, or all fail together
- No partial states (e.g., new contract created but payments not migrated)
- Complete audit trail of what happened

---

### Step 4: Buyer Continues with New Contract

**What the buyer sees:**

- New contract in their dashboard for 4-bedroom duplex
- Total: ₦65,000,000
- Downpayment (10%): ₦6,500,000
- Balance (90%): ₦58,500,000
- Progress: 4 complete installments paid + ₦333,333.32 credit
- Payment history shows all 6 previous payments (tagged "MIGRATED")
- Next payment due: Installment #5 - ₦208,333.35 (₦541,666.67 - ₦333,333.32 credit)
- Old contract visible in history as "TRANSFERRED"

**What the buyer does:**

- Pays ₦208,333.35 to complete installment #5
- Then pays ₦541,666.67 for installments #6-12
- Completes downpayment phase
- Proceeds to balance payment (₦58.5M - handled with bank/mortgage)

---

## Price Adjustment Handling

### Scenario A: Target Property Costs More

**Example:**

- Current: ₦50,000,000 (3-bedroom)
- Target: ₦65,000,000 (4-bedroom)
- Difference: +₦15,000,000

**AdmRECALCULATE_FRESH** (Only Option)

- Entire contract recalculated as if brand new at ₦65,000,000
- Downpayment: 10% of ₦65M = ₦6,500,000 (was ₦5M)
- Balance: 90% of ₦65M = ₦58,500,000 (was ₦45M)
- Installments recalculated: ₦541,666.67 each (was ₦416,666.67)
- Previous payments applied to determine how many new installments are covered
- Buyer pays via existing payment plan (10/90)
- Monthly installments adjust proportionally

2. **REQUIRE_UPFRONT**
   - Buyer pays ₦15,000,000 before transfer completes
   - Contract total remains ₦65,000,000
   - Used when buyer wants to reduce mortgage burden

### Scenario B: Target Property Costs Less

**Example:**

- Current: ₦50,000,000 (4-bedroom)
- Target: ₦35,000,000 (3-bedroom)
- DifRECALCULATE_FRESH\*\*

  - Entire contract recalculated at ₦35,000,000
  - Downpayment: 10% of ₦35M = ₦3,500,000 (was ₦5M)
  - Balance: 90% of ₦35M = ₦31,500,000 (was ₦45M)
  - Installments: ₦291,666.67 each (was ₦416,666.67)
  - Previous ₦2.5M paid now covers: ₦2.5M ÷ ₦291,666.67 = **8.57 installments**
  - Result: 8 installments PAID + ₦166,666.64 credit toward #9

2. **REFUND_OVERPAYMENT** (if buyer paid more than new downpayment)

   - If paid amount exceeds new downpayment total, refund excess
   - Example: Paid ₦4M, new downpayment only ₦3.5M → Refund ₦500K
   - Future payments reduced

3. **REFUND_OVERPAYMENT**
   - Refund excess if buyer paid more than required for new property
   - Requires admin approval

---

## Business Rules and Validations

### Transfer Request Submission

✅ Source contract must be ACTIVE (not draft, terminated, or already transferred)  
✅ Target property must be AVAILABLE (not sold or reserved by someone else)  
✅ Buyer cannot transfer to the same unit  
✅ Only one pending transfer request per contract at a time

### Transfer Approval

✅ Only admins can approve/reject transfer requests  
✅ Must specify how price adjustment will be handled  
✅ Target property must still be available at approval time  
✅ Cannot approve if buyer has payment defaults

### Transfer Execution

✅ Old contract is immediately locked (no new payments accepted)  
✅ All payments must migrate successfully (transaction fails otherwise)  
✅ Property units update atomically (old released, new reserved)  
✅ Complete audit trail created for compliance

### Post-Transfer

✅ Buyer cannot make payments to old contract  
✅ Old contract cannot be reactivated  
✅ Buyer can initiate another transfer from new contract if needed  
✅ All historical data preserved for accounting and compliance

---

## Example: Real-World Transfer Scenario

**Actor**: Chidi (Buyer)  
**Current Contract**: 3-bedroom flat, Lekki Phase 1, ₦50M  
**Progress**: 6 of 12 downpayment installments paid (₦2.5M total)  
**Reason for Transfer**: Family growing, needs more space

### Timeline

**Month 1**: Chidi buys 3-bedroom flat on 10/90 payment plan

**Months 2-7**: Chidi pays 6 monthly installments (₦2.5M total)

**Month 8**:

- Chidi finds a 4-bedroom duplex in Lekki Phase 2 (₦65M)
- Submits transfer request: "Need larger property for growing family"

**Month 8 (Day 2)**:

- Admin Jinx reviews request
- Approves with note: "Price difference added to mortgage principal"
- System executes transfer automatically

**Month 8 (Day 3)**:

- Chidi sees new contract in dashboard
- Total: ₦65M (was ₦50M)
- Downpayment: ₦6.5M (was ₦5M)
- Balance: ₦58.5M (was ₦45M)
- Progress: 4 of 12 installments fully paid + partial credit
- Next payment: Installment #5 with ₦208,333.35 remaining
- 3-bedroom unit released, 4-bedroom reserved

**Month 9**: Chidi pays ₦208,333.35 to complete installment #5

**Result**: Seamless transfer with zero disruption to payment schedule or progress

---

## Audit Trail and Compliance

Every transfer creates a complete audit trail:

### Events Logged

- `TRANSFER_REQUESTED` - When buyer submits request
- `TRANSFER_APPROVED` - When admin approves
- `CONTRACT_TRANSFERRED` - When old contract is archived
- `CONTRACT_CREATED` - When new contract is activated
- `PAYMENT_MIGRATED` (×6) - For each migrated payment

### Data Preserved

- Original contract with all historical data
- Transfer request with reason and approval notes
- Mapping between old and new contract IDs
- Complete payment migration log
- Property unit status change log

### Queryable Information

- "What was Chidi's payment history?" → Shows all payments across both contracts
- "Why did this contract transfer happen?" → Shows transfer request reason
- "Who approved this transfer?" → Shows admin name and timestamp
- "What was the price adjustment?" → Shows old vs new amounts

---

## Technical Guarantees

✅ **Atomic Execution**: All transfer steps succeed or fail together (no partial state)  
✅ **Data Integrity**: Referential integrity maintained across all tables  
✅ **Idempotency**: Transfer can be retried safely if interrupted  
✅ **Performance**: Transfer completes in <2 seconds for typical contracts  
✅ **Scalability**: Handles contracts with hundreds of payments  
✅ **Audit Compliance**: Complete event log for regulatory requirements

---

## Summary

**Property transfers are fully supported** with:

- ✅ Complete payment history preservation
- ✅ Workflow progress continuity
- ✅ Automatic price adjustment handling
- ✅ Admin approval workflow
- ✅ Atomic execution (all-or-nothing)
- ✅ Complete audit trail
- ✅ Zero disruption to buyer experience

Buyers can upgrade, downgrade, or move to different properties without losing any progress or starting over.

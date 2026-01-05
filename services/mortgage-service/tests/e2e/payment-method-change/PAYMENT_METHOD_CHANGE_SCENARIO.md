# Payment Method Change E2E Scenario

## Overview

This scenario tests the complete payment method change flow where a customer requests to switch from one mortgage plan to another mid-contract.

## Actors

| Actor             | Role           | Description                                                         |
| ----------------- | -------------- | ------------------------------------------------------------------- |
| **Chidi Okonkwo** | Buyer          | Customer with an active mortgage contract who wants to change terms |
| **Adaeze Madu**   | Property Admin | Reviews and approves/rejects payment method change requests         |
| **System**        | Automated      | Recalculates contract, creates new phases, generates audit trail    |

## Pre-conditions

1. QShelter tenant exists with Adaeze (admin) and Chidi (customer)
2. Lekki Gardens Estate property exists with Unit 22A priced at ₦50,000,000
3. Two payment methods are configured:
   - **Original Method**: 10% downpayment + 20-year mortgage at 9.5% p.a.
   - **New Method**: 10% downpayment + 15-year mortgage at 9.0% p.a.
4. Chidi has an active contract with the original payment method
5. Chidi has completed the downpayment phase (₦5,000,000 paid)

## Test Scenario: Chidi Switches from 20-Year to 15-Year Mortgage

### Context

Chidi purchased Unit 22A for ₦50,000,000 with:

- 10% downpayment (₦5,000,000) — **COMPLETED**
- 20-year mortgage at 9.5% p.a. for ₦45,000,000 — **IN PROGRESS**

After starting payments, Chidi got a promotion and wants to pay off faster with a 15-year mortgage at 9.0% p.a.

### Step 1: Setup - Create Tenant, Users, Property, and Payment Methods

1. Create QShelter tenant
2. Create Adaeze (admin) user
3. Create Chidi (customer) user
4. Create property with Unit 22A
5. Create 10% downpayment plan
6. Create 20-year mortgage plan (9.5% p.a.) - Original
7. Create 15-year mortgage plan (9.0% p.a.) - New alternative
8. Create original payment method (downpayment + 20yr mortgage)
9. Create alternative payment method (downpayment + 15yr mortgage)
10. Link both payment methods to the property

### Step 2: Create and Complete Initial Contract Through Downpayment

1. Chidi creates prequalification application for Unit 22A
2. System evaluates and approves Chidi
3. System creates contract from approved application
4. Chidi submits contract for processing
5. System generates documentation phase
6. Chidi completes documentation steps (simulated)
7. System activates downpayment phase
8. Chidi pays ₦5,000,000 downpayment
9. Mortgage phase becomes active with ₦45,000,000 remaining

### Step 3: Chidi Requests Payment Method Change

**Trigger:** Chidi wants to switch to faster payoff.

1. Chidi creates payment method change request:
   - From: 20-year mortgage at 9.5%
   - To: 15-year mortgage at 9.0%
   - Reason: "Got a promotion, want to pay off faster"
2. System creates request with status `PENDING_DOCUMENTS`
3. System calculates impact preview:
   - Current outstanding: ₦45,000,000
   - New term: 15 years (180 months)
   - New interest rate: 9.0%
   - New monthly payment calculated

**Expected Outcomes:**

- Request created successfully
- Request has financial impact preview
- Domain event `PAYMENT_METHOD_CHANGE.REQUESTED` created

### Step 4: Chidi Submits Documents

1. Chidi submits documents for the change request
2. Status changes to `DOCUMENTS_SUBMITTED`
3. Request appears in admin review queue

**Expected Outcomes:**

- Status is `DOCUMENTS_SUBMITTED`
- Request visible in pending review list

### Step 5: Adaeze Reviews and Approves the Request

**Trigger:** Adaeze opens admin dashboard.

1. Adaeze lists pending change requests
2. Adaeze starts review (status → `UNDER_REVIEW`)
3. Adaeze sees:
   - Current payment method details
   - Proposed payment method details
   - Financial impact preview
   - Chidi's stated reason
4. Adaeze approves the request

**Expected Outcomes:**

- Status is `APPROVED`
- Domain event `PAYMENT_METHOD_CHANGE.APPROVED` created
- Original payment phases NOT yet affected (approval ≠ execution)

### Step 6: System Executes the Payment Method Change

**Trigger:** Admin executes the approved change.

1. System executes the change:
   - Supersedes current mortgage phase (status → `SUPERSEDED`)
   - Creates new mortgage phase with updated terms
   - Updates contract's payment method reference
2. System activates new phase

**Expected Outcomes:**

- Original mortgage phase status is `SUPERSEDED`
- New phase created with 15-year terms
- Contract's paymentMethodId updated to new method
- Request status is `EXECUTED`
- Domain events created: `PAYMENT_METHOD_CHANGE.EXECUTED`, `CONTRACT.AMENDED`

### Step 7: Verify Final State

1. Contract has new payment method
2. Old phase is superseded (preserved for audit)
3. New phase is pending or active
4. Complete audit trail exists

## Alternative Flow: Admin Rejects the Request

### Step 5a: Adaeze Rejects

1. Adaeze reviews request
2. Adaeze rejects with reason: "Minimum 12 months required before payment method changes"

**Expected Outcomes:**

- Status is `REJECTED`
- Domain event `PAYMENT_METHOD_CHANGE.REJECTED` created
- Contract remains unchanged

## Alternative Flow: Chidi Cancels the Request

### Step 4a: Chidi Changes Mind

1. Chidi cancels the pending request

**Expected Outcomes:**

- Status is `CANCELLED`
- Domain event `PAYMENT_METHOD_CHANGE.CANCELLED` created
- No further action possible

## Test Assertions Summary

| Step | Assertion                                             |
| ---- | ----------------------------------------------------- |
| 3    | Request created with PENDING_DOCUMENTS status         |
| 3    | Financial impact calculated (newMonthlyPayment, etc.) |
| 4    | Status transitions to DOCUMENTS_SUBMITTED             |
| 5    | Status transitions to UNDER_REVIEW then APPROVED      |
| 6    | Old phase status is SUPERSEDED                        |
| 6    | New phase created with correct terms                  |
| 6    | Contract paymentMethodId updated                      |
| 6    | Request status is EXECUTED                            |
| 7    | Domain events exist for all transitions               |
| 7    | Audit trail complete with previousPhaseData           |

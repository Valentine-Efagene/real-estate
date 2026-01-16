# Installment Payment Scenario

## Overview

This scenario covers a direct property purchase without bank financing. The customer pays the full property price in 4 installments over a period of time.

## Actors

| Actor      | Role     | Description                                                         |
| ---------- | -------- | ------------------------------------------------------------------- |
| **Amara**  | Customer | Young professional buying her first apartment in Victoria Island    |
| **Adaeze** | Admin    | QShelter operations manager who reviews documents                   |
| **Tunde**  | Legal    | QShelter legal officer who uploads final offer letter after payment |

## Property

- **Location**: Victoria Island Luxury Apartments
- **Unit**: Unit 7A (2-bedroom flat)
- **Price**: ₦45,000,000

## Payment Structure

- **Total**: ₦45,000,000
- **Installments**: 4 equal payments of ₦11,250,000
- **Interval**: Quarterly (every 3 months)

## Flow

```
┌─────────────────────┐
│ Phase 1:            │
│ Prequalification    │  Amara answers questionnaire
│ (QUESTIONNAIRE)     │  → Auto-scored, must pass
└─────────┬───────────┘
          │ Pass
          ▼
┌─────────────────────┐
│ Phase 2:            │
│ KYC Documentation   │  Amara uploads: ID, Bank Statement, Employment Letter
│ (DOCUMENTATION)     │  → Adaeze reviews and approves
└─────────┬───────────┘
          │ All approved
          ▼
┌─────────────────────┐
│ Phase 3:            │
│ Installment Payment │  Amara pays 4 installments of ₦11.25M each
│ (PAYMENT)           │  → Quarterly payments over 12 months
└─────────┬───────────┘
          │ All paid
          ▼
┌─────────────────────┐
│ Phase 4:            │
│ Final Offer Letter  │  Tunde (Legal) uploads final offer letter
│ (DOCUMENTATION)     │  → Application completes
└─────────────────────┘
```

## Detailed Steps

### Phase 1: Prequalification Questionnaire

1. Amara creates application for Unit 7A
2. Prequalification phase auto-activates
3. Amara answers questions:
   - Employment status: EMPLOYED
   - Monthly income: ₦3,000,000
   - Monthly expenses: ₦1,200,000
   - Marital status: SINGLE
4. System scores answers and determines eligibility
5. If passed, phase completes and Phase 2 activates

### Phase 2: KYC Documentation

1. Amara uploads required documents:
   - Valid government ID (NIN, Passport, or Driver License)
   - 6 months bank statements
   - Employment confirmation letter
2. Adaeze reviews and approves each document
3. When all documents approved, phase completes
4. Phase 3 (Payment) activates

### Phase 3: Installment Payment

1. System generates 4 installments of ₦11,250,000 each
2. Installment schedule:
   - Installment 1: Due immediately
   - Installment 2: Due in 3 months
   - Installment 3: Due in 6 months
   - Installment 4: Due in 9 months
3. Amara makes payments via bank transfer
4. System records each payment and updates progress
5. When all 4 installments paid, phase completes
6. Phase 4 activates

### Phase 4: Final Offer Letter

1. Tunde (Legal) prepares final offer letter
2. Tunde uploads the signed offer letter
3. Phase completes automatically (no review required)
4. Application status → COMPLETED
5. Amara receives congratulations notification

## Events Generated

| Event                 | Trigger                            |
| --------------------- | ---------------------------------- |
| APPLICATION.CREATED   | Amara creates application          |
| PHASE.ACTIVATED       | Each phase starts                  |
| PHASE.COMPLETED       | Each phase finishes                |
| PAYMENT.INITIATED     | Each installment payment initiated |
| PAYMENT.COMPLETED     | Each installment payment confirmed |
| APPLICATION.COMPLETED | Final phase completes              |

## Key Differences from Mortgage Flow

| Aspect                | Mortgage Flow                  | Installment Flow           |
| --------------------- | ------------------------------ | -------------------------- |
| Bank involvement      | Yes (Lender role)              | No                         |
| Developer involvement | Yes (Sales offer)              | No                         |
| Downpayment           | 10% upfront                    | No separate downpayment    |
| Payment structure     | Downpayment + Monthly mortgage | 4 equal installments       |
| Final document        | Mortgage offer letter (Lender) | Final offer letter (Legal) |
| Duration              | 20+ years                      | 12 months                  |

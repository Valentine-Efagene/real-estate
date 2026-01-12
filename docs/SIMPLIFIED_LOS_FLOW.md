# Simplified Loan Origination Flow

> **Summary**: This document describes the simplified loan origination flow where prequalification is merged into the first documentation phase of a application.

## The Problem

Previously, we had two overlapping concepts:

1. **Prequalification** — A separate entity where customers:

   - Answer eligibility questions
   - Upload documents (ID, bank statement, employment letter)
   - Get scored by underwriting

2. **Documentation Phase** — Part of a application where customers:
   - Upload the _same_ documents again
   - Go through approval steps
   - Sign offer letters

This duplication meant:

- Customers uploaded documents twice
- Two separate state machines to maintain
- Extra API calls and complexity
- Confusing UX

## The Solution

**Merge prequalification into the first documentation phase.**

The application becomes the single source of truth. The first documentation phase now includes:

- Pre-approval questionnaire (income, employment, debt questions)
- Document uploads
- Underwriting evaluation
- Admin review
- Offer generation and signing

## New Flow

```
Customer browses property → Selects unit → Creates application (DRAFT)
    │
    └── Application includes phases from payment method template
            │
            ├── Phase 1: Underwriting & Documentation (DOCUMENTATION, KYC)
            │       ├── Step 1: Pre-Approval Questionnaire (PRE_APPROVAL)
            │       │       └── Customer answers: income, expenses, employment, etc.
            │       ├── Step 2: Upload Valid ID (UPLOAD)
            │       ├── Step 3: Upload Bank Statements (UPLOAD)
            │       ├── Step 4: Upload Employment Letter (UPLOAD)
            │       ├── Step 5: Underwriting Evaluation (UNDERWRITING)
            │       │       └── System calculates DTI, score, eligibility
            │       ├── Step 6: Admin Reviews Documents (APPROVAL)
            │       ├── Step 7: Generate Provisional Offer (GENERATE_DOCUMENT)
            │       └── Step 8: Customer Signs Provisional Offer (SIGNATURE)
            │
            ├── Phase 2: Downpayment (PAYMENT, DOWNPAYMENT)
            │       └── Customer pays 10% downpayment
            │
            ├── Phase 3: Final Documentation (DOCUMENTATION, VERIFICATION)
            │       ├── Step 1: Generate Final Offer (GENERATE_DOCUMENT)
            │       └── Step 2: Customer Signs Final Offer (SIGNATURE)
            │
            └── Phase 4: Mortgage (PAYMENT, MORTGAGE)
                    └── 240 monthly installments at 9.5% p.a.
```

## New Step Types

| Step Type           | Description                                | Auto-executes?               |
| ------------------- | ------------------------------------------ | ---------------------------- |
| `PRE_APPROVAL`      | Customer answers eligibility questionnaire | No (customer action)         |
| `UNDERWRITING`      | System evaluates DTI, score, eligibility   | Yes (after uploads complete) |
| `UPLOAD`            | Customer uploads a document                | No (customer action)         |
| `APPROVAL`          | Admin reviews and approves                 | No (admin action)            |
| `GENERATE_DOCUMENT` | System generates PDF offer letter          | Yes (after approval)         |
| `SIGNATURE`         | Customer signs document                    | No (customer action)         |

## Schema Changes

### 1. DocumentationStepType enum

```prisma
enum DocumentationStepType {
  UPLOAD
  APPROVAL
  SIGNATURE
  GENERATE_DOCUMENT
  EXTERNAL_CHECK
  PRE_APPROVAL      // NEW: Customer answers eligibility questions
  UNDERWRITING      // NEW: System evaluates eligibility
}
```

### 2. DocumentationStep model additions

```prisma
model DocumentationStep {
  // ... existing fields ...

  // For PRE_APPROVAL steps: store questionnaire answers
  preApprovalAnswers Json?

  // For UNDERWRITING steps: store evaluation results
  underwritingScore    Float?
  debtToIncomeRatio    Float?
  underwritingDecision String?  // APPROVED, CONDITIONAL, DECLINED
  underwritingNotes    String?
}
```

### 3. Application model changes

```prisma
model Application {
  // Make prequalification optional (for backward compatibility)
  prequalificationId String?
  prequalification   Prequalification? @relation(...)

  // Store pre-approval data directly on application
  monthlyIncome      Decimal?
  monthlyExpenses    Decimal?
  preApprovalAnswers Json?
  underwritingScore  Float?
  debtToIncomeRatio  Float?
}
```

## API Changes

### Application Creation (simplified)

**Before** (required prequalification):

```http
POST /prequalifications
POST /prequalifications/:id/documents
POST /prequalifications/:id/submit
# ... wait for approval ...
POST /applications { prequalificationId: "..." }
```

**After** (direct application creation):

```http
POST /applications {
  propertyUnitId: "...",
  paymentMethodId: "...",
  totalAmount: 85000000,
  // Optional pre-approval data (can also be collected in phase step)
  monthlyIncome: 2500000,
  monthlyExpenses: 800000
}
```

### Step Completion

**PRE_APPROVAL step:**

```http
POST /applications/:id/phases/:phaseId/steps/complete
{
  "stepName": "Pre-Approval Questionnaire",
  "answers": [
    { "questionId": "employment_status", "answer": "EMPLOYED_FULL_TIME" },
    { "questionId": "years_employed", "answer": "7" },
    { "questionId": "monthly_income", "answer": "2500000" },
    { "questionId": "monthly_expenses", "answer": "800000" }
  ]
}
```

**UNDERWRITING step** (auto-executes after uploads):

- System calculates DTI = expenses / income
- System calculates score based on answers
- Updates step with results
- If score passes threshold, step completes automatically
- If score below threshold, step requires manual review

## Migration Strategy

1. **Phase 1: Add new step types** (backward compatible)

   - Add `PRE_APPROVAL` and `UNDERWRITING` to enum
   - Add new fields to `DocumentationStep` and `Application`
   - Keep `Prequalification` model and routes

2. **Phase 2: Update payment method templates**

   - Add pre-approval and underwriting steps to documentation phase
   - New applications use simplified flow

3. **Phase 3: Deprecate prequalification**

   - Mark `/prequalifications` routes as deprecated
   - Existing applications with prequalificationId continue to work
   - New applications don't require prequalification

4. **Phase 4: Remove prequalification** (future)
   - After all existing prequalifications are resolved
   - Remove model and routes

## Benefits

1. **Single entity** — Application is the only application entity
2. **No duplicate uploads** — Documents uploaded once during documentation phase
3. **Simpler state machine** — One workflow instead of two
4. **Better UX** — Customer sees one linear flow
5. **Easier auditing** — All events tied to application
6. **Flexible** — Steps can be reordered per payment method

## Backward Compatibility

- `prequalificationId` on Application becomes optional
- `/prequalifications` endpoints continue to work (deprecated)
- Existing applications with prequalification are unaffected
- New applications can skip prequalification entirely

---

_Created: 2026-01-05_

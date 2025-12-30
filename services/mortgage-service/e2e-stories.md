# Mortgage Service E2E Stories

## Story 1: Full Mortgage Application Flow

**Scenario**: A homebuyer applies for a mortgage on a $1M property with 10% downpayment (one-off) and 90% mortgage at 9.5% p.a.

### Actors

- **Admin**: Creates payment plans, payment methods, document rules; reviews and approves applications
- **Buyer**: Applies for prequalification, uploads documents, makes payments

### Setup (Admin)

1. Admin creates a **one-off downpayment plan** (0% interest, 1 installment)
2. Admin creates a **20-year mortgage plan** (9.5% p.a., 240 monthly installments)
3. Admin creates a **payment method** with phases:
   - Phase 1: KYC Documentation (required docs: ID, bank statement, proof of income)
   - Phase 2: 10% Downpayment (linked to one-off plan)
   - Phase 3: 90% Mortgage (linked to mortgage plan)
4. Admin links payment method to property
5. Admin configures **DocumentRequirementRule** for each context

### Flow

#### Part 1: Prequalification

1. Buyer creates prequalification application
2. System returns required documents from DocumentRequirementRule
3. Buyer uploads documents (URLs from uploader service)
4. Buyer submits prequalification
5. System calculates eligibility score and DTI ratio
6. **Domain Event**: `PREQUALIFICATION.SUBMITTED` → notifications queue
7. **Approval Gate**: Admin reviews and approves/rejects
8. **Domain Event**: `PREQUALIFICATION.APPROVED` → notifications queue

#### Part 2: Contract Creation

1. Buyer creates contract linked to approved prequalification
2. System generates phases from payment method template
3. System calculates phase amounts (10% = $100k, 90% = $900k)
4. System reserves property unit
5. **Domain Event**: `CONTRACT.CREATED`
6. Buyer submits contract for processing (DRAFT → PENDING)
7. **Domain Event**: `CONTRACT.SUBMITTED`

#### Part 3: Documentation Phase

1. Documentation phase activates (IN_PROGRESS)
2. **Domain Event**: `PHASE.ACTIVATED`
3. Buyer uploads required documents
4. Buyer completes upload steps
5. **Approval Gate**: Admin reviews documents
6. Admin approves each document
7. Admin completes approval step
8. Phase auto-completes when all steps done
9. **Domain Event**: `PHASE.COMPLETED`

#### Part 4: Downpayment Phase

1. Phase auto-activates after documentation completes
2. System generates single installment ($100k)
3. Buyer makes payment (records pending)
4. Payment gateway callback confirms payment
5. **Domain Event**: `PAYMENT.COMPLETED`
6. Phase auto-completes when fully paid
7. **Domain Event**: `PHASE.COMPLETED`

#### Part 5: Mortgage Phase

1. Phase auto-activates after downpayment completes
2. System generates 240 amortized installments (~$8,392/month)
3. Contract transitions to ACTIVE after signing
4. **Domain Event**: `CONTRACT.SIGNED`

### Audit Trail

- All events stored in `domain_events` table
- Events include: aggregateType, aggregateId, eventType, payload, occurredAt, actorId
- Notification events queued with queueName = 'notifications'
- Contract transitions stored in `contract_transitions` table

---

## Story 2: Prequalification Rejection

**Scenario**: User fails prequalification due to high DTI ratio

### Flow

1. Buyer creates prequalification with high expenses (DTI > 50%)
2. System calculates poor eligibility score
3. Admin reviews and rejects
4. **Domain Event**: `PREQUALIFICATION.REJECTED`
5. Buyer cannot create contract without approved prequalification

### Assertions

- Contract creation fails with 400/422 if prequalificationId invalid or not approved
- Rejection notes stored for audit
- Notification event queued for buyer

---

## Story 3: Document Rejection in KYC Phase

**Scenario**: Admin rejects a document, buyer must re-upload

### Flow

1. Contract in documentation phase
2. Buyer uploads documents
3. Admin reviews ID document → REJECTED (blurry image)
4. **Domain Event**: `DOCUMENT.REJECTED`
5. Phase step remains incomplete
6. Buyer uploads new document
7. Admin approves new document
8. Phase completes

### Assertions

- Document history preserved (original + replacement)
- Phase cannot complete with rejected documents
- Rejection reason stored for audit

---

## Story 4: Payment Method Change Mid-Contract

**Scenario**: Buyer wants to switch from mortgage to cash payment after signing

### Setup

- Admin configures **DocumentRequirementRule** for PAYMENT_METHOD_CHANGE context
- Rules scoped by fromPaymentMethodId → toPaymentMethodId

### Flow

1. Contract is ACTIVE with mortgage phase in progress
2. Buyer requests payment method change (mortgage → cash)
3. System creates `PaymentMethodChangeRequest`
4. System looks up DocumentRequirementRule for this transition
5. Buyer uploads required documents
6. **Domain Event**: `PAYMENT_METHOD_CHANGE.REQUESTED`
7. **Approval Gate**: Admin reviews request
8. Admin approves change
9. System snapshots current phases → creates new phases
10. **Domain Event**: `PAYMENT_METHOD_CHANGE.EXECUTED`
11. Contract continues with new payment structure

### Assertions

- Previous phase data preserved in `previousPhaseData` JSON
- New phases created with recalculated amounts
- Financial impact (penalties, new rates) recorded
- Audit trail complete

---

## Story 5: Contract Cancellation

**Scenario**: Buyer cancels contract before completion

### Flow

1. Contract in PENDING or ACTIVE state
2. Buyer requests cancellation
3. **Domain Event**: `CONTRACT.CANCELLATION_REQUESTED`
4. Admin reviews (if required)
5. System calculates refund/penalty amounts
6. Contract transitions to CANCELLED
7. Property unit released (RESERVED → AVAILABLE)
8. **Domain Event**: `CONTRACT.CANCELLED`

### Assertions

- Unit inventory restored
- Partial payments refund calculated
- Cancellation reason and financial summary stored

---

## Event Types Reference

| Event Type                        | Aggregate                  | Queue         | Trigger              |
| --------------------------------- | -------------------------- | ------------- | -------------------- |
| `PAYMENT_PLAN.CREATED`            | PaymentPlan                | —             | Admin creates plan   |
| `PAYMENT_METHOD.CREATED`          | PropertyPaymentMethod      | —             | Admin creates method |
| `PREQUALIFICATION.SUBMITTED`      | Prequalification           | notifications | Buyer submits        |
| `PREQUALIFICATION.APPROVED`       | Prequalification           | notifications | Admin approves       |
| `PREQUALIFICATION.REJECTED`       | Prequalification           | notifications | Admin rejects        |
| `CONTRACT.CREATED`                | Contract                   | —             | Contract created     |
| `CONTRACT.SUBMITTED`              | Contract                   | —             | Buyer submits        |
| `CONTRACT.SIGNED`                 | Contract                   | notifications | Contract signed      |
| `CONTRACT.CANCELLED`              | Contract                   | notifications | Contract cancelled   |
| `PHASE.ACTIVATED`                 | ContractPhase              | —             | Phase starts         |
| `PHASE.COMPLETED`                 | ContractPhase              | notifications | Phase completes      |
| `DOCUMENT.UPLOADED`               | ContractDocument           | —             | Doc uploaded         |
| `DOCUMENT.APPROVED`               | ContractDocument           | —             | Admin approves doc   |
| `DOCUMENT.REJECTED`               | ContractDocument           | notifications | Admin rejects doc    |
| `PAYMENT.CREATED`                 | ContractPayment            | —             | Payment initiated    |
| `PAYMENT.COMPLETED`               | ContractPayment            | notifications | Payment confirmed    |
| `PAYMENT.FAILED`                  | ContractPayment            | notifications | Payment failed       |
| `PAYMENT_METHOD_CHANGE.REQUESTED` | PaymentMethodChangeRequest | —             | Change requested     |
| `PAYMENT_METHOD_CHANGE.EXECUTED`  | PaymentMethodChangeRequest | notifications | Change applied       |

---

## Test File Structure

```
tests/
├── setup.ts                          # Test utilities, cleanup, factories
└── e2e/
    ├── contract-lifecycle.test.ts    # Original basic flow tests
    └── mortgage-full-flow.test.ts    # Full story with prequal, gates, events
```

## Running Tests

```bash
# Start local environment
cd local-dev && ./scripts/start.sh

# Run e2e tests
cd services/mortgage-service
npm run test:e2e

# Run specific story
npm run test:e2e -- --testNamePattern="Full Mortgage Flow"
```

# Unit Locking Feature — Configurable Unit Reservation

## Overview

This feature introduces configurable unit locking during the mortgage application workflow. Instead of automatically reserving a unit when any payment phase completes, admins can configure **which specific phase** triggers the unit lock. This enables business flexibility (e.g., lock after downpayment vs. after first mortgage payment) and handles competition gracefully when multiple buyers are interested in the same unit.

---

## Actors

- **Adaeze** (Admin): Loan operations manager at QShelter
- **Chidi** (Customer): First-time homebuyer interested in Unit 14B at Lekki Gardens
- **Emeka** (Customer): Another buyer also interested in Unit 14B
- **Property**: Lekki Gardens Estate, Unit 14B, ₦85,000,000

---

## Business Rules

1. **Unit Lock Trigger**: The admin configures which phase completion locks the unit (e.g., downpayment completion, first documentation approval, mortgage first payment).

2. **First-Come-First-Served**: When the configured phase completes for any buyer, that unit is locked for them. The lock is **exclusive** — only one buyer can hold a lock.

3. **Outbid Notification**: When a unit is locked for a buyer, all other buyers with applications for the same unit are notified and their application status changes to `SUPERSEDED`.

4. **Superseded Buyer Options**:

   - **Transfer Application**: Request to transfer the application to a different available unit (uses existing PropertyTransferRequest flow)
   - **Cancel Application**: Cancel the application and receive a refund (uses existing ApplicationTermination flow)

5. **Lock Release**: If the locking buyer's application is terminated, transferred, or cancelled, the unit lock is released and the unit becomes available again.

---

## Flow

### Phase 1: Admin Configuration

1. Adaeze creates the "10/90 Lekki Mortgage" payment method with multiple phases.

2. When configuring the **Downpayment phase**, Adaeze enables **"Lock Unit on Completion"**:
   ```
   Phase: Downpayment
   Lock Unit on Completion: ✓ Yes
   ```
3. This means: when a buyer completes their downpayment phase, the unit is locked for them.

---

### Phase 2: Multiple Buyers Apply

4. **Chidi** starts an application for Unit 14B and begins the documentation phase.

5. **Emeka** also starts an application for Unit 14B (same unit) and begins documentation.

6. Both applications are in `ACTIVE` status. The unit shows:
   - Status: `AVAILABLE` (not yet locked)
   - Active Applications: 2

---

### Phase 3: First Buyer Completes Lock Phase

7. Chidi completes his documentation and pays the ₦8,500,000 downpayment.

8. Upon downpayment confirmation, the system:

   - Marks the Downpayment phase as `COMPLETED`
   - Detects that this phase has `lockUnitOnComplete = true`
   - **Locks the unit for Chidi**:
     - `PropertyUnit.reservedById = Chidi.id`
     - `PropertyUnit.reservedAt = now()`
     - `PropertyUnit.status = 'RESERVED'`

9. The system then checks for competing applications on the same unit:

   - Finds Emeka's application (status: `ACTIVE`, same unit)
   - Changes Emeka's application status to `SUPERSEDED`
   - Records the superseding application ID for reference

10. Emeka receives a notification:
    > "Unit 14B at Lekki Gardens has been secured by another buyer. Your application has been superseded. You can transfer your application to a different unit or cancel for a full refund."

---

### Phase 4: Superseded Buyer Response

**Option A: Emeka Transfers**

11. Emeka views available units and finds Unit 14C (same variant, same price).

12. Emeka submits a PropertyTransferRequest:

    - Source: Application for Unit 14B
    - Target: Unit 14C
    - Reason: "Original unit was secured by another buyer"

13. Upon approval, Emeka's application is transferred to Unit 14C and continues from where it left off.

**Option B: Emeka Cancels**

14. Alternatively, Emeka requests application termination.

15. The system processes the refund (any payments made) and marks the application as `CANCELLED`.

---

### Phase 5: Lock Release (If Locking Buyer Exits)

16. If Chidi's application is terminated (for any reason):
    - Unit 14B lock is released:
      - `PropertyUnit.reservedById = null`
      - `PropertyUnit.reservedAt = null`
      - `PropertyUnit.status = 'AVAILABLE'`
    - The unit becomes available for new applications

---

## Data Model Changes

### 1. PropertyPaymentMethodPhase (Template)

Add configuration field:

```prisma
model PropertyPaymentMethodPhase {
  // ... existing fields ...

  /// If true, completing this phase locks the unit for the applicant
  /// Only one phase per payment method should have this enabled
  lockUnitOnComplete Boolean @default(false)
}
```

### 2. ApplicationStatus Enum

Add new status:

```prisma
enum ApplicationStatus {
  DRAFT
  PENDING
  ACTIVE
  COMPLETED
  CANCELLED
  TERMINATED
  TRANSFERRED
  SUPERSEDED  // NEW: Another buyer locked the unit
}
```

### 3. Application Model

Add reference to superseding application:

```prisma
model Application {
  // ... existing fields ...

  /// If status is SUPERSEDED, this references the application that took the unit
  supersededById  String?
  supersededBy    Application? @relation("ApplicationSuperseded", fields: [supersededById], references: [id])
  supersededAt    DateTime?

  /// Applications this one superseded
  supersededApplications Application[] @relation("ApplicationSuperseded")
}
```

---

## Event Handler: LOCK_UNIT

A new event handler type for the unit locking logic:

```typescript
enum EventHandlerType {
  // ... existing types ...
  LOCK_UNIT, // Lock the property unit for the applicant
}
```

**Handler Configuration:**

```json
{
  "handlerType": "LOCK_UNIT",
  "config": {
    "supersededStatus": "SUPERSEDED",
    "notifySupersededBuyers": true,
    "notificationTemplate": "unit_superseded"
  }
}
```

This handler:

1. Updates PropertyUnit with reservation details
2. Finds competing applications on same unit
3. Changes their status to SUPERSEDED
4. Sends notifications to affected buyers
5. Logs the event for audit

---

## State Machine Updates

### Application States

```
DRAFT → PENDING → ACTIVE → COMPLETED
                    ↓
                SUPERSEDED → (TRANSFERRED | CANCELLED)
                    ↓
                TERMINATED
```

**SUPERSEDED State Rules:**

- Entry: Triggered by LOCK_UNIT handler when another buyer locks the unit
- Valid Transitions:
  - `TRANSFER` → Creates PropertyTransferRequest, eventually → TRANSFERRED
  - `CANCEL` → Creates ApplicationTermination, eventually → CANCELLED
- Invalid: Cannot continue workflow (phases are paused)

---

## API Endpoints

### Phase Configuration

```
PATCH /payment-methods/{methodId}/phases/{phaseId}
{
  "lockUnitOnComplete": true
}
```

### Get Superseded Applications

```
GET /applications?status=SUPERSEDED
```

### Resume After Transfer (from SUPERSEDED)

When a superseded buyer's transfer request is approved:

1. New application is created for target unit
2. Original application remains in SUPERSEDED status
3. Buyer continues workflow on new application

---

## Notifications

| Event         | Recipient                         | Template                       |
| ------------- | --------------------------------- | ------------------------------ |
| Unit locked   | Locking buyer                     | `unit_secured_confirmation`    |
| Unit locked   | Superseded buyers                 | `unit_superseded_notification` |
| Lock released | N/A (unit available for new apps) | -                              |

---

## Edge Cases

### 1. Simultaneous Completions

If two buyers complete the lock phase at the exact same moment, the database transaction that commits first wins. The second transaction will find the unit already locked and will supersede that application.

### 2. Unit Transferred Mid-Workflow

If a unit is transferred (admin action) after a buyer has started an application but before the lock phase, the application is automatically superseded.

### 3. Lock Phase Reconfiguration

If an admin changes which phase locks the unit after applications are in progress:

- Existing locks are not affected
- New completions follow the new configuration

### 4. Application Without Lock Phase

If a payment method has no phase with `lockUnitOnComplete = true`:

- Unit remains available until contract completion
- Multiple buyers can have active applications
- Final completion (all phases done) triggers ownership transfer

---

## Implementation Status

### ✅ Phase 1: Schema & Basic Flow (COMPLETED)

1. ✅ Added `lockUnitOnComplete` to PropertyPaymentMethodPhase
2. ✅ Added `SUPERSEDED` to ApplicationStatus enum
3. ✅ Added superseding relationship fields to Application (`supersededById`, `supersededAt`)
4. ✅ Added `phaseTemplateId` to ApplicationPhase for template reference
5. ✅ Created migrations (`20260115055636_add_unit_locking`, `20260115060132_add_phase_template_reference`)
6. ✅ Updated validators to accept `lockUnitOnComplete` field
7. ✅ Published common package v2.0.116

### ✅ Phase 2: Lock Handler (COMPLETED)

1. ✅ Added `LOCK_UNIT` to EventHandlerType enum
2. ✅ Created `unit-locking.service.ts` with full implementation
3. ✅ Implemented unit locking logic in `lockUnitForApplication()`
4. ✅ Implemented competing application detection and superseding
5. ✅ Integrated with phase completion in `application-phase.service.ts`
6. ✅ Integrated with payment completion in `application-payment.service.ts`
7. ✅ Updated application state machine for SUPERSEDED transitions

### ✅ Phase 3: Notifications (COMPLETED)

1. ✅ Added `APPLICATION_SUPERSEDED`, `UNIT_LOCKED`, `UNIT_RELEASED` notification types
2. ✅ Created `sendApplicationSupersededNotification()` helper
3. ✅ Integrated notification sending in unit locking service

### ⏳ Phase 4: UI Support (PENDING)

1. ⏳ Admin UI: Phase configuration for lock trigger
2. ⏳ Customer UI: Superseded application message and options
3. ⏳ Admin UI: View superseded applications

---

## Success Metrics

- **Lock Accuracy**: 100% of units locked when configured phase completes
- **Supersede Speed**: < 1 second from lock to supersede notifications
- **Transfer Success**: > 95% of superseded buyers successfully transfer or cancel
- **No Orphaned Locks**: All terminated applications release their locks

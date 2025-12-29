# Mortgage Finite State Machine (FSM)

## Overview

A comprehensive, industry-standard finite state machine implementation for managing the complete mortgage lifecycle from application to completion or foreclosure.

## Architecture

### Core Components

1. **MortgageFSMService** - Main FSM engine with transition logic
2. **MortgageTransitionService** - Manages transitions and their side effects/events
3. **MortgageTransition** - Entity representing each state transition
4. **MortgageTransitionEvent** - Entity representing side effects (actions) for each transition
5. **MortgageStateHistory** - Legacy event sourcing entity for audit trail
6. **MortgageFSMController** - REST API endpoints for FSM operations
7. **MortgageFSMTypes** - Type definitions for states, events, and context

### Transition Model

Each transition in the FSM is represented as a first-class entity with:

#### MortgageTransition

- Tracks state changes (from → to)
- Records the event that triggered the transition
- Stores full context and metadata
- Tracks who/what triggered it (user, system, scheduler)
- Records success/failure with error details
- Measures execution duration
- Stores guard check results

#### MortgageTransitionEvent

- Represents individual side effects/actions
- Executes in defined order (executionOrder)
- Has its own lifecycle: pending → executing → completed/failed
- Supports automatic retry with exponential backoff
- Implements idempotency via unique keys
- Can be rolled back if later events fail
- Tracks execution duration and results

### Event-Driven Architecture

Transitions own their events (side effects). When a transition executes:

1. **Guards** are checked and results tracked
2. **Transition record** is created with all events
3. **Events execute sequentially** in order
4. **Each event** can succeed, fail, or retry
5. **On failure**, previous events are rolled back
6. **On success**, transition is marked complete

## States

### Application Phase

- `DRAFT` - Initial application being filled
- `SUBMITTED` - Application submitted for review
- `PRE_QUALIFICATION` - Initial assessment
- `DOCUMENT_COLLECTION` - Gathering required documents

### Underwriting Phase

- `UNDERWRITING` - Full underwriting in progress
- `APPRAISAL_ORDERED` - Property appraisal ordered
- `APPRAISAL_REVIEW` - Reviewing appraisal results
- `CONDITIONAL_APPROVAL` - Approved with conditions

### Approval Phase

- `APPROVED` - Fully approved, awaiting closing
- `CLOSING_SCHEDULED` - Closing date set

### Downpayment Phase

- `AWAITING_DOWNPAYMENT` - Waiting for down payment
- `DOWNPAYMENT_PARTIAL` - Partial down payment received
- `DOWNPAYMENT_COMPLETE` - Full down payment received

### Active Phase

- `ACTIVE` - Mortgage is active and current

### Delinquency States

- `DELINQUENT_30` - 30 days past due
- `DELINQUENT_60` - 60 days past due
- `DELINQUENT_90` - 90 days past due
- `DELINQUENT_120_PLUS` - 120+ days past due

### Default & Loss Mitigation

- `DEFAULT` - In default
- `FORBEARANCE` - Payment forbearance granted
- `MODIFICATION` - Loan modification in progress
- `SHORT_SALE` - Short sale approved

### Foreclosure Process

- `FORECLOSURE_INITIATED` - Foreclosure started
- `FORECLOSURE_PENDING` - Foreclosure in progress
- `FORECLOSED` - Property foreclosed
- `REO` - Real Estate Owned (bank-owned)

### Completion States

- `PAID_OFF` - Fully paid off
- `REFINANCED` - Refinanced to new loan

### Termination States

- `CANCELLED` - Application cancelled
- `REJECTED` - Application rejected
- `WITHDRAWN` - Withdrawn by borrower
- `SUSPENDED` - Temporarily suspended

## Events

Events trigger state transitions:

### Application Events

- `SUBMIT_APPLICATION`
- `REQUEST_DOCUMENTS`
- `DOCUMENTS_SUBMITTED`

### Underwriting Events

- `START_UNDERWRITING`
- `ORDER_APPRAISAL`
- `APPRAISAL_COMPLETED`
- `APPRAISAL_APPROVED`
- `APPRAISAL_REJECTED`
- `REQUEST_CONDITIONS`
- `CONDITIONS_MET`

### Approval Events

- `APPROVE`
- `REJECT`
- `SCHEDULE_CLOSING`

### Downpayment Events

- `REQUEST_DOWNPAYMENT`
- `RECEIVE_PARTIAL_DOWNPAYMENT`
- `RECEIVE_FULL_DOWNPAYMENT`

### Payment & Delinquency Events

- `RECEIVE_PAYMENT`
- `MISS_PAYMENT`
- `MARK_DELINQUENT`
- `CURE_DELINQUENCY`

### Foreclosure Events

- `INITIATE_FORECLOSURE`
- `FORECLOSE`
- `CONVERT_TO_REO`

### Completion Events

- `PAY_OFF`
- `REFINANCE`

## Features

### 1. Guard Conditions

Transitions can have guard conditions that must pass before execution:

```typescript
{
    name: 'hasRequiredFields',
    check: (ctx) => !!(ctx.borrowerId && ctx.propertyId && ctx.principal),
    errorMessage: 'Missing required fields'
}
```

### 2. Side Effects / Actions

Each transition can execute multiple actions:

```typescript
{
    name: 'NOTIFY_BORROWER',
    execute: async (ctx) => { /* Send notification */ },
    rollback: async (ctx) => { /* Undo if needed */ }
}
```

### 3. Event Sourcing

All state transitions are recorded in `MortgageStateHistory` for:

- Complete audit trail
- Compliance requirements
- State reconstruction
- Analytics

### 4. Pessimistic Locking

Database-level locking prevents race conditions during concurrent transitions.

### 5. Transaction Safety

All transitions execute within database transactions with automatic rollback on failure.

## Usage Examples

### Trigger a Transition

```typescript
const result = await fsmService.transition(
    mortgageId: 1,
    event: MortgageEvent.SUBMIT_APPLICATION,
    context: {
        borrowerId: 100,
        propertyId: 50,
        principal: 300000
    },
    triggeredBy: 'user-123'
);

if (result.success) {
    console.log(`New state: ${result.newState}`);
} else {
    console.error(`Transition failed: ${result.error}`);
}
```

### Get Possible Transitions

```typescript
const transitions = fsmService.getPossibleTransitions(MortgageState.ACTIVE);
// Returns: [
//   { event: 'MARK_DELINQUENT', to: 'DELINQUENT_30', description: '...' },
//   { event: 'PAY_OFF', to: 'PAID_OFF', description: '...' }
// ]
```

### Get Transition History

```typescript
const history = await fsmService.getHistory(mortgageId);
// Returns complete audit trail of all state changes
```

## API Endpoints

### POST `/mortgages/:id/fsm/transition`

Trigger a state transition

**Body:**

```json
{
  "event": "SUBMIT_APPLICATION",
  "context": {
    "borrowerId": 100,
    "propertyId": 50,
    "principal": 300000
  },
  "triggeredBy": "user-123"
}
```

### GET `/mortgages/:id/fsm/history`

Get complete transition history

### GET `/mortgages/:id/fsm/possible-transitions/:state`

Get available transitions from a state

## State Diagram

```
DRAFT → SUBMITTED → DOCUMENT_COLLECTION → UNDERWRITING
                                              ↓
                                      APPRAISAL_ORDERED
                                              ↓
                                      APPRAISAL_REVIEW
                                         ↙        ↘
                                   REJECTED   CONDITIONAL_APPROVAL
                                                   ↓
                                               APPROVED
                                                   ↓
                                          CLOSING_SCHEDULED
                                                   ↓
                                        AWAITING_DOWNPAYMENT
                                                   ↓
                                        DOWNPAYMENT_PARTIAL
                                                   ↓
                                        DOWNPAYMENT_COMPLETE
                                                   ↓
                                               ACTIVE
                                         ↙      ↓      ↘
                                    PAID_OFF  DELINQUENT  REFINANCED
                                                   ↓
                                              DEFAULT
                                         ↙      ↓      ↘
                                FORBEARANCE  FORECLOSURE  SHORT_SALE
```

## Extending the FSM

### Add New State

1. Add to `MortgageState` enum in `mortgage-fsm.types.ts`
2. Create transition rules in `initializeStateMachine()`
3. Add guards and actions as needed

### Add New Event

1. Add to `MortgageEvent` enum
2. Define transitions that use this event
3. Implement any required actions

### Add New Action

1. Add to `MortgageAction` enum (optional)
2. Implement the action method in `MortgageFSMService`
3. Add to transition definition

## Testing

Comprehensive test suite in `test/mortgage-fsm.spec.ts`:

```bash
npm run test:e2e test/mortgage-fsm.spec.ts
```

## Compliance & Audit

The FSM automatically provides:

- Complete audit trail via `MortgageStateHistory`
- Timestamp of every state change
- User/system that triggered each transition
- Context data for each transition
- Success/failure tracking

## Performance Considerations

- Uses pessimistic locking to prevent race conditions
- Database transactions ensure atomicity
- Indexed history table for fast queries
- Lazy-loaded action execution

## Best Practices

1. **Always provide context** - Include relevant data for audit trail
2. **Use guards** - Validate business rules before state changes
3. **Implement actions** - Execute side effects consistently
4. **Monitor history** - Use for analytics and troubleshooting
5. **Handle failures** - Implement proper error handling and rollback

## Migration from Old System

The legacy `MortgageStatus` enum is maintained for backward compatibility. Gradually migrate to using `state` field instead of `status`.

## Future Enhancements

- [ ] Add workflow automation triggers
- [ ] Implement scheduled state checks
- [ ] Add webhook notifications for state changes
- [ ] Create visual state diagram generator
- [ ] Add RBAC for transition permissions
- [ ] Implement compensation transactions
- [ ] Add state machine versioning

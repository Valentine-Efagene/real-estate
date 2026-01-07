# Event Models: DomainEvent vs ContractEvent

## Clear Boundaries and Definitions

### DomainEvent (Inter-Service Communication)

**Purpose**: Message bus for asynchronous, inter-service communication

**Use Cases**:

- Triggering actions in other services
- Notifying external systems (notifications, webhooks)
- Workflow orchestration across service boundaries
- Queue-based processing (retry logic, fan-out patterns)

**Characteristics**:

- Has `queueName` field (routing destination)
- Has `status` field (PENDING, PROCESSING, SENT, FAILED)
- Has retry mechanism (`failureCount`, `nextRetryAt`)
- Uses dot notation for event types: `CONTRACT.CREATED`, `PAYMENT.COMPLETED`
- Payload is generic JSON string
- Intended to be consumed and processed by event handlers

**Lifecycle**: Created → Queued → Processed → Sent/Failed → Eventually deleted (after TTL)

**Example Events**:

```typescript
// Notify other services that a contract was created
{
  eventType: 'CONTRACT.CREATED',
  aggregateType: 'Contract',
  aggregateId: contractId,
  queueName: 'notifications',
  payload: JSON.stringify({ contractNumber, buyerId }),
  status: 'PENDING'
}

// Trigger payment processing
{
  eventType: 'PAYMENT.INITIATED',
  aggregateType: 'ContractPayment',
  aggregateId: paymentId,
  queueName: 'payment-processor',
  payload: JSON.stringify({ amount, method }),
  status: 'PENDING'
}
```

---

### ContractEvent (Audit Trail)

**Purpose**: Immutable audit log for contract lifecycle and compliance

**Use Cases**:

- Regulatory compliance and audit trails
- Historical tracking of contract state changes
- Debugging and forensics ("what happened when")
- Business intelligence and analytics
- Legal record-keeping

**Characteristics**:

- No processing mechanism (write-once, never modified)
- No queue routing (not meant to trigger actions)
- Uses enum types for type safety: `ContractEventType.CONTRACT_CREATED`
- Structured data field (JSON) for event-specific details
- State transition tracking (fromState, toState, trigger)
- Actor attribution (actorId, actorType)

**Lifecycle**: Created → Stored forever (or until retention policy)

**Example Events**:

```typescript
// Audit record of contract creation
{
  eventType: ContractEventType.CONTRACT_CREATED,
  eventGroup: ContractEventGroup.STATE_CHANGE,
  contractId,
  data: { contractNumber, buyerId, totalAmount },
  actorId: buyerId,
  actorType: EventActorType.USER,
  occurredAt: now()
}

// State transition record
{
  eventType: ContractEventType.CONTRACT_STATE_CHANGED,
  eventGroup: ContractEventGroup.STATE_CHANGE,
  contractId,
  fromState: 'DRAFT',
  toState: 'ACTIVE',
  trigger: 'INITIAL_PAYMENT',
  actorId: userId,
  actorType: EventActorType.USER
}
```

---

## Decision Matrix: Which Event Model to Use?

| Question                                   | DomainEvent | ContractEvent |
| ------------------------------------------ | ----------- | ------------- |
| Need to trigger action in another service? | ✅ Yes      | ❌ No         |
| Need retry logic if processing fails?      | ✅ Yes      | ❌ No         |
| Need to send notification/webhook?         | ✅ Yes      | ❌ No         |
| Need audit trail for compliance?           | ❌ No       | ✅ Yes        |
| Need to track who did what when?           | ❌ No       | ✅ Yes        |
| Need permanent historical record?          | ❌ No       | ✅ Yes        |
| Need to query "all events for contract X"? | ⚠️ Maybe    | ✅ Yes        |
| Event should be processed and deleted?     | ✅ Yes      | ❌ No         |

---

## Implementation Patterns

### Pattern 1: Both Events (Common)

Many actions require BOTH event types:

```typescript
await prisma.$transaction(async (tx) => {
  // Create the business entity
  const contract = await tx.contract.create({ data });

  // Audit trail (permanent record)
  await tx.contractEvent.create({
    data: {
      contractId: contract.id,
      eventType: ContractEventType.CONTRACT_CREATED,
      eventGroup: ContractEventGroup.STATE_CHANGE,
      data: { contractNumber: contract.contractNumber, buyerId },
      actorId: userId,
      actorType: EventActorType.USER,
    },
  });

  // Inter-service communication (triggers notification)
  await tx.domainEvent.create({
    data: {
      id: uuidv4(),
      eventType: "CONTRACT.CREATED",
      aggregateType: "Contract",
      aggregateId: contract.id,
      queueName: "notifications",
      payload: JSON.stringify({
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        buyerId,
      }),
    },
  });

  return contract;
});
```

### Pattern 2: ContractEvent Only (Audit without actions)

Some events are purely for historical tracking:

```typescript
// Recording a view/access event
await tx.contractEvent.create({
  data: {
    contractId,
    eventType: ContractEventType.CONTRACT_VIEWED,
    eventGroup: ContractEventGroup.NOTIFICATION,
    actorId: userId,
    actorType: EventActorType.USER,
  },
});
```

### Pattern 3: DomainEvent Only (External systems)

Events from external systems that don't relate to contracts:

```typescript
// Property price change notification
await tx.domainEvent.create({
  data: {
    id: uuidv4(),
    eventType: "PROPERTY.PRICE_UPDATED",
    aggregateType: "Property",
    aggregateId: propertyId,
    queueName: "notifications",
    payload: JSON.stringify({ oldPrice, newPrice }),
  },
});
```

---

## Enum vs String Naming Convention

- **DomainEvent.eventType**: String with dot notation

  - Format: `ENTITY.ACTION` (e.g., `CONTRACT.CREATED`, `PAYMENT.COMPLETED`)
  - Flexible, allows any service to define events
  - Used for routing and queue filtering

- **ContractEvent.eventType**: Enum with underscore notation
  - Format: `ENTITY_ACTION` (e.g., `CONTRACT_CREATED`, `PAYMENT_COMPLETED`)
  - Type-safe, database-enforced values
  - Prevents typos and provides IDE autocomplete

---

## Migration Guidelines

When adding a new contract-related action:

1. **Ask**: Does this need to trigger something in another service?

   - **Yes** → Create DomainEvent
   - **No** → Skip DomainEvent

2. **Ask**: Does this need to be in the audit trail?

   - **Yes** → Create ContractEvent
   - **No** → Skip ContractEvent

3. **Most actions need BOTH** for complete functionality

4. Always use the same transaction to ensure atomicity

---

## Event Type Registry

### ContractEvent Types (Enum - for audit)

Defined in `schema.prisma` as `ContractEventType`:

- `CONTRACT_CREATED`
- `CONTRACT_STATE_CHANGED`
- `CONTRACT_SIGNED`
- `CONTRACT_TERMINATED`
- `CONTRACT_TRANSFERRED`
- `PHASE_ACTIVATED`
- `PHASE_COMPLETED`
- `PAYMENT_INITIATED`
- `PAYMENT_COMPLETED`
- `PAYMENT_FAILED`
- `DOCUMENT_SUBMITTED`
- `DOCUMENT_APPROVED`
- `DOCUMENT_REJECTED`
- `INSTALLMENTS_GENERATED`
- `UNDERWRITING_COMPLETED`
- `OFFER_LETTER_GENERATED`

### DomainEvent Types (String - for messaging)

Format: `ENTITY.ACTION` (examples, not exhaustive):

- `CONTRACT.CREATED`
- `CONTRACT.STATE_CHANGED`
- `CONTRACT.SIGNED`
- `PHASE.ACTIVATED`
- `PHASE.COMPLETED`
- `PAYMENT.INITIATED`
- `PAYMENT.COMPLETED`
- `PAYMENT.FAILED`
- `DOCUMENT.SUBMITTED`
- `INSTALLMENTS.GENERATED`
- `PAYMENT_METHOD_CHANGE.REQUESTED`
- `PAYMENT_METHOD_CHANGE.APPROVED`
- `PAYMENT_METHOD_CHANGE.EXECUTED`

---

## Summary

- **DomainEvent** = Message bus (actions, integration, temporary)
- **ContractEvent** = Audit log (compliance, history, permanent)
- Most contract actions create **BOTH**
- Use enums for ContractEvent (type safety)
- Use strings for DomainEvent (flexibility)

# Event Models: DomainEvent vs ApplicationEvent

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
// Notify other services that a application was created
{
  eventType: 'CONTRACT.CREATED',
  aggregateType: 'Application',
  aggregateId: applicationId,
  queueName: 'notifications',
  payload: JSON.stringify({ applicationNumber, buyerId }),
  status: 'PENDING'
}

// Trigger payment processing
{
  eventType: 'PAYMENT.INITIATED',
  aggregateType: 'ApplicationPayment',
  aggregateId: paymentId,
  queueName: 'payment-processor',
  payload: JSON.stringify({ amount, method }),
  status: 'PENDING'
}
```

---

### ApplicationEvent (Audit Trail)

**Purpose**: Immutable audit log for application lifecycle and compliance

**Use Cases**:

- Regulatory compliance and audit trails
- Historical tracking of application state changes
- Debugging and forensics ("what happened when")
- Business intelligence and analytics
- Legal record-keeping

**Characteristics**:

- No processing mechanism (write-once, never modified)
- No queue routing (not meant to trigger actions)
- Uses enum types for type safety: `ApplicationEventType.CONTRACT_CREATED`
- Structured data field (JSON) for event-specific details
- State transition tracking (fromState, toState, trigger)
- Actor attribution (actorId, actorType)

**Lifecycle**: Created → Stored forever (or until retention policy)

**Example Events**:

```typescript
// Audit record of application creation
{
  eventType: ApplicationEventType.CONTRACT_CREATED,
  eventGroup: ApplicationEventGroup.STATE_CHANGE,
  applicationId,
  data: { applicationNumber, buyerId, totalAmount },
  actorId: buyerId,
  actorType: EventActorType.USER,
  occurredAt: now()
}

// State transition record
{
  eventType: ApplicationEventType.CONTRACT_STATE_CHANGED,
  eventGroup: ApplicationEventGroup.STATE_CHANGE,
  applicationId,
  fromState: 'DRAFT',
  toState: 'ACTIVE',
  trigger: 'INITIAL_PAYMENT',
  actorId: userId,
  actorType: EventActorType.USER
}
```

---

## Decision Matrix: Which Event Model to Use?

| Question                                   | DomainEvent | ApplicationEvent |
| ------------------------------------------ | ----------- | ------------- |
| Need to trigger action in another service? | ✅ Yes      | ❌ No         |
| Need retry logic if processing fails?      | ✅ Yes      | ❌ No         |
| Need to send notification/webhook?         | ✅ Yes      | ❌ No         |
| Need audit trail for compliance?           | ❌ No       | ✅ Yes        |
| Need to track who did what when?           | ❌ No       | ✅ Yes        |
| Need permanent historical record?          | ❌ No       | ✅ Yes        |
| Need to query "all events for application X"? | ⚠️ Maybe    | ✅ Yes        |
| Event should be processed and deleted?     | ✅ Yes      | ❌ No         |

---

## Implementation Patterns

### Pattern 1: Both Events (Common)

Many actions require BOTH event types:

```typescript
await prisma.$transaction(async (tx) => {
  // Create the business entity
  const application = await tx.application.create({ data });

  // Audit trail (permanent record)
  await tx.applicationEvent.create({
    data: {
      applicationId: application.id,
      eventType: ApplicationEventType.CONTRACT_CREATED,
      eventGroup: ApplicationEventGroup.STATE_CHANGE,
      data: { applicationNumber: application.applicationNumber, buyerId },
      actorId: userId,
      actorType: EventActorType.USER,
    },
  });

  // Inter-service communication (triggers notification)
  await tx.domainEvent.create({
    data: {
      id: uuidv4(),
      eventType: "CONTRACT.CREATED",
      aggregateType: "Application",
      aggregateId: application.id,
      queueName: "notifications",
      payload: JSON.stringify({
        applicationId: application.id,
        applicationNumber: application.applicationNumber,
        buyerId,
      }),
    },
  });

  return application;
});
```

### Pattern 2: ApplicationEvent Only (Audit without actions)

Some events are purely for historical tracking:

```typescript
// Recording a view/access event
await tx.applicationEvent.create({
  data: {
    applicationId,
    eventType: ApplicationEventType.CONTRACT_VIEWED,
    eventGroup: ApplicationEventGroup.NOTIFICATION,
    actorId: userId,
    actorType: EventActorType.USER,
  },
});
```

### Pattern 3: DomainEvent Only (External systems)

Events from external systems that don't relate to applications:

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

- **ApplicationEvent.eventType**: Enum with underscore notation
  - Format: `ENTITY_ACTION` (e.g., `CONTRACT_CREATED`, `PAYMENT_COMPLETED`)
  - Type-safe, database-enforced values
  - Prevents typos and provides IDE autocomplete

---

## Migration Guidelines

When adding a new application-related action:

1. **Ask**: Does this need to trigger something in another service?

   - **Yes** → Create DomainEvent
   - **No** → Skip DomainEvent

2. **Ask**: Does this need to be in the audit trail?

   - **Yes** → Create ApplicationEvent
   - **No** → Skip ApplicationEvent

3. **Most actions need BOTH** for complete functionality

4. Always use the same transaction to ensure atomicity

---

## Event Type Registry

### ApplicationEvent Types (Enum - for audit)

Defined in `schema.prisma` as `ApplicationEventType`:

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
- **ApplicationEvent** = Audit log (compliance, history, permanent)
- Most application actions create **BOTH**
- Use enums for ApplicationEvent (type safety)
- Use strings for DomainEvent (flexibility)

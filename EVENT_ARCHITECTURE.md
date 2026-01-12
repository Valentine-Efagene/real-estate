# Event Architecture Overview

## Two-Model Event System

Our system uses **two distinct event models** with clear, non-overlapping responsibilities:

### 1. DomainEvent (Message Bus)

**Location**: `shared/common/prisma/schema.prisma` - `DomainEvent` model  
**Purpose**: Inter-service communication and asynchronous processing

- **Used for**: Triggering actions, sending notifications, webhooks, queue-based workflows
- **Naming**: Dot notation strings (`CONTRACT.CREATED`, `PAYMENT.COMPLETED`)
- **Lifecycle**: Temporary - created → processed → deleted
- **Has retry logic**: Yes (`status`, `failureCount`, `nextRetryAt`)
- **Routing**: Uses `queueName` field to route to appropriate handlers

### 2. ApplicationEvent (Audit Log)

**Location**: `shared/common/prisma/schema.prisma` - `ApplicationEvent` model  
**Purpose**: Immutable audit trail for compliance and forensics

- **Used for**: Historical records, compliance, debugging, analytics
- **Naming**: Enum values (`ApplicationEventType.CONTRACT_CREATED`)
- **Lifecycle**: Permanent - write-once, never modified or deleted
- **Type safety**: Database-enforced enums prevent typos
- **Structured**: Dedicated fields for state transitions, actor tracking

---

## When to Use Each

### Use Both (Most Common)

Most application-related actions need BOTH event types:

```typescript
await prisma.$transaction(async (tx) => {
  const application = await tx.application.create({ data });

  // AUDIT: Permanent record
  await tx.applicationEvent.create({
    data: {
      applicationId: application.id,
      eventType: "CONTRACT_CREATED", // Enum
      eventGroup: "STATE_CHANGE",
      data: {
        /* structured payload */
      },
      actorId: userId,
      actorType: "USER",
    },
  });

  // MESSAGING: Trigger notifications
  await tx.domainEvent.create({
    data: {
      id: uuidv4(),
      eventType: "CONTRACT.CREATED", // String
      aggregateType: "Application",
      aggregateId: application.id,
      queueName: "notifications",
      payload: JSON.stringify({
        /* message payload */
      }),
    },
  });
});
```

### ApplicationEvent Only

Pure audit/tracking without triggering actions:

- User viewing a application
- Recording access logs
- Tracking read-only operations

### DomainEvent Only

External system events not related to applications:

- Property price updates
- Third-party webhook events
- Cross-service notifications

---

## Type Conventions

### ApplicationEvent Enums (Type-Safe)

```typescript
enum ApplicationEventType {
  CONTRACT_CREATED
  CONTRACT_STATE_CHANGED
  PHASE_ACTIVATED
  PAYMENT_COMPLETED
  // ... 14 more values
}

enum ApplicationEventGroup {
  STATE_CHANGE
  PAYMENT
  DOCUMENT
  NOTIFICATION
  WORKFLOW
}

enum EventActorType {
  USER
  SYSTEM
  WEBHOOK
  ADMIN
}
```

### DomainEvent Strings (Flexible)

```
Format: ENTITY.ACTION
Examples:
- CONTRACT.CREATED
- PAYMENT.COMPLETED
- PAYMENT_METHOD_CHANGE.REQUESTED
- PHASE.ACTIVATED
```

---

## Benefits of This Architecture

1. **Separation of Concerns**

   - Audit trail never mixed with processing logic
   - Can query application history without noise from processing events

2. **Type Safety Where It Matters**

   - ApplicationEvent uses enums → compile-time safety for audit events
   - DomainEvent uses strings → flexibility for any service to emit events

3. **Performance**

   - DomainEvents cleaned up after processing (no bloat)
   - ApplicationEvents optimized for historical queries

4. **Compliance**

   - ApplicationEvent provides immutable audit trail
   - Cannot be modified or accidentally deleted

5. **Clear Intent**
   - Code explicitly shows: "This creates an audit record AND sends a message"
   - No confusion about event purpose

---

## Full Documentation

See [docs/EVENT_MODELS.md](./docs/EVENT_MODELS.md) for:

- Detailed decision matrix
- Complete event type registry
- Implementation patterns
- Migration guidelines

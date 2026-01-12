# Event System Unification - Migration Guide

This guide explains how to migrate from the legacy EventPublisher pattern to the unified event system.

## Overview

We've unified three separate event systems into one:

- ✅ **WorkflowEventService** (database-backed, admin-configurable)
- ✅ **EventBusService** (multi-transport delivery)
- ✅ **UnifiedEventService** (single API for all event emission)

## Architecture

### Before (Legacy)

```
Service → EventPublisher → SNS → Notification Service
           (no DB, no audit, hardcoded)
```

### After (Unified)

```
Service → UnifiedEventService → WorkflowEvent (DB)
                              ↓
                    EventHandler (admin-configured)
                              ↓
                    EventBusService (multi-transport)
                              ↓
                    EventHandlerExecution (tracking)
```

## Migration Steps

### 1. Seed Event Types

Before using the unified system, seed event types for your tenant:

```bash
# Seed for a specific tenant
tsx shared/common/scripts/seed-events.ts --tenant-id <TENANT_ID>

# Seed for all tenants
tsx shared/common/scripts/seed-events.ts --all

# Include example email handlers (for testing)
tsx shared/common/scripts/seed-events.ts --tenant-id <TENANT_ID> --with-examples
```

This creates:

- EventChannel records (CONTRACTS, PAYMENTS, DOCUMENTS, WORKFLOW)
- EventType records (CONTRACT_CREATED, PAYMENT_RECEIVED, etc.)

### 2. Update Service Code

#### Before (Legacy)

```typescript
// services/mortgage-service/src/lib/notifications.ts
import {
  getEventPublisher,
  NotificationType,
} from "@valentine-efagene/qshelter-common";

const publisher = getEventPublisher("mortgage-service");

await publisher.publishEmail(
  NotificationType.CONTRACT_CREATED,
  {
    to_email: buyer.email,
    homeBuyerName: buyer.name,
    applicationNumber: application.applicationNumber,
    propertyName: property.title,
    totalAmount: formatCurrency(application.totalAmount),
    termMonths: application.termMonths,
    monthlyPayment: formatCurrency(application.periodicPayment),
    dashboardLink: dashboardUrl,
  },
  { correlationId }
);
```

#### After (Unified)

```typescript
// services/mortgage-service/src/lib/unified-notifications.ts
import { emitApplicationCreated } from "./unified-notifications";

await emitApplicationCreated(
  prisma,
  application.tenantId,
  {
    applicationId: application.id,
    applicationNumber: application.applicationNumber,
    buyerId: application.buyerId,
    buyerEmail: buyer.email,
    buyerName: buyer.name,
    propertyName: property.title,
    totalAmount: application.totalAmount,
    termMonths: application.termMonths,
    monthlyPayment: application.periodicPayment,
    dashboardUrl,
  },
  userId, // actorId
  correlationId
);
```

### 3. Update Application Services

Replace direct EventPublisher calls with unified event helpers.

#### Example: Application Creation

**Before:**

```typescript
// services/mortgage-service/src/services/application.service.ts
import { sendApplicationCreatedNotification } from "../lib/notifications";

// After creating application
await sendApplicationCreatedNotification(
  {
    email: buyer.email,
    userName: buyer.name,
    applicationNumber: application.applicationNumber,
    propertyName: property.title,
    totalAmount: formatCurrency(application.totalAmount),
    termMonths: application.termMonths,
    monthlyPayment: formatCurrency(application.periodicPayment),
    dashboardUrl: `${config.appUrl}/applications/${application.id}`,
  },
  correlationId
);
```

**After:**

```typescript
// services/mortgage-service/src/services/application.service.ts
import { emitApplicationCreated } from "../lib/unified-notifications";

// After creating application
await emitApplicationCreated(
  this.prisma,
  application.tenantId,
  {
    applicationId: application.id,
    applicationNumber: application.applicationNumber,
    buyerId: application.buyerId,
    buyerEmail: buyer.email,
    buyerName: buyer.name,
    propertyName: property.title,
    totalAmount: application.totalAmount,
    termMonths: application.termMonths,
    monthlyPayment: application.periodicPayment,
    dashboardUrl: `${config.appUrl}/applications/${application.id}`,
  },
  userId,
  correlationId
);
```

### 4. Configure Event Handlers (Admin Task)

After migration, admins can configure handlers via the UI or API:

```typescript
// Example: Configure email handler for CONTRACT_CREATED event
POST /api/event-handlers
{
  "tenantId": "tenant_123",
  "eventTypeCode": "CONTRACT_CREATED",
  "name": "Send Application Created Email",
  "handlerType": "SEND_EMAIL",
  "config": {
    "notificationType": "CONTRACT_CREATED",
    "recipientPath": "$.buyerEmail",
    "templateData": {
      "applicationNumber": "$.applicationNumber",
      "propertyName": "$.propertyName",
      "totalAmount": "$.totalAmount"
    }
  },
  "priority": 100,
  "enabled": true
}
```

### 5. Deprecate ApplicationEvent

Once migration is complete, deprecate the ApplicationEvent model:

1. Stop writing to ApplicationEvent table
2. All events now go to WorkflowEvent
3. ApplicationEvent can be archived/dropped after data migration

## Benefits

### 1. Full Audit Trail

```sql
-- Query all events for a application
SELECT * FROM workflow_events
WHERE JSON_EXTRACT(payload, '$.applicationId') = 'ctr_123'
ORDER BY created_at DESC;
```

### 2. Admin-Configurable Handlers

- Add/remove handlers without code changes
- Enable/disable handlers on-the-fly
- Configure retry logic per handler

### 3. Execution Tracking

```sql
-- See if notifications were actually sent
SELECT
  e.event_type_id,
  et.code,
  eh.name as handler_name,
  ehe.status,
  ehe.error,
  ehe.completed_at
FROM event_handler_executions ehe
JOIN event_handlers eh ON ehe.handler_id = eh.id
JOIN workflow_events e ON ehe.event_id = e.id
JOIN event_types et ON e.event_type_id = et.id
WHERE e.id = 'evt_123';
```

### 4. Multi-Transport Delivery

- HTTP webhooks
- SNS topics
- SQS queues
- EventBridge buses

### 5. Correlation & Causation

```typescript
// Link related events
await emitDocumentUploaded(prisma, tenantId, payload, userId, correlationId);
await emitStepCompleted(prisma, tenantId, payload2, 'SYSTEM', correlationId);

// Query all events in a workflow
SELECT * FROM workflow_events
WHERE correlation_id = 'corr_123'
ORDER BY created_at ASC;
```

## Testing

### 1. Seed Test Events

```bash
tsx shared/common/scripts/seed-events.ts --tenant-id test_tenant --with-examples
```

### 2. Emit Test Event

```typescript
import { emitApplicationCreated } from "../lib/unified-notifications";

await emitApplicationCreated(prisma, tenantId, {
  applicationId: "test_123",
  applicationNumber: "CNT-TEST-001",
  buyerId: "buyer_123",
  buyerEmail: "test@example.com",
  buyerName: "Test Buyer",
  propertyName: "Test Property",
  totalAmount: 1000000,
  termMonths: 360,
  monthlyPayment: 5000,
  dashboardUrl: "https://test.com/dashboard",
});
```

### 3. Verify Event Created

```sql
SELECT * FROM workflow_events
WHERE JSON_EXTRACT(payload, '$.applicationId') = 'test_123';
```

### 4. Check Handler Executions

```sql
SELECT * FROM event_handler_executions
WHERE event_id = '<event_id_from_above>';
```

## Rollback Plan

If issues arise during migration:

1. **Keep legacy code** - Don't delete old notifications.ts immediately
2. **Run both systems** - Emit to both legacy and unified temporarily
3. **Compare results** - Verify unified system sends same notifications
4. **Gradual migration** - Migrate one event type at a time
5. **Feature flag** - Use config to toggle between systems

```typescript
// Example feature flag
const USE_UNIFIED_EVENTS = process.env.USE_UNIFIED_EVENTS === "true";

if (USE_UNIFIED_EVENTS) {
  await emitApplicationCreated(prisma, tenantId, payload);
} else {
  await sendApplicationCreatedNotification(legacyPayload);
}
```

## Troubleshooting

### Event not found error

```
Error: Event type 'CONTRACT_CREATED' not found or not enabled for tenant
```

**Solution:** Run seeding script for your tenant.

### No handlers executed

**Solution:** Configure handlers via admin UI or seed example handlers.

### Handler execution failed

**Solution:** Check EventHandlerExecution table for error details:

```sql
SELECT error, error_code, input, output
FROM event_handler_executions
WHERE status = 'FAILED'
ORDER BY created_at DESC;
```

## Timeline

1. **Week 1:** Seed event types for all tenants
2. **Week 2:** Migrate application creation events
3. **Week 3:** Migrate payment events
4. **Week 4:** Migrate document events
5. **Week 5:** Migrate workflow events
6. **Week 6:** Deprecate legacy EventPublisher
7. **Week 7:** Deprecate ApplicationEvent model

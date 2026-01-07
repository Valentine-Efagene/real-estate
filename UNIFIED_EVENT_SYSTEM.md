# Unified Event System - Implementation Complete

## Summary

We've successfully unified three separate event systems into a single, cohesive architecture that provides:

- ✅ **Database-backed audit trail** (WorkflowEvent)
- ✅ **Admin-configurable handlers** (EventHandler)
- ✅ **Execution tracking** (EventHandlerExecution)
- ✅ **Multi-transport delivery** (EventBusService integration)
- ✅ **Single API for all services** (UnifiedEventService)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer (mortgage-service)              │
│                                                                   │
│  emitContractCreated(prisma, tenantId, {                        │
│    contractId, buyerId, buyerEmail, ...                         │
│  })                                                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│               UnifiedEventService (shared/common)                │
│                                                                   │
│  • Validates event type exists                                   │
│  • Stores event in database                                      │
│  • Optionally publishes to EventBus                              │
│  • Returns immediately (async processing)                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WorkflowEvent (Database)                       │
│                                                                   │
│  • Full audit trail of all events                                │
│  • Tenant-scoped                                                 │
│  • Correlation & causation tracking                              │
│  • Payload stored as JSON                                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│            WorkflowEventService.processEvent()                   │
│                                                                   │
│  • Fetches EventHandler records (admin-configured)               │
│  • Executes each handler in priority order                       │
│  • Logs execution in EventHandlerExecution                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │SEND_EMAIL│  │SEND_SMS  │  │WEBHOOK   │
         │          │  │          │  │          │
         │→ SNS     │  │→ SNS     │  │→ HTTP    │
         │→ Email   │  │→ SMS     │  │→ API     │
         └──────────┘  └──────────┘  └──────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│          EventHandlerExecution (Database)                        │
│                                                                   │
│  • Execution status (PENDING, COMPLETED, FAILED)                 │
│  • Input/output logs                                             │
│  • Error messages                                                │
│  • Duration tracking                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. UnifiedEventService

**Location:** [`shared/common/src/events/unified-event.service.ts`](shared/common/src/events/unified-event.service.ts)

Single API for all event emission. Bridges WorkflowEventService and EventBusService.

**Usage:**

```typescript
import { createUnifiedEventService } from '@valentine-efagene/qshelter-common';

const eventService = createUnifiedEventService(prisma);

await eventService.emit(tenantId, {
  eventType: 'CONTRACT_CREATED',
  payload: { contractId, buyerId, ... },
  source: 'contract-service',
  actor: { id: userId, type: 'USER' }
});
```

### 2. Event Type Seeder

**Location:** [`shared/common/src/events/event-seeder.ts`](shared/common/src/events/event-seeder.ts)

Utilities for seeding EventChannel, EventType, and EventHandler records.

**Usage:**

```bash
tsx shared/common/scripts/seed-events.ts --tenant-id <ID>
tsx shared/common/scripts/seed-events.ts --all
tsx shared/common/scripts/seed-events.ts --with-examples
```

**Seeds:**

- 4 EventChannels (CONTRACTS, PAYMENTS, DOCUMENTS, WORKFLOW)
- 15 EventTypes (CONTRACT_CREATED, PAYMENT_RECEIVED, etc.)
- Example handlers (optional)

### 3. Unified Notifications (mortgage-service)

**Location:** [`services/mortgage-service/src/lib/unified-notifications.ts`](services/mortgage-service/src/lib/unified-notifications.ts)

Service-specific event emission helpers using the unified system.

**Functions:**

```typescript
// Contract events
emitContractCreated(prisma, tenantId, payload, actorId?, correlationId?)
emitContractActivated(prisma, tenantId, payload, actorId?, correlationId?)
emitContractTerminationRequested(...)
emitContractTerminationApproved(...)
emitContractTerminated(...)

// Payment events
emitPaymentReceived(...)
emitPaymentFailed(...)

// Document events
emitDocumentUploaded(...)
emitDocumentApproved(...)
emitDocumentRejected(...)

// Workflow events
emitPhaseActivated(...)
emitPhaseCompleted(...)
emitStepCompleted(...)
emitStepRejected(...)
```

### 4. Migration Utilities

#### Event Type Seeding

**Location:** [`shared/common/scripts/seed-events.ts`](shared/common/scripts/seed-events.ts)

Seeds EventChannel and EventType records for tenants.

#### ContractEvent Migration

**Location:** [`services/mortgage-service/scripts/migrate-contract-events.ts`](services/mortgage-service/scripts/migrate-contract-events.ts)

Migrates historical ContractEvent records to WorkflowEvent.

**Usage:**

```bash
tsx services/mortgage-service/scripts/migrate-contract-events.ts --tenant-id <ID>
tsx services/mortgage-service/scripts/migrate-contract-events.ts --dry-run
```

### 5. EventBus Integration

**Location:** [`shared/common/src/events/event-bus-integration.ts`](shared/common/src/events/event-bus-integration.ts)

Bridges WorkflowEventService handlers with EventBusService transport layer.

## Event Types Defined

### Contracts Channel

- `CONTRACT_CREATED` - New contract created
- `CONTRACT_ACTIVATED` - Contract activated
- `CONTRACT_TERMINATED` - Contract terminated
- `CONTRACT_TERMINATION_REQUESTED` - Termination requested
- `CONTRACT_TERMINATION_APPROVED` - Termination approved

### Payments Channel

- `PAYMENT_RECEIVED` - Payment successfully processed
- `PAYMENT_FAILED` - Payment failed
- `PAYMENT_DUE_REMINDER` - Upcoming payment reminder
- `PAYMENT_OVERDUE` - Payment is overdue

### Documents Channel

- `DOCUMENT_UPLOADED` - Document uploaded by user
- `DOCUMENT_APPROVED` - Document approved by admin
- `DOCUMENT_REJECTED` - Document rejected by admin

### Workflow Channel

- `PHASE_ACTIVATED` - Contract phase activated
- `PHASE_COMPLETED` - Contract phase completed
- `STEP_COMPLETED` - Workflow step completed
- `STEP_REJECTED` - Workflow step rejected

## Database Schema

### WorkflowEvent

```sql
CREATE TABLE workflow_events (
  id VARCHAR PRIMARY KEY,
  tenant_id VARCHAR NOT NULL,
  event_type_id VARCHAR NOT NULL,
  payload JSON NOT NULL,
  source VARCHAR NOT NULL,
  actor_id VARCHAR,
  actor_type ENUM('USER', 'SYSTEM', 'WEBHOOK', 'API_KEY'),
  status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED'),
  correlation_id VARCHAR,
  causation_id VARCHAR,
  error TEXT,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_event_type (event_type_id),
  INDEX idx_correlation (correlation_id),
  INDEX idx_status (status)
);
```

### EventType

```sql
CREATE TABLE event_types (
  id VARCHAR PRIMARY KEY,
  tenant_id VARCHAR NOT NULL,
  channel_id VARCHAR NOT NULL,
  code VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  payload_schema JSON,
  enabled BOOLEAN DEFAULT TRUE,
  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE (tenant_id, code)
);
```

### EventHandler

```sql
CREATE TABLE event_handlers (
  id VARCHAR PRIMARY KEY,
  tenant_id VARCHAR NOT NULL,
  event_type_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  handler_type ENUM('SEND_EMAIL', 'SEND_SMS', 'SEND_PUSH', 'CALL_WEBHOOK', 'ADVANCE_WORKFLOW', 'RUN_AUTOMATION'),
  config JSON NOT NULL,
  priority INT DEFAULT 100,
  enabled BOOLEAN DEFAULT TRUE,
  max_retries INT DEFAULT 3,
  retry_delay_ms INT DEFAULT 1000,
  filter_condition TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_event_type (event_type_id)
);
```

### EventHandlerExecution

```sql
CREATE TABLE event_handler_executions (
  id VARCHAR PRIMARY KEY,
  event_id VARCHAR NOT NULL,
  handler_id VARCHAR NOT NULL,
  status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'),
  attempt INT DEFAULT 1,
  input JSON,
  output JSON,
  error TEXT,
  error_code VARCHAR,
  started_at DATETIME,
  completed_at DATETIME,
  duration_ms INT,
  created_at DATETIME,
  INDEX idx_event (event_id),
  INDEX idx_handler (handler_id),
  INDEX idx_status (status)
);
```

## Next Steps

### 1. Seed Event Types (Required)

```bash
# For each tenant
tsx shared/common/scripts/seed-events.ts --tenant-id <TENANT_ID>

# Or for all tenants
tsx shared/common/scripts/seed-events.ts --all
```

### 2. Update Service Code (Gradual Migration)

Replace legacy EventPublisher calls with unified event helpers:

```typescript
// Before
import { sendContractCreatedNotification } from "./notifications";
await sendContractCreatedNotification(payload, correlationId);

// After
import { emitContractCreated } from "./unified-notifications";
await emitContractCreated(prisma, tenantId, payload, userId, correlationId);
```

### 3. Configure Handlers (Admin Task)

Admins configure handlers via UI or seed examples:

```bash
tsx shared/common/scripts/seed-events.ts --tenant-id <ID> --with-examples
```

### 4. Migrate Historical Events (Optional)

```bash
tsx services/mortgage-service/scripts/migrate-contract-events.ts --tenant-id <ID>
```

### 5. Update E2E Tests

Update tests to verify WorkflowEvent creation instead of checking SNS directly.

### 6. Monitor & Verify

Query WorkflowEvent and EventHandlerExecution tables to verify:

- Events are being created
- Handlers are executing
- Notifications are being sent

## Benefits Achieved

### ✅ Full Audit Trail

Every event is permanently logged in the database with full context.

### ✅ Admin Control

Admins can add/remove/configure handlers without code changes.

### ✅ Execution Tracking

Every handler execution is logged with status, input, output, and errors.

### ✅ Multi-Transport

Events can be delivered via HTTP, SNS, SQS, or EventBridge.

### ✅ Correlation

Related events can be linked via correlationId for workflow tracing.

### ✅ Retry Logic

Failed handlers are automatically retried with configurable backoff.

### ✅ Filter Conditions

Handlers can be conditionally executed based on payload values.

### ✅ Priority Ordering

Multiple handlers execute in priority order (lower number = higher priority).

## Documentation

- [`EVENT_SYSTEM_MIGRATION.md`](EVENT_SYSTEM_MIGRATION.md) - Migration guide
- [`shared/common/src/events/README.md`](shared/common/src/events/README.md) - API documentation (to be created)
- [`docs/EVENT_ARCHITECTURE.md`](docs/EVENT_ARCHITECTURE.md) - Architecture design (to be created)

## Support

For questions or issues:

1. Check [`EVENT_SYSTEM_MIGRATION.md`](EVENT_SYSTEM_MIGRATION.md) troubleshooting section
2. Query EventHandlerExecution table for error details
3. Review WorkflowEvent.error field for processing errors

# Event-Driven FSM Architecture (n8n-style)

## Overview

The Mortgage FSM has been redesigned as an event-driven system similar to n8n, where state transitions trigger events that are sent to external endpoints (microservices). This architecture enables:

- **Microservices Communication**: Each action calls an external service via HTTP, SNS, or EventBridge
- **Horizontal Scalability**: Services can scale independently
- **Loose Coupling**: FSM doesn't need to know implementation details of actions
- **Easy Migration**: Switch from HTTP to AWS SNS/EventBridge with configuration changes
- **Resilience**: Built-in retry logic, dead letter queues, and failure handling

## Architecture Components

### 1. Event Bus Service (`EventBusService`)

Core service that handles event publishing and routing to different transports.

**Supported Transports:**

- **HTTP**: Direct webhook calls to microservices
- **SNS**: AWS Simple Notification Service (fan-out pattern)
- **EventBridge**: AWS EventBridge (event-driven architecture)
- **SQS**: AWS SQS queues
- **Internal**: In-process handlers for local development

### 2. FSM Event Configuration (`FSMEventConfig`)

Maps FSM actions to microservice endpoints. Automatically registers handlers on application startup.

**Configuration Example:**

```typescript
{
    eventType: MortgageAction.NOTIFY_BORROWER,
    transport: EventTransportType.HTTP,
    endpoint: 'http://notification-service:3000/borrower',
    authentication: {
        type: 'api-key',
        credentials: 'your-api-key'
    },
    retryConfig: {
        maxRetries: 3,
        retryDelay: 2000,
        backoffMultiplier: 2
    }
}
```

### 3. Mortgage FSM Service

The FSM service now:

1. Validates transition guards
2. **Publishes events** to the event bus (instead of executing actions directly)
3. Records state changes
4. Handles failures and rollbacks

## Microservices Architecture

### Recommended Service Breakdown

#### 1. **Notification Service**

- **Endpoints:**
  - `POST /notifications/borrower` - Send notifications to borrowers
  - `POST /notifications/underwriter` - Notify underwriters
  - `POST /notifications/email` - Send emails
  - `POST /notifications/sms` - Send SMS messages

#### 2. **Document Service**

- **Endpoints:**
  - `POST /documents/request` - Request documents from borrower
  - `POST /documents/generate-agreement` - Generate loan agreement
  - `POST /documents/generate-closing` - Generate closing documents

#### 3. **Appraisal Service**

- **Endpoints:**
  - `POST /appraisal/order` - Order property appraisal
  - `POST /inspection/request` - Request property inspection

#### 4. **Credit Service**

- **Endpoints:**
  - `POST /credit/check` - Run credit check
  - `POST /verification/income` - Verify borrower income
  - `POST /verification/employment` - Verify employment

#### 5. **Payment Service**

- **Endpoints:**
  - `POST /payments/setup-schedule` - Setup payment schedule
  - `POST /payments/process` - Process a payment
  - `POST /payments/refund` - Process refund

#### 6. **Legal Service**

- **Endpoints:**
  - `POST /legal/initiate-foreclosure` - Initiate foreclosure
  - `POST /legal/schedule-auction` - Schedule foreclosure auction

#### 7. **Compliance Service**

- **Endpoints:**
  - `POST /compliance/update-credit-bureau` - Report to credit bureaus
  - `POST /compliance/report-regulator` - Generate regulatory reports

#### 8. **Fund Service**

- **Endpoints:**
  - `POST /funds/disburse` - Disburse loan funds
  - `POST /funds/freeze-account` - Freeze borrower account

#### 9. **Analytics Service**

- **Endpoints:**
  - `POST /analytics/update` - Update analytics data

#### 10. **Audit Service**

- **Endpoints:**
  - `POST /audit/log` - Log audit trail

## Event Payload Structure

All events follow this standard payload format:

```typescript
{
  "eventType": "NOTIFY_BORROWER",
  "eventId": "evt_1234567890_abc123",
  "timestamp": "2025-12-19T10:30:00.000Z",
  "tenantId": 1,
  "source": "mortgage-fsm",
  "correlationId": "evt_1234567890_abc123",
  "data": {
    "mortgageId": 123,
    "borrowerId": 456,
    "propertyId": 789,
    "principal": 500000,
    "downPayment": 100000,
    "interestRate": 4.5,
    "termMonths": 360,
    "triggeredBy": "system"
  },
  "metadata": {
    "fromState": "SUBMITTED",
    "toState": "DOCUMENT_COLLECTION",
    "event": "REQUEST_DOCUMENTS"
  }
}
```

## Configuration

### Environment Variables

```bash
# Microservices Configuration
MICROSERVICES_BASE_URL=http://localhost:3000
MICROSERVICES_API_KEY=your-secret-api-key

# AWS Configuration (for SNS/EventBridge)
AWS_REGION=us-east-1
AWS_SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:mortgage-events
AWS_EVENTBRIDGE_BUS=mortgage-event-bus
```

## Migration Path: HTTP → SNS/EventBridge

### Step 1: Current Setup (HTTP)

All actions call HTTP endpoints directly:

```typescript
{
    eventType: MortgageAction.NOTIFY_BORROWER,
    transport: EventTransportType.HTTP,
    endpoint: 'http://notification-service:3000/borrower',
}
```

### Step 2: Migrate to SNS (Fan-Out Pattern)

Change transport to SNS, multiple services can subscribe:

```typescript
{
    eventType: MortgageAction.NOTIFY_BORROWER,
    transport: EventTransportType.SNS,
    snsTopicArn: 'arn:aws:sns:us-east-1:123456789012:borrower-notifications',
}
```

**SNS Benefits:**

- Multiple subscribers (email service, SMS service, push notifications)
- Built-in retry and dead letter queue
- Fully managed by AWS
- Cross-region replication

### Step 3: Migrate to EventBridge (Event-Driven)

For complex event routing and filtering:

```typescript
{
    eventType: MortgageAction.NOTIFY_BORROWER,
    transport: EventTransportType.EVENTBRIDGE,
    eventBridgeDetail: {
        eventBusName: 'mortgage-event-bus',
        source: 'mortgage.fsm',
        detailType: 'Mortgage.NotificationRequested'
    }
}
```

**EventBridge Benefits:**

- Content-based filtering
- Built-in integrations (Lambda, Step Functions, SQS, etc.)
- Event replay capability
- Schema registry
- Cross-account event delivery

## Retry & Failure Handling

### Automatic Retries

Each event handler can configure retry behavior:

```typescript
retryConfig: {
    maxRetries: 3,              // Retry up to 3 times
    retryDelay: 2000,           // Wait 2 seconds before first retry
    backoffMultiplier: 2        // Double delay each retry (2s, 4s, 8s)
}
```

### Dead Letter Queue

Failed events (after exhausting retries) are sent to a dead letter queue for manual review:

```typescript
{
    enableDeadLetterQueue: true,
    deadLetterQueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/mortgage-dlq'
}
```

## Testing

### Local Development (HTTP)

```bash
# Start mock microservices
cd test-services
npm install
npm start  # Starts mock HTTP endpoints on localhost:3000

# Test FSM transition
curl -X POST http://localhost:3000/mortgage-fsm/transition \
  -H "Content-Type: application/json" \
  -d '{
    "mortgageId": 1,
    "event": "SUBMIT_APPLICATION",
    "triggeredBy": "user:123"
  }'
```

### Testing with SNS

```bash
# Subscribe to SNS topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:mortgage-events \
  --protocol email \
  --notification-endpoint your-email@example.com

# Trigger event (will be sent to SNS)
curl -X POST http://localhost:3000/mortgage-fsm/transition \
  -H "Content-Type: application/json" \
  -d '{
    "mortgageId": 1,
    "event": "SUBMIT_APPLICATION",
    "triggeredBy": "system"
  }'
```

## Monitoring & Observability

### Event Tracking

Every event execution is tracked:

```typescript
{
  "success": true,
  "eventId": "evt_1234567890_abc123",
  "statusCode": 200,
  "response": { "messageId": "msg-456" },
  "retryCount": 0,
  "executionTime": 245,  // milliseconds
  "transport": "http"
}
```

### Logs

Events are logged with correlation IDs for tracing:

```
[MortgageFSMService] Transition successful: DRAFT -> SUBMITTED (SUBMIT_APPLICATION)
  mortgageId=1 triggeredBy=user:123 durationMs=500 transitionId=10

[EventBusService] Publishing event: NOTIFY_UNDERWRITER [evt_1234567890_abc123]
[EventBusService] Event evt_1234567890_abc123 executed successfully via http (attempt 1/4)
```

## Example: Complete Flow

### 1. User submits mortgage application

```typescript
await mortgageFSM.transition(
  mortgageId: 1,
  event: MortgageEvent.SUBMIT_APPLICATION,
  context: { borrowerId: 123, propertyId: 456 },
  triggeredBy: 'user:123'
);
```

### 2. FSM publishes events

The transition triggers these webhook calls:

```
POST http://notification-service:3000/notifications/underwriter
POST http://audit-service:3000/audit/log
```

### 3. Microservices respond

Each service processes independently:

```typescript
// Notification Service
app.post('/notifications/underwriter', async (req, res) => {
  const { data } = req.body;
  await sendEmail({
    to: 'underwriter@example.com',
    subject: `New Mortgage Application #${data.mortgageId}`,
    template: 'new-application',
    data,
  });
  res.json({ success: true, messageId: 'email-123' });
});
```

### 4. Event bus tracks results

```typescript
[
  {
    success: true,
    eventId: 'evt_1234_abc',
    transport: 'http',
    executionTime: 245,
  },
  {
    success: true,
    eventId: 'evt_1234_def',
    transport: 'http',
    executionTime: 123,
  },
];
```

## Best Practices

1. **Idempotency**: Services should handle duplicate events (use `eventId`)
2. **Timeouts**: Set reasonable timeouts for long-running operations
3. **Authentication**: Always use API keys or bearer tokens
4. **Versioning**: Include API version in endpoints (`/v1/notifications/borrower`)
5. **Circuit Breaker**: Implement circuit breaker for failing services
6. **Monitoring**: Track event success rates, latency, and errors
7. **Dead Letter Queues**: Monitor and replay failed events
8. **Correlation IDs**: Use for tracing across services

## AWS SNS Setup (Production)

```bash
# Create SNS topic
aws sns create-topic --name mortgage-events

# Create SQS queue for each service
aws sqs create-queue --queue-name notification-service-queue

# Subscribe queue to SNS topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:mortgage-events \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:123456789012:notification-service-queue \
  --attributes RawMessageDelivery=true

# Grant SNS permission to send to SQS
aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/notification-service-queue \
  --attributes file://queue-policy.json
```

## AWS EventBridge Setup (Production)

```bash
# Create custom event bus
aws events create-event-bus --name mortgage-event-bus

# Create rule to route events
aws events put-rule \
  --name route-notifications \
  --event-bus-name mortgage-event-bus \
  --event-pattern '{
    "source": ["mortgage.fsm"],
    "detail-type": ["Mortgage.NotificationRequested"]
  }'

# Add Lambda target
aws events put-targets \
  --rule route-notifications \
  --event-bus-name mortgage-event-bus \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:123456789012:function:notification-handler"
```

## Performance Considerations

- **Parallel Execution**: Events are published in parallel (fan-out)
- **Async Processing**: FSM doesn't wait for microservice responses
- **Backpressure**: Use SQS queues to handle bursts
- **Caching**: Cache frequently accessed data (property details, user info)
- **Batching**: Batch similar events when possible

## Next Steps

1. **Implement mock microservices** for local testing
2. **Set up AWS SNS topics** for production
3. **Configure EventBridge** for event-driven architecture
4. **Add monitoring dashboards** (CloudWatch, Datadog, Grafana)
5. **Implement circuit breakers** for resilience
6. **Set up distributed tracing** (X-Ray, Jaeger)

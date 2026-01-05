# Mortgage Platform Feature Roadmap

## Phase 1: Foundation & Reliability

### 1. Transactional Outbox

Ensure reliable event delivery: DB outbox, dispatcher, retries, DLQ, and correlation IDs.

### 2. Idempotent SQS Consumers

Dedupe and idempotency storage for consumers; safe retries and poison message handling.

### 3. E-signature & Documents ⬅️ **PRIORITY**

Document upload (presigned S3), PDF assembly, e-sign integration, and signed artifact storage.

**Document Types:**

- **Provisional Offer Letter** — Conditional approval after prequalification
- **Final Offer Letter** — Binding agreement when contract is activated

**Flow:**

1. Generate document from template (Handlebars → HTML → PDF)
2. Store PDF on S3 via presigned URL
3. Create `Document` record with status `PENDING_SIGNATURE`
4. Send document to customer for review/signature (email notification)
5. Customer signs (simple acceptance or e-sign vendor)
6. Update document status to `SIGNED`, store signed artifact
7. Trigger next workflow step (e.g., activate contract)

### 4. Document Templates

Template management, merge fields, versioning, and server-side document assembly.

---

## Phase 2: Underwriting & Pricing

### 5. Automated Underwriting (AUS)

Rules engine for automated decisions, scoring, manual escalation, and decision provenance.

### 6. Credit Bureau Integration

Soft/hard pulls, mapping bureau responses, and storing/reconciling credit data.

### 7. Pricing & Rate Engine

Real-time pricing, locks, investor overlays, and rate quote APIs.

---

## Phase 3: Loan Origination

### 8. Loan Origination System (LOS) Features

Application flows, checklists, tasking, pipeline states, and originator tools.

### 9. Title & Insurance Integration

Order, track, and attach title/insurance results to loan files.

---

## Phase 4: Servicing & Payments

### 10. Loan Servicing Module

Payment posting, escrow, amortization schedules, statements, and remittance.

- [x] Payment method change flow (E2E tests, SUPERSEDED enum migration, contract-phase and payment-method-change service fixes) — 2026-01-05

### 11. Payments & PCI Compliance

Payment gateway integrations, tokenization/vaulting, reconciliation, and refunds.

---

## Phase 5: Secondary Market

### 12. Investor Delivery Pipeline

Investor mapping, packaging, delivery artifacts, and investor reporting.

---

## Phase 6: Platform Hardening

### 13. Observability & Tracing

Distributed tracing, structured logs, metrics, DLQ alerts, and dashboards.

### 14. Schema & Event Governance

Message schema registry, versioning, contract tests, and CI validation.

### 15. Compliance & QC Automation

Automated regulatory checks, audit trails, and QC rules.

---

## Phase 7: Customer Experience

### 16. Mobile & Customer Portal

Customer UX for status, documents, signing, and payments (mobile + web).

---

## Phase 8: Integrations & Scale

### 17. Vendor Connector Framework

Pluggable adapters for external vendors with mocks for local/dev.

### 18. Reporting & Analytics

Pipeline KPIs, risk reports, and operational dashboards.

### 19. Scalability & High-Availability Infra

Multi-region architecture, autoscaling, failover, and infra CI/CD.

### 20. Security & IAM

SSO/RBAC, secrets management, encryption, and security hardening.

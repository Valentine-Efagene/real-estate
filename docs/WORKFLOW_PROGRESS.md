# QShelter Platform — Workflow Progress Tracker

> Last updated: 2025-07-19
> Canonical test: `demo-frontend/e2e/full-mortgage-flow.spec.ts`

This document tracks the implementation status of all business workflows across the platform.

---

## Core Application Flow (Loan Origination System)

| Phase             | Category      | Type         | Status         | Notes                                                |
| ----------------- | ------------- | ------------ | -------------- | ---------------------------------------------------- |
| Prequalification  | QUESTIONNAIRE | PRE_APPROVAL | ✅ Implemented | Scoring, thresholds, manual approval by mortgage_ops |
| Sales Offer       | DOCUMENTATION | VERIFICATION | ✅ Implemented | Developer uploads offer letter, auto-approved        |
| KYC Documentation | DOCUMENTATION | KYC          | ✅ Implemented | Two-stage review: PLATFORM then BANK                 |
| Downpayment       | PAYMENT       | DOWNPAYMENT  | ✅ Implemented | Wallet credit → auto-allocation → phase completion   |
| Mortgage Offer    | DOCUMENTATION | VERIFICATION | ✅ Implemented | Lender uploads offer letter, auto-approved           |

---

## Application State Machine

| State           | Trigger                  | Status         | Notes |
| --------------- | ------------------------ | -------------- | ----- |
| DRAFT           | Creation                 | ✅ Implemented |       |
| QUESTIONNAIRE   | Activation               | ✅ Implemented |       |
| DOCUMENTATION   | Phase transition         | ✅ Implemented |       |
| PAYMENT_PENDING | Phase transition         | ✅ Implemented |       |
| ACTIVE          | All phases complete      | ✅ Implemented |       |
| COMPLETED       | Final phase complete     | ✅ Implemented |       |
| SUPERSEDED      | Another buyer locks unit | ✅ Implemented |       |
| TRANSFERRED     | Unit transfer approved   | ✅ Implemented |       |
| TERMINATED      | Customer/admin action    | ✅ Implemented |       |

---

## Document Review

| Feature                            | Status         | Notes                                                     |
| ---------------------------------- | -------------- | --------------------------------------------------------- |
| Multi-stage review (PLATFORM→BANK) | ✅ Implemented |                                                           |
| Auto-approval by uploader type     | ✅ Implemented |                                                           |
| Document rejection + cascade back  | ✅ Implemented |                                                           |
| Conditional documents              | ✅ Implemented | e.g., spouse ID only for joint applications               |
| Document waiver (admin)            | ✅ Implemented |                                                           |
| SLA tracking per review stage      | ✅ Implemented | `slaHours` on `ApplicationOrganization`                   |
| SLA breach detection (Lambda)      | ⚠️ Schema only | `ScheduledJob` model exists; Lambda not deployed          |
| Document expiry tracking           | ✅ Implemented | `expiresAt` + `isExpired` on `ApplicationDocument`        |
| Document expiry warning Lambda     | ⚠️ Schema only | `DocumentExpiryWarning` model exists; Lambda not deployed |

---

## Payments

| Feature                         | Status         | Notes                                                     |
| ------------------------------- | -------------- | --------------------------------------------------------- |
| ONE_TIME payment (downpayment)  | ✅ Implemented |                                                           |
| Wallet credit + auto-allocation | ✅ Implemented |                                                           |
| Payment reminder Lambda         | ⚠️ Schema only | `ScheduledJobType.PAYMENT_REMINDER` defined; not deployed |
| Payment method change request   | ✅ Implemented |                                                           |

---

## Offer Letters

| Feature                      | Status         | Notes |
| ---------------------------- | -------------- | ----- |
| Provisional offer letter     | ✅ Implemented |       |
| Final offer letter (signing) | ✅ Implemented |       |

---

## Terminations & Transfers

| Feature                           | Status         | Notes |
| --------------------------------- | -------------- | ----- |
| Termination request               | ✅ Implemented |       |
| Termination approval              | ✅ Implemented |       |
| Refund tracking                   | ✅ Implemented |       |
| Property transfer request         | ✅ Implemented |       |
| Transfer approval                 | ✅ Implemented |       |
| Unit superseding (new buyer lock) | ✅ Implemented |       |

---

## Organizations & RBAC

| Feature                        | Status         | Notes                                                        |
| ------------------------------ | -------------- | ------------------------------------------------------------ |
| Organization types (dynamic)   | ✅ Implemented | PLATFORM, BANK, DEVELOPER, LEGAL, INSURER, GOVERNMENT        |
| Multi-type organizations       | ✅ Implemented | Many-to-many via `OrganizationTypeAssignment`                |
| Role-based access control      | ✅ Implemented | admin, user, mortgage_ops, finance, legal, agent, lender_ops |
| Lambda authorizer (DynamoDB)   | ✅ Implemented |                                                              |
| Policy sync (SNS → SQS → DDB)  | ✅ Implemented |                                                              |
| Organization invitation emails | ✅ Implemented |                                                              |
| Qualification flows            | ✅ Implemented |                                                              |

---

## Notifications (Email via SQS → Office365)

| Template                          | HBS File                            | Handler Mapped | Notes                           |
| --------------------------------- | ----------------------------------- | -------------- | ------------------------------- |
| Welcome                           | welcomeMessage.hbs                  | ✅             |                                 |
| Verify Email                      | verifyEmail.hbs                     | ✅             |                                 |
| OTP                               | otp.hbs                             | ✅             |                                 |
| Reset Password                    | resetPassword.hbs                   | ✅             |                                 |
| Account Verified                  | accountVerified.hbs                 | ✅             |                                 |
| Account Suspended                 | accountSuspended.hbs                | ✅             |                                 |
| Wallet Top Up                     | walletTopUp.hbs                     | ✅             |                                 |
| Missed Payments                   | missedPayments.hbs                  | ✅             |                                 |
| Property Allocation               | propertyAllocation.hbs              | ✅             |                                 |
| Updated Terms                     | updatedTermsAndConditions.hbs       | ✅             |                                 |
| Prequalification Submitted        | prequalificationSubmitted.hbs       | ✅             |                                 |
| Prequalification Approved         | prequalificationApproved.hbs        | ✅             |                                 |
| Prequalification Rejected         | prequalificationRejected.hbs        | ✅             |                                 |
| Application Created               | applicationCreated.hbs              | ✅             |                                 |
| Application Activated             | applicationActivated.hbs            | ✅             |                                 |
| Application Termination Requested | applicationTerminationRequested.hbs | ✅             |                                 |
| Application Termination Approved  | applicationTerminationApproved.hbs  | ✅             |                                 |
| Application Terminated            | applicationTerminated.hbs           | ✅             |                                 |
| Application Congratulations       | applicationCongratulations.hbs      | ❌             | HBS exists but not in validator |
| Application Superseded            | ❌                                  | ❌             | Needs template + handler        |
| Payment Received                  | paymentReceived.hbs                 | ✅             |                                 |
| Payment Failed                    | paymentFailed.hbs                   | ✅             |                                 |
| Payment Reminder                  | paymentReminder.hbs                 | ✅             |                                 |
| Provisional Offer Letter          | provisionalOfferLetter.hbs          | ✅             |                                 |
| Final Offer Letter                | finalOfferLetter.hbs                | ✅             |                                 |
| Document Approved                 | documentApproved.hbs                | ✅             |                                 |
| Document Rejected                 | documentRejected.hbs                | ✅             |                                 |
| Organization Invitation           | organizationInvitation.hbs          | ✅             |                                 |
| Organization Invitation Accepted  | organizationInvitationAccepted.hbs  | ✅             |                                 |
| SLA Warning                       | ❌                                  | ❌             | Needs template + handler        |
| SLA Breached                      | ❌                                  | ❌             | Needs template + handler        |
| Bank Review Required              | ❌                                  | ❌             | Needs template + handler        |
| Questionnaire Phase Completed     | ❌                                  | ❌             | Needs template + handler        |
| Documentation Phase Completed     | ❌                                  | ❌             | Needs template + handler        |
| Payment Phase Completed           | ❌                                  | ❌             | Needs template + handler        |

---

## Property Discovery

| Feature                           | Status         | Notes                         |
| --------------------------------- | -------------- | ----------------------------- |
| List properties                   | ✅ Implemented |                               |
| Property detail                   | ✅ Implemented |                               |
| Property search / filter          | ❌ Not started | GET /properties/search needed |
| Property variants (types/pricing) | ✅ Implemented |                               |
| Property units                    | ✅ Implemented |                               |
| Unit locking                      | ✅ Implemented |                               |
| Payment methods per property      | ✅ Implemented |                               |

---

## Co-Applicant

| Feature                       | Status         | Notes                                                |
| ----------------------------- | -------------- | ---------------------------------------------------- |
| Co-applicant model            | ❌ Not started | Schema + API routes needed                           |
| Co-applicant invitation       | ❌ Not started |                                                      |
| Co-applicant acceptance       | ❌ Not started |                                                      |
| Conditional documents (joint) | ✅ Implemented | Exists as document conditions in documentation plans |

---

## Scheduled Jobs / Background Processing

| Job                            | Status         | Notes                                                 |
| ------------------------------ | -------------- | ----------------------------------------------------- |
| SLA breach check Lambda        | ❌ Not started | EventBridge rule + handler needed in mortgage-service |
| Document expiry warning Lambda | ❌ Not started | EventBridge rule + handler needed                     |
| Payment reminder Lambda        | ❌ Not started | EventBridge rule + handler needed                     |
| ScheduledJob tracking model    | ✅ Schema only | `ScheduledJob` + `DocumentExpiryWarning` models in DB |

---

## Testing

| Test Suite                           | Status          | Notes                                             |
| ------------------------------------ | --------------- | ------------------------------------------------- |
| Playwright full mortgage flow        | ✅ Passing      | 7.3 min, 31 steps, Emeka/Sunrise Heights scenario |
| Service E2E tests (mortgage-service) | ⚠️ Needs update | May still reference old Chidi/Lekki scenario      |
| AWS staging full E2E                 | ✅ Exists       | `tests/aws/full-mortgage-flow/`                   |
| LocalStack integration tests         | ✅ Exists       | `tests/localstack/`                               |
| Authorizer benchmarks                | ✅ Exists       | `tests/aws/authorizer/`                           |

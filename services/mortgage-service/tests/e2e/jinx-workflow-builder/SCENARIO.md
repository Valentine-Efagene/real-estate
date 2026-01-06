# Workflow Builder — Jinx Configures Payment Templates

## Actors

- **Jinx** (Admin): Loan operations manager at QShelter
- **Property**: Lekki Sunset Gardens, ₦95,000,000
- **Template**: "Standard 10/90 Mortgage" - a reusable workflow template

---

## Flow

### Story: Jinx Creates and Configures a Workflow Template

1. Jinx logs into the QShelter admin portal and navigates to Payment Configuration.

2. Jinx creates a new payment method template called "Standard 10/90 Mortgage" with:
   - 10% downpayment, 90% mortgage
   - Auto-activate phases enabled
   - Manual approval required

3. Jinx adds **Phase 1: Underwriting & Documentation** (DOCUMENTATION phase):
   - phaseType: KYC
   - Order: 1
   - Requires previous phase completion: false (this is the first phase)

4. Jinx adds steps to Phase 1 dynamically:
   - Step 1: "Pre-Approval Questionnaire" (REVIEW)
   - Step 2: "Upload Valid ID" (UPLOAD)
   - Step 3: "Upload Bank Statements" (UPLOAD)
   - Step 4: "Upload Employment Letter" (UPLOAD)
   - Step 5: "Admin Review & Approval" (APPROVAL)
   - Step 6: "Generate Provisional Offer" (GENERATE_DOCUMENT)
   - Step 7: "Sign Provisional Offer" (SIGNATURE)

5. Jinx adds document requirements to Phase 1:
   - Valid ID (required, PDF/JPEG, max 5MB)
   - Bank Statement (required, PDF only, max 10MB)
   - Employment Letter (required, PDF only, max 5MB)

6. Jinx adds **Phase 2: Downpayment** (PAYMENT phase):
   - Order: 2
   - 10% of property price
   - Links to a one-time payment plan

7. Jinx adds **Phase 3: Final Documentation** (DOCUMENTATION phase):
   - phaseType: VERIFICATION
   - Order: 3

8. Jinx adds steps to Phase 3:
   - Step 1: "Generate Final Offer Letter" (GENERATE_DOCUMENT)
   - Step 2: "Sign Final Offer" (SIGNATURE)

9. Jinx adds **Phase 4: Mortgage Payments** (PAYMENT phase):
   - Order: 4
   - 90% of property price
   - Links to monthly installment plan

10. Jinx realizes she wants to reorder the steps in Phase 1 — moves "Admin Review" to after document uploads.

11. Jinx updates Step 6 metadata to include auto-send configuration.

12. Jinx links the payment method to "Lekki Sunset Gardens" property.

13. Jinx clones the template as "Premium 20/80 Mortgage" for a different property with adjusted percentages.

14. The system confirms the workflow template is ready for customer applications.

---

## Expected Outcomes

- Payment method template is created with 4 phases
- Phase 1 has 7 steps and 3 document requirements
- Phase 3 has 2 steps
- Steps can be reordered without deleting
- Template can be cloned for variations
- Template is linked to a property

---

## API Endpoints Tested

| Action           | Endpoint                                             | Method |
| ---------------- | ---------------------------------------------------- | ------ |
| Create template  | `/payment-methods`                                   | POST   |
| Add phase        | `/payment-methods/:id/phases`                        | POST   |
| Add step         | `/payment-methods/:id/phases/:phaseId/steps`         | POST   |
| Update step      | `/payment-methods/:id/phases/:phaseId/steps/:stepId` | PATCH  |
| Delete step      | `/payment-methods/:id/phases/:phaseId/steps/:stepId` | DELETE |
| Reorder steps    | `/payment-methods/:id/phases/:phaseId/steps/reorder` | POST   |
| Add document     | `/payment-methods/:id/phases/:phaseId/documents`     | POST   |
| Clone template   | `/payment-methods/:id/clone`                         | POST   |
| Link to property | `/payment-methods/:id/properties`                    | POST   |

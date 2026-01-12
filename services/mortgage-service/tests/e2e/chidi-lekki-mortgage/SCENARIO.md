# Loan Origination System — Chidi's Lekki Mortgage

## Actors

- **Adaeze** (Admin): Loan operations manager at QShelter
- **Chidi** (Customer): First-time homebuyer purchasing a 3-bedroom flat in Lekki
- **Property**: Lekki Gardens Estate, Unit 14B, ₦85,000,000
- **Payment Plan**: 10% downpayment, 90% mortgage at 9.5% p.a. over 20 years
- **Investor**: Sterling Bank (receives final offer letter for loan packaging)

---

## Flow

### Phase Configuration

1. Adaeze configures the "10/90 Lekki Mortgage" payment method with the following phases:

   **Phase 1: Underwriting & Documentation** (DOCUMENTATION)
   - Step 1: Pre-approval questionnaire (employment, income, debt)
   - Step 2: Upload Valid ID
   - Step 3: Upload Bank Statements (6 months)
   - Step 4: Upload Employment Letter
   - Step 5: Admin Review & Approval
   - Step 6: Generate Provisional Offer Letter _(GENERATE_DOCUMENT)_
   - Step 7: Customer Signature on Provisional Offer

   **Phase 2: Downpayment** (PAYMENT)
   - 10% of property price = ₦8,500,000
   - One-time payment

   **Phase 3: Final Documentation** (DOCUMENTATION)
   - Step 1: Admin Uploads Final Offer Letter _(UPLOAD, admin-only)_
   - Step 2: Customer Signs Final Offer _(SIGNATURE)_
   - Phase Event: ON*COMPLETE → Share with Sterling Bank *(optional, configurable)\_

   **Phase 4: Mortgage** (PAYMENT)
   - 90% of property price = ₦76,500,000
   - 240 monthly installments at 9.5% p.a.

---

### Customer Journey

2. Chidi selects Unit 14B at Lekki Gardens and chooses the 10/90 payment plan; the system creates a draft application for him.

3. Chidi completes the pre-approval questionnaire with his employment and income details.

4. Chidi uploads his employment letter, bank statements, and valid ID.

5. Chidi submits the application.

6. The system evaluates Chidi's eligibility through automated underwriting (DTI calculation, scoring).

7. Adaeze reviews and approves Chidi's application; approval step is marked complete.

8. The system automatically generates the provisional offer letter and sends it to Chidi.

9. Chidi reviews and signs the provisional offer; the signed document is stored.

10. Upon Chidi's signature, the system creates and activates his contract with the configured phases.

11. Chidi pays the ₦8,500,000 downpayment.

12. Upon confirmed downpayment, the Final Documentation phase activates and the system automatically generates the final offer letter.

13. Chidi reviews and signs the final offer; the signed document is stored.

14. The system shares the final offer letter with Sterling Bank for loan packaging.

15. The Mortgage phase activates with 240 monthly installments scheduled.

16. The system sends Chidi a congratulations email with the final offer letter attached.

17. The system notifies the servicing, accounting, and payment processing teams of Chidi's new contract.

18. All significant events and documents are retained for audit, compliance, and operational review.

---

## Configuration Notes

### Offer Letter Timing Options

Some banks require the final offer letter after underwriting approval; others require it after downpayment. Adaeze configures this by placing the `GENERATE_DOCUMENT` step in the appropriate phase:

| Bank Requirement               | Configuration                                           |
| ------------------------------ | ------------------------------------------------------- |
| Final offer after underwriting | GENERATE_DOCUMENT step in Phase 1 (Underwriting)        |
| Final offer after downpayment  | GENERATE_DOCUMENT step in Phase 3 (Final Documentation) |

### Step Types Used

| Step Type           | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `UPLOAD`            | Customer uploads a document                                  |
| `APPROVAL`          | Admin reviews and approves                                   |
| `SIGNATURE`         | Customer signs a document                                    |
| `GENERATE_DOCUMENT` | System generates a document (offer letter, contract summary) |
| `EXTERNAL_CHECK`    | External system verification                                 |

### GENERATE_DOCUMENT Metadata

```json
{
  "documentType": "PROVISIONAL_OFFER | FINAL_OFFER | CONTRACT_SUMMARY",
  "autoSend": true,
  "expiresInDays": 30
}
```

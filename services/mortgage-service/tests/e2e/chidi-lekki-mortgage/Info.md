For now, let's not generate in this project. Both letters should be uploaded. The three documents will be

1. Sales offer letter: Uploaded by the developer. This comes after prequalification questionaire phase
2. Preapproval letter: This is uploaded by the bank after the user completes preapproval documentation
3. Mortgage offer letter: This comes from the bank when they approve the mortgage documentation step

The flow is:

- Prequalification questionaire by customer
- Sales offer letter by developer
- Preapproval documentation by customer
- Preapproval letter from bank
- Customer pays downpayment
- Mortgage documentation by customer
- Mortgage offer letter by bank

All these mean that we need to update the flow.

1. We will have 3 user types here:

- Customer
- Developer: Will list the property in this test. Will upload sales offer letter
- Bank: Will upload preapproval letter and mortgage offer letter. The user starts the downpayment phase after the lender uploads this letter.

Where these letters tie up:

1. Signed copy of the sales offer letter is part of preapproval documentation

Note:

- Considering that we are now to support these new users types, who are tied to specific parts of the workflow, we need to extend areas where we just have "admin" vs "user" to now cover the right user type. User types should also be an enum.
- Considering that the onboarding for the user types will definitely be different, I think we should have separate tables for them, but tied by user ID. You may also suggest a better approach, according to best practices, extendability and industry standards.

## Implementation Status

✅ **Test Updated**: The E2E test now implements this flow with:

- 6 phases: Prequalification → Sales Offer → Preapproval Docs → Downpayment → Mortgage Offer → Mortgage
- 4 actors: Chidi (Customer), Emeka (Developer), Nkechi (Lender), Adaeze (Admin)
- Developer uploads Sales Offer Letter, customer signs
- Bank (Nkechi) uploads both Preapproval Letter and Mortgage Offer Letter

✅ **Roles Extended**: The ROLES enum in `@valentine-efagene/qshelter-common` now includes:

- `DEVELOPER` - For property developers who upload sales offer letters
- `LENDER` - For bank representatives who upload preapproval and mortgage offer letters

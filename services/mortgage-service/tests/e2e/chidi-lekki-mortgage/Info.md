For now, let's not generate in this project. Both letters should be uploaded. The three documents will be

1. Sales offer letter: Uploaded by the developer. This comes after preapproval
2. Preapproval letter: This is uploaded by the bank after the user completes preapproval documentation
3. Mortgage offer letter: This comes from the bank when they approve the mortgage step

All these mean that we need to update the flow.

1. We will have 3 user types here:

- Customer
- Developer: Will list the property in this test. Will upload sales offer letter
- Lender: Will upload preapproval letter and mortgage offer letter. The user starts the downpayment phase after the lender uploads this letter.

Where these letters tie up:

1. Signed copy of the sales offer letter is part of preapproval documentation

Note:

- Considering that we are now to support these new users types, who are tied to specific parts of the workflow, we need to extend areas where we just have "admin" vs "user" to now cover the right user type. User types should also be an enum.
- Considering that the onboarding for the user types will definitely be different, I think we should have separate tables for them, but tied by user ID. You may also suggest a better approach, according to best practices, extendability and industry standards.

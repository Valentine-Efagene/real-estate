import { test, expect, Page } from '@playwright/test';

/**
 * Full Mortgage Flow — Playwright E2E Test
 *
 * Exercises the complete MREIF 10/90 Mortgage lifecycle through the demo-frontend UI:
 *
 *   Demo Bootstrap → Emeka browses → starts application → prequalification →
 *   sales offer → KYC docs → downpayment → mortgage offer → COMPLETED
 *
 * Actors (all share password "password"):
 *   Adaeze  (admin)        – platform admin, reviews questionnaires & documents
 *   Yinka   (mortgage_ops) – platform mortgage ops, created by bootstrap
 *   Nneka   (agent)        – Lekki Gardens developer agent, uploads sales offer
 *   Eniola  (mortgage_ops) – Access Bank loan officer, uploads bank docs
 *   Emeka   (customer)     – first-time homebuyer, the applicant
 *
 * Property:
 *   Sunrise Heights Estate → 3-Bedroom Luxury Apartment → Unit A-201 → ₦75M
 *   Payment method: MREIF 10/90 Mortgage (5 phases, 10% down)
 *
 * Mirrors the API-level test at tests/aws/full-mortgage-flow/ — same scenario,
 * different layer (UI vs API).
 */

// ─── Config ─────────────────────────────────────────────────────────────────

const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET || '';
const PASSWORD = 'password';

const EMAILS = {
    adaeze: 'adaeze@mailsac.com',
    yinka: 'yinka@mailsac.com',
    nneka: 'nneka@mailsac.com',
    eniola: 'eniola@mailsac.com',
    emeka: 'emeka@mailsac.com',
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal valid PDF buffer (single blank page). */
function testPdf(label: string) {
    return {
        name: `${label}.pdf`,
        mimeType: 'application/pdf' as const,
        buffer: Buffer.from(
            '%PDF-1.4\n' +
            '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
            '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
            '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
            'xref\n0 4\n' +
            '0000000000 65535 f \n0000000009 00000 n \n' +
            '0000000058 00000 n \n0000000115 00000 n \n' +
            'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
        ),
    };
}

/**
 * Clear auth cookies and log in as a specific user.
 * Preserves the tenantId in localStorage across the login switch.
 */
async function loginAs(page: Page, email: string) {
    // Capture tenantId before clearing cookies (cookie clear doesn't touch localStorage,
    // but some logout flows might)
    const tenantId = await page.evaluate(() =>
        localStorage.getItem('qshelter_tenant_id'),
    );

    await page.context().clearCookies();
    await page.goto('/login');

    // Restore tenantId if it was cleared by the navigation
    if (tenantId) {
        await page.evaluate(
            (tid) => localStorage.setItem('qshelter_tenant_id', tid),
            tenantId,
        );
    }

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Admin/agent/mortgage_ops → /admin/applications, customer → /dashboard
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 15_000 });
}

/**
 * Reload the page in a loop until `textOrRegex` becomes visible.
 * Useful for waiting on async / event-driven phase transitions.
 */
async function pollUntilVisible(
    page: Page,
    textOrRegex: string | RegExp,
    { timeout = 60_000, interval = 5_000 } = {},
) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (await page.getByText(textOrRegex).first().isVisible().catch(() => false)) {
            return;
        }
        await page.waitForTimeout(interval);
        await page.reload();
    }
    // Final assertion — will throw a useful error message
    await expect(page.getByText(textOrRegex).first()).toBeVisible();
}

/**
 * Approve all documents that have a "Review" button on the admin application page.
 * Keeps clicking Review → Approve until no more Review buttons remain.
 */
async function approveAllDocuments(page: Page) {
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations++ < MAX_ITERATIONS) {
        const reviewBtn = page.getByRole('button', { name: 'Review' });
        const visible = await reviewBtn.first().isVisible({ timeout: 3_000 }).catch(() => false);
        if (!visible) break;

        await reviewBtn.first().click();
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

        // Click Approve inside the dialog
        await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
        await page.waitForTimeout(2_000);
    }
}

// ─── Test ───────────────────────────────────────────────────────────────────

test.describe('Full Mortgage Flow — MREIF 10/90', () => {
    // The full flow includes bootstrap (up to 3 min) + 5 phases with persona
    // switches, document uploads, and event-driven transitions.
    test.setTimeout(600_000); // 10 minutes

    test('Emeka applies for Sunrise Heights A-201 via MREIF 10/90 Mortgage', async ({ page }) => {
        test.skip(!BOOTSTRAP_SECRET, 'Set BOOTSTRAP_SECRET env var to run this test');

        let applicationId: string;

        // ═════════════════════════════════════════════════════════════════
        // PHASE 1 — Demo Bootstrap (reset DB + create all actors/orgs/
        //           property/payment method/qualification flows)
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 1: Demo Bootstrap — set up environment', async () => {
            await page.goto('/');

            // Open the Demo Bootstrap dialog
            await page.getByRole('button', { name: '🚀 Demo Bootstrap' }).click();

            // Fill bootstrap secret
            await page.locator('#demoBootstrapSecret').fill(BOOTSTRAP_SECRET);

            // Submit — the proxy polls the backend worker Lambda until done
            await page.getByRole('button', { name: '🚀 Reset & Bootstrap Demo' }).click();

            // Wait for the success banner (cold start + 20 steps ≈ 30–120 s)
            await expect(
                page.getByText('🎉 Demo Environment Ready!'),
            ).toBeVisible({ timeout: 180_000 });

            // Verify tenantId was stored
            const tenantId = await page.evaluate(() =>
                localStorage.getItem('qshelter_tenant_id'),
            );
            expect(tenantId).toBeTruthy();
            console.log('✅ Demo Bootstrap complete. tenantId:', tenantId);
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 2 — Emeka logs in and browses properties
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 2: Emeka logs in', async () => {
            await loginAs(page, EMAILS.emeka);
            console.log('✅ Logged in as Emeka');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 3 — Browse property → select variant/unit/payment method
        //           → start application
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 3: Browse property and start application', async () => {
            await page.goto('/properties');
            await expect(page.getByText('Sunrise Heights Estate')).toBeVisible({ timeout: 10_000 });

            // View property detail
            await page.getByRole('link', { name: 'View Details' }).first().click();
            await expect(page.getByText('Sunrise Heights Estate')).toBeVisible();

            // Select variant — "3-Bedroom Luxury Apartment"
            await page.getByText('3-Bedroom Luxury Apartment').first().click();

            // Wait for units section and select A-201
            await expect(page.getByText('Available Units')).toBeVisible({ timeout: 10_000 });
            await page.getByRole('button', { name: /A-201/ }).click();

            // Switch to Payment Options tab and select MREIF
            await page.getByRole('tab', { name: 'Payment Options' }).click();
            await expect(page.getByText('MREIF 10/90 Mortgage')).toBeVisible({ timeout: 10_000 });
            await page.getByText('MREIF 10/90 Mortgage').first().click();

            // Start application → Confirm dialog
            await page.getByRole('button', { name: 'Start Application' }).click();
            await expect(page.getByText('Confirm Application')).toBeVisible({ timeout: 5_000 });
            await page.getByRole('button', { name: /Confirm.*Start/i }).click();

            // Should redirect to the new application detail page
            await expect(page).toHaveURL(/\/applications\/[a-f0-9-]+/, { timeout: 30_000 });
            applicationId = page.url().split('/applications/')[1].split(/[?#]/)[0];
            console.log('✅ Application created:', applicationId);
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 4 — Prequalification: Emeka fills questionnaire
        //
        //   5 questions configured by demo-bootstrap:
        //     Q1  employment_status   SELECT    → "Employed"
        //     Q2  monthly_income      CURRENCY  → 2,500,000
        //     Q3  years_employed      NUMBER    → 5
        //     Q4  existing_mortgage   SELECT    → "No"
        //     Q5  property_purpose    SELECT    → "Primary Residence"
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 4: Emeka fills prequalification questionnaire', async () => {
            // Wait for the questionnaire form to render (button is "Submit Answers")
            await expect(
                page.getByRole('button', { name: /Submit Answers/i }),
            ).toBeVisible({ timeout: 30_000 });

            // Helper: select a shadcn <Select> option by clicking the combobox
            // near a label, then picking the option from the popover.
            async function pickSelect(labelText: RegExp, optionName: string) {
                // Find the field container that has the label text, then the combobox trigger inside it
                const container = page.locator('div.space-y-2').filter({ hasText: labelText });
                await container.getByRole('combobox').click();
                await page.getByRole('option', { name: optionName, exact: true }).click();
            }

            // Q1: Employment status (SELECT)
            await pickSelect(/employment status/i, 'Employed');

            // Q2: Monthly net income (CURRENCY — rendered as <input type="number">)
            await page.getByRole('spinbutton', { name: /monthly.*income/i }).fill('2500000');

            // Q3: Years at current employer (NUMBER — rendered as <input type="number">)
            await page.getByRole('spinbutton', { name: /years.*employer/i }).fill('5');

            // Q4: Existing mortgage (SELECT)
            await pickSelect(/existing mortgage/i, 'No');

            // Q5: Property purpose (SELECT)
            await pickSelect(/purpose.*property/i, 'Primary Residence');

            // Submit
            await page.getByRole('button', { name: /Submit Answers/i }).click();

            // Should transition to "under review" or similar
            await expect(
                page.getByText(/under review|submitted|awaiting/i).first(),
            ).toBeVisible({ timeout: 15_000 });
            console.log('✅ Questionnaire submitted');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 5 — Prequalification: Adaeze reviews & approves
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 5: Adaeze approves prequalification', async () => {
            await loginAs(page, EMAILS.adaeze);
            await page.goto(`/admin/applications/${applicationId}`);
            await expect(page.getByText('Admin Review')).toBeVisible({ timeout: 10_000 });

            // Click "Review Questionnaire" button
            await page.getByRole('button', { name: /Review Questionnaire/i }).click();
            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

            // Approve
            await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
            await page.waitForTimeout(5_000);
            console.log('✅ Questionnaire approved by Adaeze');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 6 — Sales Offer: Nneka (developer agent) uploads
        //           The DEVELOPER approval stage auto-approves the upload.
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 6: Nneka uploads sales offer letter', async () => {
            await loginAs(page, EMAILS.nneka);
            await page.goto(`/admin/applications/${applicationId}`);
            await expect(page.getByText('Admin Review')).toBeVisible({ timeout: 10_000 });

            // Wait for the partner document upload section to appear
            // (sales offer phase must be active)
            await pollUntilVisible(page, /Upload.*Document/i, {
                timeout: 30_000,
                interval: 3_000,
            });

            // Select the document type
            const docTypeSelect = page.getByRole('combobox').last();
            await docTypeSelect.click();
            await page.getByRole('option', { name: /Sales Offer/i }).click();

            // Upload the file
            await page.locator('input[type="file"]').last().setInputFiles(testPdf('sales-offer-letter'));

            // Click "Upload Document"
            await page.getByRole('button', { name: /Upload Document/i }).click();

            // Wait for upload to process (auto-approved by DEVELOPER stage)
            await page.waitForTimeout(5_000);
            console.log('✅ Sales offer uploaded by Nneka (auto-approved)');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 7 — Sales Offer: Emeka accepts the partner document
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 7: Emeka accepts sales offer', async () => {
            await loginAs(page, EMAILS.emeka);
            await page.goto(`/applications/${applicationId}`);

            // The phase may need a moment to transition to WAIT_FOR_ACCEPTANCE
            const acceptBtn = page.getByRole('button', { name: 'Accept' });
            const isAcceptVisible = await acceptBtn
                .first()
                .isVisible({ timeout: 15_000 })
                .catch(() => false);

            if (isAcceptVisible) {
                await acceptBtn.first().click();
                await page.waitForTimeout(3_000);
                console.log('✅ Sales offer accepted by Emeka');
            } else {
                // Phase may have auto-completed (some configs skip acceptance)
                console.log('ℹ️  No Accept button — sales offer phase auto-completed');
            }
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 8 — KYC Documentation: Emeka uploads customer docs
        //
        //   Required docs (from demo-bootstrap preapproval plan):
        //     1. Valid Government ID
        //     2. Bank Statement (6 months)
        //     3. Employment Confirmation Letter
        //     (PROOF_OF_ADDRESS waived by Access Bank)
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 8: Emeka uploads KYC documents', async () => {
            await page.goto(`/applications/${applicationId}`);

            // Wait for the document upload section to appear
            // (KYC phase must be active and showing upload controls)
            await pollUntilVisible(page, /Required Documents|Upload.*Government|Upload.*Bank/i, {
                timeout: 60_000,
                interval: 5_000,
            });

            // Upload to each visible file input
            const fileInputs = page.locator('input[type="file"]');
            const inputCount = await fileInputs.count();
            console.log(`Found ${inputCount} file input(s) for customer docs`);

            for (let i = 0; i < inputCount; i++) {
                await fileInputs.nth(i).setInputFiles(testPdf(`kyc-doc-${i + 1}`));
                // Wait for each upload to complete before the next
                await page.waitForTimeout(3_000);
            }

            // Wait for all uploads to settle
            await page.waitForTimeout(5_000);
            console.log('✅ Customer KYC documents uploaded');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 9 — KYC Documentation: Adaeze reviews & approves
        //           customer documents (Stage 1: PLATFORM)
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 9: Adaeze reviews and approves KYC documents', async () => {
            await loginAs(page, EMAILS.adaeze);
            await page.goto(`/admin/applications/${applicationId}`);
            await page.waitForTimeout(5_000);

            await approveAllDocuments(page);
            console.log('✅ KYC documents approved by Adaeze (PLATFORM stage)');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 10 — KYC Documentation: Eniola (bank) uploads preapproval
        //            letter. Auto-approved by BANK stage.
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 10: Eniola uploads bank preapproval letter', async () => {
            await loginAs(page, EMAILS.eniola);
            await page.goto(`/admin/applications/${applicationId}`);
            await expect(page.getByText('Admin Review')).toBeVisible({ timeout: 10_000 });

            // Wait for partner upload section (BANK stage should be active after
            // PLATFORM stage completes)
            await pollUntilVisible(page, /Upload.*Document/i, {
                timeout: 30_000,
                interval: 3_000,
            });

            // Select document type
            const docTypeSelect = page.getByRole('combobox').last();
            await docTypeSelect.click();
            await page.getByRole('option', { name: /Preapproval/i }).click();

            // Upload
            await page.locator('input[type="file"]').last().setInputFiles(testPdf('bank-preapproval'));
            await page.getByRole('button', { name: /Upload Document/i }).click();

            await page.waitForTimeout(5_000);
            console.log('✅ Bank preapproval letter uploaded by Eniola (auto-approved)');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 11 — KYC Documentation: Emeka accepts partner docs
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 11: Emeka accepts bank preapproval', async () => {
            await loginAs(page, EMAILS.emeka);
            await page.goto(`/applications/${applicationId}`);

            const acceptBtn = page.getByRole('button', { name: 'Accept' });
            const isAcceptVisible = await acceptBtn
                .first()
                .isVisible({ timeout: 15_000 })
                .catch(() => false);

            if (isAcceptVisible) {
                await acceptBtn.first().click();
                await page.waitForTimeout(3_000);
                console.log('✅ Bank preapproval accepted by Emeka');
            } else {
                console.log('ℹ️  No Accept button — KYC phase auto-completed');
            }
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 12 — 10% Downpayment: Emeka creates wallet & generates
        //            installment
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 12: Emeka creates wallet and generates installment', async () => {
            await page.goto(`/applications/${applicationId}`);

            // Wait for the payment phase to activate
            await pollUntilVisible(page, /Create Wallet|wallet|Payment/i, {
                timeout: 60_000,
                interval: 5_000,
            });

            // Create wallet (if button is visible)
            const createWalletBtn = page.getByRole('button', { name: /Create Wallet/i });
            if (await createWalletBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
                await createWalletBtn.click();
                await page.waitForTimeout(3_000);
            }

            // Generate installments (if button is visible)
            const generateBtn = page.getByRole('button', { name: /Generate Installments/i });
            if (await generateBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
                await generateBtn.click();
                await page.waitForTimeout(3_000);
            }

            console.log('✅ Wallet created & installment generated');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 13 — 10% Downpayment: Adaeze credits Emeka's wallet
        //            ₦7,500,000 (10% of ₦75M)
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 13: Adaeze credits wallet ₦7,500,000', async () => {
            await loginAs(page, EMAILS.adaeze);
            await page.goto(`/admin/applications/${applicationId}`);
            await page.waitForTimeout(5_000);

            // Click "Credit Wallet"
            await page.getByRole('button', { name: /Credit Wallet/i }).click();
            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

            // Fill amount
            await page.getByRole('dialog').getByLabel(/Amount/i).fill('7500000');

            // Fill description (optional)
            const descInput = page.getByRole('dialog').getByLabel(/Description/i);
            if (await descInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await descInput.fill('Admin credit for 10% downpayment');
            }

            // Submit — button text includes formatted amount, e.g. "Credit ₦7,500,000"
            await page
                .getByRole('dialog')
                .getByRole('button', { name: /^Credit/i })
                .click();

            await page.waitForTimeout(5_000);
            console.log('✅ Wallet credited ₦7,500,000 by Adaeze');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 14 — 10% Downpayment: Emeka pays the installment
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 14: Emeka pays downpayment installment', async () => {
            await loginAs(page, EMAILS.emeka);
            await page.goto(`/applications/${applicationId}`);
            await page.waitForTimeout(5_000);

            // Click "Pay Now" on the first (and only) pending installment
            await page.getByRole('button', { name: /Pay Now/i }).first().click();
            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

            // Confirm payment — "Fund Wallet & Pay" or similar
            await page
                .getByRole('dialog')
                .getByRole('button', { name: /Fund Wallet.*Pay|Pay|Confirm/i })
                .click();

            // Payment processing is event-driven — wait for it to settle
            await page.waitForTimeout(10_000);
            console.log('✅ Downpayment of ₦7,500,000 paid by Emeka');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 15 — Mortgage Offer: Eniola uploads mortgage offer letter
        //            Auto-approved by BANK approval stage.
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 15: Eniola uploads mortgage offer letter', async () => {
            await loginAs(page, EMAILS.eniola);
            await page.goto(`/admin/applications/${applicationId}`);

            // Wait for the mortgage offer phase to be active
            await pollUntilVisible(page, /Upload.*Document/i, {
                timeout: 60_000,
                interval: 5_000,
            });

            // Select document type
            const docTypeSelect = page.getByRole('combobox').last();
            await docTypeSelect.click();
            await page.getByRole('option', { name: /Mortgage Offer/i }).click();

            // Upload
            await page.locator('input[type="file"]').last().setInputFiles(testPdf('mortgage-offer-letter'));
            await page.getByRole('button', { name: /Upload Document/i }).click();

            await page.waitForTimeout(5_000);
            console.log('✅ Mortgage offer letter uploaded by Eniola (auto-approved)');
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 16 — Mortgage Offer: Emeka accepts
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 16: Emeka accepts mortgage offer', async () => {
            await loginAs(page, EMAILS.emeka);
            await page.goto(`/applications/${applicationId}`);

            const acceptBtn = page.getByRole('button', { name: 'Accept' });
            const isAcceptVisible = await acceptBtn
                .first()
                .isVisible({ timeout: 15_000 })
                .catch(() => false);

            if (isAcceptVisible) {
                await acceptBtn.first().click();
                await page.waitForTimeout(3_000);
                console.log('✅ Mortgage offer accepted by Emeka');
            } else {
                console.log('ℹ️  No Accept button — mortgage offer phase auto-completed');
            }
        });

        // ═════════════════════════════════════════════════════════════════
        // PHASE 17 — Verify application is COMPLETED
        // ═════════════════════════════════════════════════════════════════
        await test.step('Phase 17: Verify application COMPLETED', async () => {
            await page.goto(`/applications/${applicationId}`);

            // The status badge should show "COMPLETED" once all 5 phases are done.
            // Event-driven transitions may need a moment to propagate.
            await pollUntilVisible(page, /COMPLETED/i, {
                timeout: 60_000,
                interval: 5_000,
            });

            console.log('🎉 Application COMPLETED:', applicationId);
        });
    });
});

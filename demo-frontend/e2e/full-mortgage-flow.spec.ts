import { test, expect, Page } from '@playwright/test';

/**
 * Full Mortgage Flow — Playwright E2E Test
 *
 * Exercises the COMPLETE platform lifecycle through the demo-frontend UI,
 * from tenant bootstrap all the way to a completed mortgage application:
 *
 *   SETUP (via UI):
 *     Reset DB → Bootstrap tenant → Invite staff → Create orgs →
 *     Complete onboarding → Create property → Configure plans →
 *     Create payment method → Set up qualification flows →
 *     Enroll & qualify orgs → Add document waivers → Link to property
 *
 *   APPLICATION FLOW (via UI):
 *     Register Emeka → Browse property → Start application →
 *     Questionnaire → Sales offer → KYC docs → Downpayment →
 *     Mortgage offer → COMPLETED
 *
 * This test does NOT call the demo-bootstrap API. Every setup step is performed
 * through the UI, exactly as an admin user would do it manually.
 *
 * NOTE FOR COPILOT: Never replace this test's UI-driven setup with API calls
 * or the demo-bootstrap endpoint. The purpose of this test is to exercise
 * the admin UI for all entity creation flows, not just the application flow.
 *
 * Actors (all share password "password"):
 *   Adaeze  (admin)        – platform admin, creates everything
 *   Yinka   (mortgage_ops) – platform mortgage ops
 *   Nneka   (agent)        – Lekki Gardens developer agent
 *   Eniola  (mortgage_ops) – Access Bank loan officer
 *   Emeka   (customer)     – first-time homebuyer
 *
 * Property:
 *   Sunrise Heights Estate → 3-Bedroom Luxury Apartment → Unit A-201 → ₦75M
 *   Payment method: MREIF 10/90 Mortgage (5 phases, 10% down)
 */

// ─── Config ─────────────────────────────────────────────────────────────────

const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET || '';
const USER_SERVICE_URL = process.env.NEXT_PUBLIC_USER_SERVICE_URL || 'https://1oi4sd5b4i.execute-api.us-east-1.amazonaws.com';
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
async function loginAs(
    page: Page,
    email: string,
    { timeout = 60_000, interval = 5_000 } = {},
) {
    const tenantId = await page.evaluate(() =>
        localStorage.getItem('qshelter_tenant_id'),
    );

    const deadline = Date.now() + timeout;
    let attempt = 0;

    while (Date.now() < deadline) {
        attempt++;
        await page.context().clearCookies();
        await page.goto('/login');

        if (tenantId) {
            await page.evaluate(
                (tid) => localStorage.setItem('qshelter_tenant_id', tid),
                tenantId,
            );
        }

        await page.locator('input[type="email"]').fill(email);
        await page.locator('input[type="password"]').fill(PASSWORD);
        await page.locator('button[type="submit"]').click();

        // Check if login succeeded (redirected to dashboard/admin)
        const succeeded = await page
            .waitForURL(/\/(dashboard|admin)/, { timeout: 15_000 })
            .then(() => true)
            .catch(() => false);

        if (succeeded) return;

        console.log(
            `[loginAs] Attempt ${attempt} failed for ${email}, polling again in ${interval / 1000}s...`,
        );
        await page.waitForTimeout(interval);
    }

    // Final attempt — let it throw with a clear error
    throw new Error(
        `Login failed for ${email} after ${attempt} attempts over ${timeout / 1000}s (policy-sync may still be propagating)`,
    );
}

/**
 * Reload the page in a loop until `textOrRegex` becomes visible.
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
    await expect(page.getByText(textOrRegex).first()).toBeVisible();
}

/**
 * Approve all documents that have a "Review" button on the admin application page.
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
        await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
        await page.waitForTimeout(2_000);
    }
}

/**
 * Pick an option from a shadcn Select combobox by finding the container
 * with the given label text and clicking the combobox inside it.
 * @param page     Page object (options portal to <body>, so we always search from page root)
 * @param scope    A page or locator to search within (e.g. dialog locator)
 * @param labelText  Regex matching the label text
 * @param optionName  Option text to click in the dropdown
 */
async function pickSelect(
    page: Page,
    scope: Page | import('@playwright/test').Locator,
    labelText: RegExp,
    optionName: string | RegExp,
) {
    // Find the <label> matching text, go up to parent container, find combobox
    const container = scope.locator('label').filter({ hasText: labelText }).locator('..');
    await container.getByRole('combobox').click();
    await page.getByRole('option', { name: optionName, exact: true }).click();
}

/**
 * Send an invitation via the UI and capture the invitation token from
 * the API response, then accept it via the /invitations/accept page.
 *
 * This mirrors what a real user would do: receive the email, click the
 * link, and set their password.
 *
 * @param page       Playwright page (logged in as admin)
 * @param dialog     The open invite dialog locator
 * @param formFill   Callback that fills out the invite form fields
 * @param password   Password for the new account
 * @returns          The invitation token (for debugging)
 */
async function sendInviteAndAccept(
    page: Page,
    dialog: import('@playwright/test').Locator,
    formFill: () => Promise<void>,
    password: string,
) {
    // Fill the invitation form
    await formFill();

    // Listen for the invitation POST response to capture the token
    const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/invitations') && resp.request().method() === 'POST' && resp.status() < 400,
        { timeout: 15_000 },
    );

    await dialog.getByRole('button', { name: 'Send Invitation' }).click();

    const response = await responsePromise;
    const body = await response.json();
    // Backend returns { success: true, data: { token: '...', ... } }
    const token = body.data?.token;
    if (!token) {
        throw new Error(`Invitation response missing token: ${JSON.stringify(body).slice(0, 200)}`);
    }
    console.log(`[Invite] Captured invitation token: ${token.slice(0, 8)}…`);

    // Wait for toast / UI to settle
    await page.waitForTimeout(2_000);

    // Now accept the invitation as the invitee: clear admin cookies and go to accept page
    await page.context().clearCookies();
    await page.goto(`/invitations/accept?token=${token}`);

    // Wait for the accept page to load and show the form
    await expect(page.getByRole('button', { name: /Accept Invitation/i })).toBeVisible({ timeout: 15_000 });

    // Fill password and confirm
    await page.getByLabel('Create Password').fill(password);
    await page.getByLabel('Confirm Password').fill(password);

    await page.getByRole('button', { name: /Accept Invitation/i }).click();

    // After accepting, user is auto-logged-in and redirected to dashboard
    await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 15_000 });

    return token;
}

// ─── Test ───────────────────────────────────────────────────────────────────

test.describe('Full Mortgage Flow — MREIF 10/90', () => {
    // Setup + 5 application phases with persona switches = long test
    test.setTimeout(1_800_000); // 30 minutes

    test('Full platform setup + Emeka applies for Sunrise Heights A-201', async ({ page }) => {
        test.skip(!BOOTSTRAP_SECRET, 'Set BOOTSTRAP_SECRET env var to run this test');

        // Forward page console to Node for debugging (filter noise)
        page.on('console', (msg) => {
            const text = msg.text();
            // Skip noisy React DevTools, HMR, Fast Refresh and long stack traces
            if (text.includes('React DevTools') || text.includes('[HMR]')) return;
            if (text.includes('Fast Refresh')) return;
            if (text.includes('at ') && text.includes('.js:')) return; // stack trace lines
            console.log(`[PAGE ${msg.type()}]`, text);
        });

        let applicationId: string;

        // ╔═══════════════════════════════════════════════════════════════╗
        // ║               PART A — ENVIRONMENT SETUP                     ║
        // ║   Reset DB, bootstrap tenant, create all entities via UI     ║
        // ╚═══════════════════════════════════════════════════════════════╝

        // ═══════════════════════════════════════════════════════════════
        // STEP 1 — Reset database + Bootstrap tenant via UI
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 1: Reset DB and bootstrap tenant', async () => {
            await page.goto('/');

            // Reset database via the UI dialog
            await page.getByRole('button', { name: /Reset Database/i }).click();
            await page.locator('#resetSecret').fill(BOOTSTRAP_SECRET);
            await page.locator('#confirmReset').fill('RESET');
            await page.getByRole('button', { name: /Reset Everything/i }).click();

            await expect(page.getByText(/reset.*success|database.*reset/i).first())
                .toBeVisible({ timeout: 30_000 });
            console.log('[Step 1] Database reset');

            await page.keyboard.press('Escape');
            await page.waitForTimeout(1_000);

            // Bootstrap tenant via the UI dialog
            await page.getByRole('button', { name: /Bootstrap Project/i }).click();

            const dialog = page.getByRole('dialog');
            await dialog.getByLabel(/Bootstrap Secret/i).fill(BOOTSTRAP_SECRET);
            await dialog.getByLabel(/Admin Password/i).fill(PASSWORD);

            await dialog.getByRole('button', { name: 'Bootstrap' }).click();

            await expect(page.getByText(/Bootstrap Successful/i).first())
                .toBeVisible({ timeout: 60_000 });

            // Extract tenantId from the success card text "Tenant: Name (id)"
            // The component should also store it in localStorage, but we extract
            // from the visible text for robustness.
            const tenantText = await dialog.locator('dd').first().textContent();
            const tenantIdMatch = tenantText?.match(/\(([^)]+)\)/);
            let tenantId = tenantIdMatch?.[1] ?? null;

            // Fallback: check localStorage in case component stored it
            if (!tenantId) {
                tenantId = await page.evaluate(() =>
                    localStorage.getItem('qshelter_tenant_id'),
                );
            }

            expect(tenantId).toBeTruthy();

            // Ensure localStorage has the tenantId for later steps
            await page.evaluate(
                (tid) => localStorage.setItem('qshelter_tenant_id', tid),
                tenantId!,
            );

            console.log('[Step 1] Tenant bootstrapped. tenantId:', tenantId);

            await page.keyboard.press('Escape');
            // No artificial wait needed — the bootstrap worker now polls DynamoDB
            // for policy sync before marking the job as COMPLETED.
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 2 — Adaeze logs in
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 2: Adaeze logs in as admin', async () => {
            await loginAs(page, EMAILS.adaeze);
            console.log('[Step 2] Logged in as Adaeze (admin)');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 3 — Invite Yinka to Platform org + register
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 3: Invite Yinka to platform org', async () => {
            await page.goto('/admin/organizations');
            await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible({ timeout: 10_000 });

            const platformRow = page.getByRole('row').filter({ hasText: /QShelter Demo/i });
            await platformRow.getByRole('button', { name: 'Invite' }).click();

            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });

            await sendInviteAndAccept(page, dialog, async () => {
                await dialog.getByLabel(/Email/i).fill(EMAILS.yinka);
                await dialog.getByLabel(/First Name/i).fill('Yinka');
                await dialog.getByLabel(/Last Name/i).fill('Adewale');
                await pickSelect(page, dialog, /Role/i, /mortgage_ops/i);
                await dialog.getByLabel(/Job Title/i).fill('Mortgage Operations Manager');
                await dialog.getByLabel(/Department/i).fill('Mortgage Operations');
            }, PASSWORD);
            console.log('[Step 3] Yinka invited and accepted');

            await loginAs(page, EMAILS.adaeze);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 4 — Create Lekki Gardens org (DEVELOPER) + invite Nneka
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 4: Create Lekki Gardens + invite Nneka', async () => {
            await page.goto('/admin/organizations');
            await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible({ timeout: 10_000 });

            await page.getByRole('button', { name: 'Create Organization' }).click();
            let dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });

            await dialog.getByLabel(/Organization Name/i).fill('Lekki Gardens Development Company');
            await dialog.locator('#type-DEVELOPER').check();
            await dialog.getByLabel(/Email/i).fill('lekkigardens@mailsac.com');
            await dialog.getByLabel(/Phone/i).fill('+2348012345678');
            await dialog.getByLabel(/Address/i).fill('15 Admiralty Way, Lekki, Lagos');

            await dialog.getByRole('button', { name: 'Create Organization' }).click();
            await page.waitForTimeout(3_000);
            console.log('[Step 4] Lekki Gardens org created');

            // Invite Nneka
            await page.goto('/admin/organizations');
            await page.waitForTimeout(2_000);

            const devRow = page.getByRole('row').filter({ hasText: /Lekki Gardens/i });
            await devRow.getByRole('button', { name: 'Invite' }).click();
            dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });

            await sendInviteAndAccept(page, dialog, async () => {
                await dialog.getByLabel(/Email/i).fill(EMAILS.nneka);
                await dialog.getByLabel(/First Name/i).fill('Nneka');
                await dialog.getByLabel(/Last Name/i).fill('Obi');
                await pickSelect(page, dialog, /Role/i, /agent/i);
                await dialog.getByLabel(/Job Title/i).fill('Development Manager');
                await dialog.getByLabel(/Department/i).fill('Development');
            }, PASSWORD);
            console.log('[Step 4] Nneka invited and accepted');

            await loginAs(page, EMAILS.adaeze);

            // Also add Adaeze as staff of Lekki Gardens (DEVELOPER org)
            // so she can create properties (API requires DEVELOPER org membership)
            await page.goto('/admin/organizations');
            await page.waitForTimeout(2_000);

            const lekkiRow2 = page.getByRole('row').filter({ hasText: /Lekki Gardens/i });
            await lekkiRow2.getByRole('button', { name: 'Add Staff' }).click();
            const addStaffDialog = page.getByRole('dialog');
            await expect(addStaffDialog).toBeVisible({ timeout: 5_000 });

            await pickSelect(page, addStaffDialog, /Select User/i, /adaeze/i);
            await addStaffDialog.getByRole('button', { name: 'Add Member' }).click();
            await page.waitForTimeout(3_000);
            console.log('[Step 4] Adaeze added to Lekki Gardens as staff');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 5 — Complete Lekki Gardens onboarding
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 5: Complete Lekki Gardens onboarding', async () => {
            await page.goto('/admin/organizations');
            await page.waitForTimeout(2_000);

            const devRow = page.getByRole('row').filter({ hasText: /Lekki Gardens/i });
            await devRow.getByRole('link').first().click();
            await page.waitForTimeout(2_000);

            // Create onboarding if needed
            const createBtn = page.getByRole('button', { name: 'Create Onboarding' });
            if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
                await createBtn.click();
                await page.waitForTimeout(3_000);
            }

            // Assign Nneka as onboarder if needed
            const assignBtn = page.getByRole('button', { name: /Assign Staff|Assign/i });
            if (await assignBtn.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
                await assignBtn.first().click();
                const assignDialog = page.getByRole('dialog');
                await expect(assignDialog).toBeVisible({ timeout: 5_000 });
                await assignDialog.getByRole('combobox').click();
                await page.getByRole('option', { name: /Nneka/i }).click();
                await assignDialog.getByRole('button', { name: /^Assign$/i }).click();
                await page.waitForTimeout(3_000);
            }

            // Start onboarding
            const startBtn = page.getByRole('button', { name: 'Start Onboarding' });
            if (await startBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
                await startBtn.click();
                await page.waitForTimeout(3_000);
            }

            // Complete questionnaire phases if any
            const submitAnswers = page.getByRole('button', { name: /Submit Answers/i });
            if (await submitAnswers.isVisible({ timeout: 5_000 }).catch(() => false)) {
                // Fill all visible text/number inputs (shadcn Input renders without explicit type)
                const allInputs = page.locator('input:visible').filter({ hasNot: page.locator('[role="combobox"]') });
                const inputCount = await allInputs.count();
                for (let i = 0; i < inputCount; i++) {
                    const input = allInputs.nth(i);
                    const inputType = await input.getAttribute('type');
                    const value = await input.inputValue();
                    if (!value) {
                        if (inputType === 'number') {
                            await input.fill('100');
                        } else {
                            await input.fill('Sample Value');
                        }
                    }
                }
                // Fill all visible textareas
                const textareas = page.locator('textarea:visible');
                const taCount = await textareas.count();
                for (let i = 0; i < taCount; i++) {
                    const ta = textareas.nth(i);
                    const value = await ta.inputValue();
                    if (!value) await ta.fill('Sample answer text');
                }
                // Handle shadcn Select triggers (BOOLEAN/SELECT fields)
                const selectTriggers = page.locator('[role="combobox"]:visible');
                const selCount = await selectTriggers.count();
                for (let i = 0; i < selCount; i++) {
                    const trigger = selectTriggers.nth(i);
                    // Only interact if no value selected yet (placeholder still showing)
                    const text = await trigger.textContent();
                    if (text?.includes('Select')) {
                        await trigger.click();
                        const option = page.getByRole('option').first();
                        if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
                            await option.click();
                        }
                    }
                }
                await submitAnswers.click();
                await page.waitForTimeout(3_000);
            }

            // Upload documents for documentation phase (auto-approved on upload)
            await page.reload();
            await page.waitForTimeout(3_000);

            // Collect all doc types to upload before we start (inputs disappear after upload)
            const docFileInputs = page.locator('input[type="file"][data-doc-type]');
            const docInputCount = await docFileInputs.count();
            const docTypes: string[] = [];
            for (let i = 0; i < docInputCount; i++) {
                const dt = await docFileInputs.nth(i).getAttribute('data-doc-type');
                if (dt) docTypes.push(dt);
            }
            console.log(`  Found ${docTypes.length} documents to upload: ${docTypes.join(', ')}`);

            for (const docType of docTypes) {
                const fileInput = page.locator(`input[type="file"][data-doc-type="${docType}"]`);
                if (await fileInput.count() > 0) {
                    await fileInput.setInputFiles(testPdf(`onboarding-${docType}`));
                    await page.waitForTimeout(3_000);
                    console.log(`  Uploaded onboarding document: ${docType}`);
                }
            }

            // Reload to see gate phase (documentation auto-completed after all uploads)
            await page.reload();
            await page.waitForTimeout(3_000);

            // Approve gate phase if visible
            const submitReview = page.getByRole('button', { name: 'Submit Review' });
            if (await submitReview.isVisible({ timeout: 5_000 }).catch(() => false)) {
                await submitReview.click();
                const gateDialog = page.getByRole('dialog');
                await expect(gateDialog).toBeVisible({ timeout: 5_000 });
                // Decision defaults to "Approve" — just click Submit APPROVED
                await gateDialog.getByRole('button', { name: /Submit APPROVED/i }).click();
                await page.waitForTimeout(3_000);
            }

            await page.reload();
            await page.waitForTimeout(2_000);
            console.log('[Step 5] Lekki Gardens onboarding completed');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 6 — Create Access Bank org (BANK) + invite Eniola
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 6: Create Access Bank + invite Eniola', async () => {
            await page.goto('/admin/organizations');
            await page.waitForTimeout(2_000);

            await page.getByRole('button', { name: 'Create Organization' }).click();
            let dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });

            await dialog.getByLabel(/Organization Name/i).fill('Access Bank PLC');
            await dialog.locator('#type-BANK').check();
            await dialog.getByLabel(/Email/i).fill('mortgages@mailsac.com');
            await dialog.getByLabel(/Phone/i).fill('+2341234567890');
            await dialog.getByLabel(/Address/i).fill('999C Danmole Street, Victoria Island, Lagos');

            await dialog.getByRole('button', { name: 'Create Organization' }).click();
            await page.waitForTimeout(3_000);
            console.log('[Step 6] Access Bank org created');

            // Invite Eniola
            await page.goto('/admin/organizations');
            await page.waitForTimeout(2_000);

            const bankRow = page.getByRole('row').filter({ hasText: /Access Bank/i });
            await bankRow.getByRole('button', { name: 'Invite' }).click();
            dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });

            await sendInviteAndAccept(page, dialog, async () => {
                await dialog.getByLabel(/Email/i).fill(EMAILS.eniola);
                await dialog.getByLabel(/First Name/i).fill('Eniola');
                await dialog.getByLabel(/Last Name/i).fill('Adeyemi');
                await pickSelect(page, dialog, /Role/i, /mortgage_ops/i);
                await dialog.getByLabel(/Job Title/i).fill('Mortgage Operations Officer');
                await dialog.getByLabel(/Department/i).fill('Mortgage Lending');
            }, PASSWORD);
            console.log('[Step 6] Eniola invited and accepted');

            await loginAs(page, EMAILS.adaeze);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 7 — Complete Access Bank onboarding
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 7: Complete Access Bank onboarding', async () => {
            await page.goto('/admin/organizations');
            await page.waitForTimeout(2_000);

            const bankRow = page.getByRole('row').filter({ hasText: /Access Bank/i });
            await bankRow.getByRole('link').first().click();
            await page.waitForTimeout(2_000);

            const createBtn = page.getByRole('button', { name: 'Create Onboarding' });
            if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
                await createBtn.click();
                await page.waitForTimeout(3_000);
            }

            const assignBtn = page.getByRole('button', { name: /Assign Staff|Assign/i });
            if (await assignBtn.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
                await assignBtn.first().click();
                const assignDialog = page.getByRole('dialog');
                await expect(assignDialog).toBeVisible({ timeout: 5_000 });
                await assignDialog.getByRole('combobox').click();
                await page.getByRole('option', { name: /Eniola/i }).click();
                await assignDialog.getByRole('button', { name: /^Assign$/i }).click();
                await page.waitForTimeout(3_000);
            }

            const startBtn = page.getByRole('button', { name: 'Start Onboarding' });
            if (await startBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
                await startBtn.click();
                await page.waitForTimeout(3_000);
            }

            const submitAnswers = page.getByRole('button', { name: /Submit Answers/i });
            if (await submitAnswers.isVisible({ timeout: 5_000 }).catch(() => false)) {
                // Fill all visible text/number inputs (shadcn Input renders without explicit type)
                const allInputs = page.locator('input:visible').filter({ hasNot: page.locator('[role="combobox"]') });
                const inputCount = await allInputs.count();
                for (let i = 0; i < inputCount; i++) {
                    const input = allInputs.nth(i);
                    const inputType = await input.getAttribute('type');
                    const value = await input.inputValue();
                    if (!value) {
                        if (inputType === 'number') {
                            await input.fill('100');
                        } else {
                            await input.fill('Sample Value');
                        }
                    }
                }
                // Fill all visible textareas
                const textareas = page.locator('textarea:visible');
                const taCount = await textareas.count();
                for (let i = 0; i < taCount; i++) {
                    const ta = textareas.nth(i);
                    const value = await ta.inputValue();
                    if (!value) await ta.fill('Sample answer text');
                }
                // Handle shadcn Select triggers (BOOLEAN/SELECT fields)
                const selectTriggers = page.locator('[role="combobox"]:visible');
                const selCount = await selectTriggers.count();
                for (let i = 0; i < selCount; i++) {
                    const trigger = selectTriggers.nth(i);
                    const text = await trigger.textContent();
                    if (text?.includes('Select')) {
                        await trigger.click();
                        const option = page.getByRole('option').first();
                        if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
                            await option.click();
                        }
                    }
                }
                await submitAnswers.click();
                await page.waitForTimeout(3_000);
            }

            // Upload documents for documentation phase (auto-approved on upload)
            await page.reload();
            await page.waitForTimeout(3_000);

            const bankDocInputs = page.locator('input[type="file"][data-doc-type]');
            const bankDocInputCount = await bankDocInputs.count();
            const bankDocTypes: string[] = [];
            for (let i = 0; i < bankDocInputCount; i++) {
                const dt = await bankDocInputs.nth(i).getAttribute('data-doc-type');
                if (dt) bankDocTypes.push(dt);
            }
            console.log(`  Found ${bankDocTypes.length} bank documents to upload: ${bankDocTypes.join(', ')}`);

            for (const docType of bankDocTypes) {
                const fileInput = page.locator(`input[type="file"][data-doc-type="${docType}"]`);
                if (await fileInput.count() > 0) {
                    await fileInput.setInputFiles(testPdf(`bank-onboarding-${docType}`));
                    await page.waitForTimeout(3_000);
                    console.log(`  Uploaded bank onboarding document: ${docType}`);
                }
            }

            // Reload to see gate phase (documentation auto-completed after all uploads)
            await page.reload();
            await page.waitForTimeout(3_000);

            const submitReview = page.getByRole('button', { name: 'Submit Review' });
            if (await submitReview.isVisible({ timeout: 5_000 }).catch(() => false)) {
                await submitReview.click();
                const gateDialog = page.getByRole('dialog');
                await expect(gateDialog).toBeVisible({ timeout: 5_000 });
                // Decision defaults to "Approve" — just click Submit APPROVED
                await gateDialog.getByRole('button', { name: /Submit APPROVED/i }).click();
                await page.waitForTimeout(3_000);
            }

            await page.reload();
            await page.waitForTimeout(2_000);
            console.log('[Step 7] Access Bank onboarding completed');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 8 — Create Sunrise Heights property + variant + unit
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 8: Create Sunrise Heights property', async () => {
            // Adaeze was added to Lekki Gardens (DEVELOPER) in Step 4,
            // so she has DEVELOPER org membership for the API check.
            await page.goto('/admin/properties/new');
            await page.waitForTimeout(2_000);

            // Step 1: Property Details
            // Category defaults to "For Sale" (SALE), Property Type to "Apartment" (APARTMENT),
            // Country to "Nigeria", Currency to "NGN" — all correct for our scenario.
            await page.getByLabel(/Title/i).fill('Sunrise Heights Estate');
            await page.getByLabel(/Description/i).first().fill(
                'Premium residential estate in Lekki Phase 1, Lagos.',
            );
            // Explicitly fill country (even though it defaults to Nigeria)
            await page.locator('#country').fill('Nigeria');
            await page.locator('#city').fill('Lagos');
            await page.locator('#district').fill('Lekki Phase 1');
            // Lat/lng required by API validation (Lekki Phase 1 coordinates)
            await page.locator('#latitude').fill('6.4541');
            await page.locator('#longitude').fill('3.3947');

            // Validate details step by clicking "Continue to Media"
            await page.getByRole('button', { name: /Continue to Media/i }).click();
            await page.waitForTimeout(500);

            // Skip Media (requires image upload) — jump to Review via step button
            await page.getByRole('button', { name: /Review & Publish/i }).click();
            await page.waitForTimeout(1_000);

            // Review & Publish
            await page.getByLabel(/Publish Immediately/i).check();

            // Intercept the create property API response
            const createPropRespPromise = page.waitForResponse(
                (resp) => resp.url().includes('/properties') && resp.request().method() === 'POST',
                { timeout: 30_000 },
            );
            await page.getByRole('button', { name: /Create Property/i }).click();
            const propResp = await createPropRespPromise;
            const propStatus = propResp.status();
            console.log(`[Step 8] Create property API: ${propStatus}`);
            if (propStatus >= 400) {
                const body = await propResp.text();
                console.log(`[Step 8] ERROR creating property: ${body}`);
                throw new Error(`Property creation API returned ${propStatus}: ${body}`);
            }

            // Wait for redirect to properties list (handleSubmit does router.push)
            await page.waitForURL('**/admin/properties', { timeout: 15_000 });
            console.log('[Step 8] Property created');

            // Wait for properties list to load and show our property
            await expect(page.getByText('Sunrise Heights Estate').first()).toBeVisible({ timeout: 15_000 });

            // Expand the property accordion
            await page.getByText('Sunrise Heights Estate').first().click();
            await page.waitForTimeout(1_000);

            // Add variant
            await page.getByRole('button', { name: 'Add Variant' }).click();
            const variantDialog = page.getByRole('dialog');
            await expect(variantDialog).toBeVisible({ timeout: 5_000 });

            await variantDialog.locator('#variantName').fill('3-Bedroom Luxury Apartment');
            await variantDialog.locator('#nBedrooms').fill('3');
            await variantDialog.locator('#nBathrooms').fill('3');
            await variantDialog.locator('#nParkingSpots').fill('1');
            await variantDialog.locator('#area').fill('180');
            await variantDialog.locator('#price').fill('75000000');
            await variantDialog.locator('#totalUnits').fill('24');

            await variantDialog.getByRole('button', { name: 'Create Variant' }).click();
            await page.waitForTimeout(3_000);
            console.log('[Step 8] Variant created');

            // Add unit (button is on the variant card, not behind "Show Units")
            await page.getByRole('button', { name: 'Add Unit' }).click();
            const unitDialog = page.getByRole('dialog');
            await expect(unitDialog).toBeVisible({ timeout: 5_000 });

            await unitDialog.locator('#unitNumber').fill('A-201');
            await unitDialog.locator('#floorNumber').fill('2');
            await unitDialog.locator('#blockName').fill('Block A');

            await unitDialog.getByRole('button', { name: 'Create Unit' }).click();
            await page.waitForTimeout(3_000);
            console.log('[Step 8] Unit A-201 created');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 9 — Create questionnaire plan
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 9: Create questionnaire plan', async () => {
            await page.goto('/admin/questionnaire-plans');
            await page.waitForTimeout(2_000);

            await page.getByRole('button', { name: 'Create Questionnaire Plan' }).click();
            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });

            await dialog.locator('#name').fill('MREIF Prequalification');

            // Add 5 questions — SELECT questions need options added
            const questions: Array<{
                key: string; text: string; type: string;
                options?: Array<{ value: string; label: string; score?: number }>;
            }> = [
                {
                    key: 'employment_status', text: 'What is your employment status?', type: 'Single Select',
                    options: [
                        { value: 'EMPLOYED', label: 'Employed', score: 100 },
                        { value: 'SELF_EMPLOYED', label: 'Self-Employed', score: 100 },
                        { value: 'RETIRED', label: 'Retired', score: 50 },
                        { value: 'UNEMPLOYED', label: 'Unemployed', score: 0 },
                    ],
                },
                { key: 'monthly_income', text: 'What is your monthly net income?', type: 'Currency' },
                { key: 'years_employed', text: 'How many years at your current employer?', type: 'Number' },
                {
                    key: 'existing_mortgage', text: 'Do you have an existing mortgage?', type: 'Single Select',
                    options: [
                        { value: 'YES', label: 'Yes', score: 0 },
                        { value: 'NO', label: 'No', score: 100 },
                    ],
                },
                {
                    key: 'property_purpose', text: 'What is the purpose of this property?', type: 'Single Select',
                    options: [
                        { value: 'PRIMARY_RESIDENCE', label: 'Primary Residence', score: 100 },
                        { value: 'INVESTMENT', label: 'Investment', score: 80 },
                        { value: 'SECOND_HOME', label: 'Second Home', score: 60 },
                    ],
                },
            ];

            for (const q of questions) {
                await dialog.getByRole('button', { name: 'Add Question' }).click();
                await page.waitForTimeout(500);

                const qCards = dialog.locator('.border.rounded-lg, [class*="card"]').filter({ hasText: /Question Key/i });
                const lastQ = qCards.last();
                await lastQ.getByPlaceholder(/applicant_age/i).first().fill(q.key);
                await lastQ.getByPlaceholder(/What is your age/i).first().fill(q.text);
                await lastQ.locator('button[role="combobox"]').first().click();
                await page.getByRole('option', { name: q.type, exact: true }).click();

                // For SELECT questions, the card is already expanded after Add Question
                // So we can directly add options
                if (q.options && q.options.length > 0) {
                    for (const opt of q.options) {
                        await lastQ.getByRole('button', { name: 'Add Option' }).click();
                        await page.waitForTimeout(300);
                        // Fill in the last option row (VALUE, Display Label, Score)
                        const optionRows = lastQ.locator('.flex.items-center.gap-2').filter({ has: page.locator('input[placeholder="VALUE"]') });
                        const lastRow = optionRows.last();
                        await lastRow.locator('input[placeholder="VALUE"]').fill(opt.value);
                        await lastRow.locator('input[placeholder="Display Label"]').fill(opt.label);
                        if (opt.score !== undefined) {
                            await lastRow.locator('input[placeholder="Score"]').clear();
                            await lastRow.locator('input[placeholder="Score"]').fill(String(opt.score));
                        }
                    }
                }
            }

            await dialog.getByRole('button', { name: 'Create Plan' }).click();
            await expect(dialog).toBeHidden({ timeout: 15_000 });
            await page.waitForTimeout(1_000);
            console.log('[Step 9] Questionnaire plan created');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 10 — Create 3 documentation plans
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 10: Create documentation plans', async () => {
            await page.goto('/admin/documentation-plans');
            await page.waitForTimeout(2_000);

            // --- Plan 1: Sales Offer Documentation ---
            await page.getByRole('button', { name: 'Create Documentation Plan' }).click();
            let dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.locator('#name').fill('Sales Offer Documentation');

            await dialog.getByRole('button', { name: 'Add Document' }).click();
            await page.waitForTimeout(500);
            let lastDoc = dialog.locator('.border.rounded-lg, [class*="card"]').filter({ hasText: /Document Type/i }).last();
            await lastDoc.getByPlaceholder(/ID_CARD/i).first().fill('SALES_OFFER_LETTER');
            await lastDoc.getByPlaceholder(/Valid ID Card/i).first().fill('Sales Offer Letter');
            await lastDoc.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: 'Developer', exact: true }).click();

            // Single stage: Customer reviews/accepts the sales offer (nobody reviews their own)
            await dialog.getByRole('button', { name: 'Add Stage' }).click();
            await page.waitForTimeout(500);
            let lastStage = dialog.locator('.border.rounded-lg, [class*="card"]').filter({ hasText: /Stage Name/i }).last();
            await lastStage.getByPlaceholder(/QShelter Review/i).first().fill('Customer Acceptance');
            await lastStage.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: 'Customer (Applicant)', exact: true }).click();

            await dialog.getByRole('button', { name: 'Create Plan' }).click();
            await expect(dialog).toBeHidden({ timeout: 15_000 });
            await page.waitForTimeout(1_000);
            console.log('[Step 10] Sales Offer plan created');

            // --- Plan 2: MREIF Preapproval Documentation ---
            await page.getByRole('button', { name: 'Create Documentation Plan' }).click();
            dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.locator('#name').fill('MREIF Preapproval Documentation');

            const preapprovalDocs = [
                { type: 'ID_CARD', name: 'Valid Government ID', uploader: 'Customer' },
                { type: 'BANK_STATEMENT', name: 'Bank Statement (6 months)', uploader: 'Customer' },
                { type: 'EMPLOYMENT_LETTER', name: 'Employment Confirmation Letter', uploader: 'Customer' },
                { type: 'PROOF_OF_ADDRESS', name: 'Proof of Address', uploader: 'Customer' },
                { type: 'PREAPPROVAL_LETTER', name: 'Bank Preapproval Letter', uploader: 'Lender (Bank)' },
            ];
            for (const doc of preapprovalDocs) {
                await dialog.getByRole('button', { name: 'Add Document' }).click();
                await page.waitForTimeout(500);
                lastDoc = dialog.locator('.border.rounded-lg, [class*="card"]').filter({ hasText: /Document Type/i }).last();
                await lastDoc.getByPlaceholder(/ID_CARD/i).first().fill(doc.type);
                await lastDoc.getByPlaceholder(/Valid ID Card/i).first().fill(doc.name);
                await lastDoc.locator('button[role="combobox"]').first().click();
                await page.getByRole('option', { name: doc.uploader, exact: true }).click();
            }

            // 2 stages: PLATFORM then CUSTOMER (nobody reviews their own)
            await dialog.getByRole('button', { name: 'Add Stage' }).click();
            await page.waitForTimeout(500);
            lastStage = dialog.locator('.border.rounded-lg, [class*="card"]').filter({ hasText: /Stage Name/i }).last();
            await lastStage.getByPlaceholder(/QShelter Review/i).first().fill('QShelter Staff Review');
            await lastStage.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: 'Platform (QShelter)', exact: true }).click();

            await dialog.getByRole('button', { name: 'Add Stage' }).click();
            await page.waitForTimeout(500);
            lastStage = dialog.locator('.border.rounded-lg, [class*="card"]').filter({ hasText: /Stage Name/i }).last();
            await lastStage.getByPlaceholder(/QShelter Review/i).first().fill('Customer Acceptance');
            await lastStage.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: 'Customer (Applicant)', exact: true }).click();

            await dialog.getByRole('button', { name: 'Create Plan' }).click();
            await expect(dialog).toBeHidden({ timeout: 15_000 });
            await page.waitForTimeout(1_000);
            console.log('[Step 10] Preapproval plan created');

            // --- Plan 3: Mortgage Offer Documentation ---
            await page.getByRole('button', { name: 'Create Documentation Plan' }).click();
            dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.locator('#name').fill('Mortgage Offer Documentation');

            await dialog.getByRole('button', { name: 'Add Document' }).click();
            await page.waitForTimeout(500);
            lastDoc = dialog.locator('.border.rounded-lg, [class*="card"]').filter({ hasText: /Document Type/i }).last();
            await lastDoc.getByPlaceholder(/ID_CARD/i).first().fill('MORTGAGE_OFFER_LETTER');
            await lastDoc.getByPlaceholder(/Valid ID Card/i).first().fill('Mortgage Offer Letter');
            await lastDoc.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: 'Lender (Bank)', exact: true }).click();

            // Single stage: Customer reviews/accepts the mortgage offer (nobody reviews their own)
            await dialog.getByRole('button', { name: 'Add Stage' }).click();
            await page.waitForTimeout(500);
            lastStage = dialog.locator('.border.rounded-lg, [class*="card"]').filter({ hasText: /Stage Name/i }).last();
            await lastStage.getByPlaceholder(/QShelter Review/i).first().fill('Customer Acceptance');
            await lastStage.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: 'Customer (Applicant)', exact: true }).click();

            await dialog.getByRole('button', { name: 'Create Plan' }).click();
            await expect(dialog).toBeHidden({ timeout: 15_000 });
            await page.waitForTimeout(1_000);
            console.log('[Step 10] Mortgage Offer plan created');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 11 — Create payment plan (ONE_TIME 10% downpayment)
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 11: Create payment plan', async () => {
            await page.goto('/admin/payment-plans');
            await page.waitForTimeout(2_000);

            await page.getByRole('button', { name: 'Create Payment Plan' }).click();
            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });

            await dialog.locator('#name').fill('MREIF 10% Downpayment');
            await pickSelect(page, dialog, /Payment Frequency/i, /One-Time/i);

            await dialog.getByRole('button', { name: 'Create Plan' }).click();
            await expect(dialog).toBeHidden({ timeout: 15_000 });
            await page.waitForTimeout(1_000);
            console.log('[Step 11] Payment plan created');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 12 — Create MREIF 10/90 Payment Method (5 phases)
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 12: Create MREIF payment method', async () => {
            await page.goto('/admin/payment-methods');
            await page.waitForTimeout(2_000);

            await page.getByRole('button', { name: 'Create Payment Method' }).click();
            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });

            await dialog.locator('#name').fill('MREIF 10/90 Mortgage');

            const phases = [
                { name: 'Prequalification', category: /Questionnaire/i, type: /Pre-Approval/i, plan: /MREIF Prequalification/i },
                { name: 'Sales Offer', category: /Documentation/i, type: /Document Verification/i, plan: /Sales Offer Documentation/i },
                { name: 'Preapproval Documentation', category: /Documentation/i, type: /KYC Verification/i, plan: /MREIF Preapproval Documentation/i },
                { name: '10% Downpayment', category: /Payment/i, type: /Downpayment/i, plan: /MREIF 10% Downpayment/i },
                { name: 'Mortgage Offer', category: /Documentation/i, type: /Document Verification/i, plan: /Mortgage Offer Documentation/i },
            ];

            for (const p of phases) {
                await dialog.getByRole('button', { name: 'Add Phase' }).click();
                await page.waitForTimeout(500);

                const phaseCard = dialog.locator('[data-slot="card"]').filter({ hasText: /Phase Name/i }).last();
                await phaseCard.getByPlaceholder(/KYC Verification/i).fill(p.name);

                // Select Category
                const combos = phaseCard.locator('button[role="combobox"]');
                await combos.first().click();
                await page.getByRole('option', { name: p.category }).click();
                await page.waitForTimeout(1_000); // Wait for conditional Plan combobox to render

                // Select Type
                await combos.nth(1).click();
                await page.getByRole('option', { name: p.type }).click();
                // Click phase name input to dismiss any lingering dropdown (Escape would close the dialog)
                await phaseCard.getByPlaceholder(/KYC Verification/i).click();
                await page.waitForTimeout(1_000); // Wait for Type dropdown to fully close

                // For payment phases, set the percentage
                if (p.name === '10% Downpayment') {
                    const percentInput = phaseCard.getByPlaceholder(/10/i);
                    if (await percentInput.isVisible().catch(() => false)) {
                        await percentInput.fill('10');
                    }
                }

                // Select the plan
                const planCombo = phaseCard.locator('button[role="combobox"]').last();
                await expect(planCombo).toBeVisible({ timeout: 5_000 });
                await planCombo.click();
                await page.getByRole('option', { name: p.plan }).click();
                // Click phase name input to dismiss any lingering dropdown (Escape would close the dialog)
                await phaseCard.getByPlaceholder(/KYC Verification/i).click();
                await page.waitForTimeout(500);
            }

            await dialog.getByRole('button', { name: 'Create Method' }).click();
            await expect(dialog).toBeHidden({ timeout: 15_000 });
            await page.waitForTimeout(1_000);
            console.log('[Step 12] MREIF payment method created (5 phases)');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 13 — Create qualification flows
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 13: Create qualification flows', async () => {
            await page.goto('/admin/qualification-flows');
            await page.waitForTimeout(2_000);

            // Developer qualification flow
            await page.getByRole('button', { name: 'Create Flow' }).click();
            let dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.getByPlaceholder(/Developer Qualification/i).fill('MREIF Developer Qualification');
            await dialog.getByRole('button', { name: 'Add Phase' }).click();
            await page.waitForTimeout(500);
            await dialog.getByPlaceholder(/Phase name/i).first().fill('Platform Approval');
            // Select Approval Gate category
            const devPhaseCard = dialog.locator('[class*="card"]').last();
            await devPhaseCard.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: /Approval Gate/i }).click();
            await page.waitForTimeout(500);
            // Explicitly select Approval Gate type (auto-selection via React state may leave phaseType empty)
            await devPhaseCard.locator('button[role="combobox"]').nth(1).click();
            await page.getByRole('option', { name: /Approval Gate/i }).click();
            await page.waitForTimeout(500);

            await dialog.getByRole('button', { name: 'Create Flow' }).click();
            // Wait for dialog to close (indicates success)
            await expect(dialog).not.toBeVisible({ timeout: 15_000 });
            // Verify flow appears in list
            await expect(page.getByText('MREIF Developer Qualification')).toBeVisible({ timeout: 10_000 });
            console.log('[Step 13] Developer qualification flow created');

            // Bank qualification flow
            await page.getByRole('button', { name: 'Create Flow' }).click();
            dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.getByPlaceholder(/Developer Qualification/i).fill('MREIF Bank Qualification');
            await dialog.getByRole('button', { name: 'Add Phase' }).click();
            await page.waitForTimeout(500);
            await dialog.getByPlaceholder(/Phase name/i).first().fill('Platform Approval');
            // Select Approval Gate category
            const bankPhaseCard = dialog.locator('[class*="card"]').last();
            await bankPhaseCard.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: /Approval Gate/i }).click();
            await page.waitForTimeout(500);
            // Explicitly select Approval Gate type
            await bankPhaseCard.locator('button[role="combobox"]').nth(1).click();
            await page.getByRole('option', { name: /Approval Gate/i }).click();
            await page.waitForTimeout(500);

            await dialog.getByRole('button', { name: 'Create Flow' }).click();
            // Wait for dialog to close (indicates success)
            await expect(dialog).not.toBeVisible({ timeout: 15_000 });
            // Verify flow appears in list
            await expect(page.getByText('MREIF Bank Qualification')).toBeVisible({ timeout: 10_000 });
            console.log('[Step 13] Bank qualification flow created');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 14 — Assign qualification flows + enroll + qualify orgs
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 14: Configure MREIF qualification and enroll orgs', async () => {
            await page.goto('/admin/payment-methods');
            await page.waitForTimeout(2_000);

            // Navigate to MREIF edit page
            const mreifCard = page.locator('[data-slot="card"], [class*="card"], [class*="Card"]').filter({ hasText: /MREIF 10\/90/i });
            await mreifCard.locator('button').filter({ has: page.locator('svg') }).last().click();
            await page.getByRole('menuitem', { name: /Edit/i }).click();
            await page.waitForTimeout(2_000);

            // Add DEVELOPER qualification requirement
            await page.getByRole('button', { name: 'Add Requirement' }).first().click();
            let dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: 'DEVELOPER', exact: true }).click();
            await dialog.locator('button[role="combobox"]').nth(1).click();
            await page.getByRole('option', { name: /MREIF Developer/i }).click();
            await dialog.getByRole('button', { name: 'Add Requirement' }).click();
            await expect(dialog).not.toBeVisible({ timeout: 10_000 });
            await page.waitForTimeout(1_000);

            // Add BANK qualification requirement
            await page.getByRole('button', { name: 'Add Requirement' }).first().click();
            dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.locator('button[role="combobox"]').first().click();
            await page.getByRole('option', { name: 'BANK', exact: true }).click();
            await dialog.locator('button[role="combobox"]').nth(1).click();
            await page.getByRole('option', { name: /MREIF Bank/i }).click();
            await dialog.getByRole('button', { name: 'Add Requirement' }).click();
            await expect(dialog).not.toBeVisible({ timeout: 10_000 });
            await page.waitForTimeout(1_000);
            console.log('[Step 14] Qualification requirements added');

            // Manage Organizations — enroll + qualify
            await page.getByRole('link', { name: /Manage Organizations/i }).click();
            await page.waitForLoadState('networkidle', { timeout: 15_000 });
            await page.waitForTimeout(2_000);

            // Enroll + qualify Lekki Gardens
            await page.getByRole('button', { name: /Enroll Organization/i }).click();
            dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.locator('button[role="combobox"]').click();
            await page.getByRole('option', { name: /Lekki Gardens/i }).click();
            await dialog.getByRole('button', { name: 'Enroll' }).click();
            await expect(dialog).not.toBeVisible({ timeout: 10_000 });
            await page.waitForTimeout(2_000);

            // Enrollment auto-starts qualification (IN_PROGRESS), so go directly to Mark Qualified
            let devCard = page.locator('[data-slot="card"], [class*="card"], [class*="Card"]').filter({ hasText: /Lekki Gardens/i });
            await devCard.getByRole('button', { name: /Mark Qualified/i }).click();
            await page.waitForTimeout(3_000);
            console.log('[Step 14] Lekki Gardens enrolled and qualified');

            // Enroll + qualify Access Bank
            await page.getByRole('button', { name: /Enroll Organization/i }).click();
            dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.locator('button[role="combobox"]').click();
            await page.getByRole('option', { name: /Access Bank/i }).click();
            await dialog.getByRole('button', { name: 'Enroll' }).click();
            await expect(dialog).not.toBeVisible({ timeout: 10_000 });
            await page.waitForTimeout(2_000);

            // Enrollment auto-starts qualification (IN_PROGRESS), so go directly to Mark Qualified
            let bankCard = page.locator('[data-slot="card"], [class*="card"], [class*="Card"]').filter({ hasText: /Access Bank/i });
            await bankCard.getByRole('button', { name: /Mark Qualified/i }).click();
            await page.waitForTimeout(3_000);
            console.log('[Step 14] Access Bank enrolled and qualified');

            // Add PROOF_OF_ADDRESS waiver for Access Bank
            bankCard = page.locator('[data-slot="card"], [class*="card"], [class*="Card"]').filter({ hasText: /Access Bank/i });
            await bankCard.locator('button').filter({ has: page.locator('svg') }).first().click();
            await page.waitForTimeout(1_000);

            await page.getByRole('button', { name: /Add Waiver|Add First Waiver/i }).first().click();
            dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.locator('button[role="combobox"]').click();
            await page.getByRole('option', { name: /PROOF_OF_ADDRESS|Proof of Address/i }).click();
            const reasonInput = dialog.getByPlaceholder(/waived/i);
            if (await reasonInput.isVisible().catch(() => false)) {
                await reasonInput.fill('Access Bank performs its own address verification');
            }
            await dialog.getByRole('button', { name: 'Create Waiver' }).click();
            await page.waitForTimeout(3_000);
            console.log('[Step 14] PROOF_OF_ADDRESS waived for Access Bank');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 15 — Link MREIF to property
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 15: Link MREIF to Sunrise Heights', async () => {
            await page.goto('/admin/payment-methods');
            await page.waitForTimeout(2_000);

            const mreifCard = page.locator('[data-slot="card"], [class*="card"], [class*="Card"]').filter({ hasText: /MREIF 10\/90/i });
            await mreifCard.locator('button').filter({ has: page.locator('svg') }).last().click();
            await page.getByRole('menuitem', { name: /Attach to Property/i }).click();

            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5_000 });
            await dialog.locator('button[role="combobox"]').click();
            await page.getByRole('option', { name: /Sunrise Heights/i }).click();
            await dialog.getByRole('button', { name: /Link/i }).click();
            await page.waitForTimeout(3_000);
            console.log('[Step 15] MREIF linked to Sunrise Heights');
            console.log('--- SETUP COMPLETE ---');
        });

        // ╔═══════════════════════════════════════════════════════════════╗
        // ║             PART B — APPLICATION FLOW                        ║
        // ║   Register Emeka -> browse -> apply -> 5 phases -> COMPLETED ║
        // ╚═══════════════════════════════════════════════════════════════╝

        // ═══════════════════════════════════════════════════════════════
        // STEP 16 — Register Emeka as customer
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 16: Register Emeka (customer)', async () => {
            await page.context().clearCookies();
            await page.goto('/register');
            await page.getByLabel(/First Name/i).fill('Emeka');
            await page.getByLabel(/Last Name/i).fill('Okoro');
            await page.getByLabel('Email').fill(EMAILS.emeka);
            await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
            await page.getByLabel('Confirm Password').fill(PASSWORD);

            // Intercept signup response to get the JWT (contains userId)
            const signupRespPromise = page.waitForResponse(
                (resp) => resp.url().includes('/auth/signup') && resp.request().method() === 'POST',
                { timeout: 30_000 },
            );
            await page.getByRole('button', { name: 'Create account' }).click();
            const signupResp = await signupRespPromise;
            const signupData = await signupResp.json();
            console.log(`[Step 16] Signup API status: ${signupResp.status()}`);

            if (!signupData.success || !signupData.data?.accessToken) {
                console.log('[Step 16] Signup response:', JSON.stringify(signupData));
                throw new Error(`Registration failed: ${signupData.error?.message || 'unknown'}`);
            }

            // Decode JWT to extract userId
            const jwtPayload = JSON.parse(
                Buffer.from(signupData.data.accessToken.split('.')[1], 'base64').toString(),
            );
            const userId = jwtPayload.userId || jwtPayload.sub;
            console.log(`[Step 16] Emeka userId: ${userId}`);

            // Call admin API to get the email verification token
            const adminResp = await page.request.get(
                `${USER_SERVICE_URL}/admin/users/${userId}`,
                { headers: { 'x-bootstrap-secret': BOOTSTRAP_SECRET } },
            );
            const adminData = await adminResp.json();
            const verificationToken = adminData.data?.emailVerificationToken;
            console.log(`[Step 16] Got verification token: ${verificationToken ? 'yes' : 'no'}`);

            if (!verificationToken) {
                throw new Error('No email verification token found for Emeka');
            }

            // Verify Emeka's email
            const verifyResp = await page.request.get(
                `${USER_SERVICE_URL}/auth/verify-email?token=${verificationToken}`,
            );
            console.log(`[Step 16] Email verification status: ${verifyResp.status()}`);

            await expect(page).toHaveURL(/\/(dashboard|admin|login)/, { timeout: 15_000 });
            await loginAs(page, EMAILS.emeka);
            console.log('[Step 16] Emeka registered, verified, and logged in');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 17 — Browse property and start application
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 17: Browse property and start application', async () => {
            await page.goto('/properties');
            await expect(page.getByText('Sunrise Heights Estate')).toBeVisible({ timeout: 10_000 });
            await page.getByRole('link', { name: 'View Details' }).first().click();
            await expect(page.getByText('Sunrise Heights Estate')).toBeVisible();

            await page.getByText('3-Bedroom Luxury Apartment').first().click();
            await expect(page.getByText('Available Units')).toBeVisible({ timeout: 10_000 });
            await page.getByRole('button', { name: /A-201/ }).click();

            await page.getByRole('tab', { name: 'Payment Options' }).click();
            await expect(page.getByText('MREIF 10/90 Mortgage')).toBeVisible({ timeout: 10_000 });
            await page.getByText('MREIF 10/90 Mortgage').first().click();

            await page.getByRole('button', { name: 'Start Application' }).click();
            await expect(page.getByText('Confirm Application')).toBeVisible({ timeout: 5_000 });
            await page.getByRole('button', { name: /Confirm.*Start/i }).click();

            await expect(page).toHaveURL(/\/applications\/[a-f0-9-]+/, { timeout: 30_000 });
            applicationId = page.url().split('/applications/')[1].split(/[?#]/)[0];
            console.log('[Step 17] Application created:', applicationId);
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 18 — Prequalification: Emeka fills questionnaire
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 18: Emeka fills prequalification questionnaire', async () => {
            await expect(page.getByRole('button', { name: /Submit Answers/i }))
                .toBeVisible({ timeout: 30_000 });

            await pickSelect(page, page, /employment status/i, 'Employed');
            await page.getByRole('spinbutton', { name: /monthly.*income/i }).fill('2500000');
            await page.getByRole('spinbutton', { name: /years.*employer/i }).fill('5');
            await pickSelect(page, page, /existing mortgage/i, 'No');
            await pickSelect(page, page, /purpose.*property/i, 'Primary Residence');

            await page.getByRole('button', { name: /Submit Answers/i }).click();
            await expect(page.getByText(/under review|submitted|awaiting/i).first())
                .toBeVisible({ timeout: 15_000 });
            console.log('[Step 18] Questionnaire submitted');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 19 — Adaeze approves prequalification
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 19: Adaeze approves prequalification', async () => {
            await loginAs(page, EMAILS.adaeze);
            await page.goto('/admin/applications/' + applicationId);
            await expect(page.getByText(applicationId)).toBeVisible({ timeout: 20_000 });

            const reviewBtn = page.getByRole('button', { name: /Review Questionnaire/i });
            await expect(reviewBtn).toBeVisible({ timeout: 10_000 });
            await reviewBtn.click();
            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
            await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
            await page.waitForTimeout(5_000);
            console.log('[Step 19] Questionnaire approved by Adaeze');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 20 — Nneka uploads sales offer (pending customer acceptance)
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 20: Nneka uploads sales offer letter', async () => {
            await loginAs(page, EMAILS.nneka);
            await page.goto('/admin/applications/' + applicationId);
            await expect(page.getByText(applicationId)).toBeVisible({ timeout: 20_000 });

            await pollUntilVisible(page, /Upload.*Document/i, { timeout: 30_000, interval: 3_000 });

            const docTypeSelect = page.getByRole('combobox').last();
            await docTypeSelect.click();
            await page.getByRole('option', { name: /Sales Offer/i }).click();
            await page.locator('input[type="file"]').last().setInputFiles(testPdf('sales-offer'));
            await page.getByRole('button', { name: /Upload Document/i }).click();
            await page.waitForTimeout(5_000);
            console.log('[Step 20] Sales offer uploaded by Nneka');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 21 — Emeka reviews and accepts the sales offer document
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 21: Emeka accepts sales offer', async () => {
            await loginAs(page, EMAILS.emeka);
            await page.goto('/applications/' + applicationId);
            await pollUntilVisible(page, /Action Required|Documents Requiring/i, { timeout: 60_000, interval: 5_000 });

            // Customer page shows "Accept" button for each document requiring review
            const acceptBtn = page.getByRole('button', { name: 'Accept' });
            await expect(acceptBtn.first()).toBeVisible({ timeout: 15_000 });
            await acceptBtn.first().click();
            await page.waitForTimeout(5_000);
            console.log('[Step 21] Sales offer accepted by Emeka');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 22 — Emeka uploads KYC documents
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 22: Emeka uploads KYC documents', async () => {
            await loginAs(page, EMAILS.emeka);
            await page.goto('/applications/' + applicationId);
            await pollUntilVisible(page, /Required Documents|Action Required/i, { timeout: 60_000, interval: 5_000 });

            const docTypes = ['ID_CARD', 'BANK_STATEMENT', 'EMPLOYMENT_LETTER', 'PROOF_OF_ADDRESS'];
            for (const docType of docTypes) {
                const fileInput = page.locator('#file-' + docType);
                if (await fileInput.count() > 0) {
                    await fileInput.setInputFiles(testPdf(docType.toLowerCase()));
                    await page.waitForTimeout(5_000);
                    console.log('  Uploaded ' + docType);
                } else {
                    console.log('  ' + docType + ' waived');
                }
            }
            console.log('[Step 22] KYC documents uploaded');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 23 — Adaeze approves KYC documents
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 23: Adaeze approves KYC documents', async () => {
            await loginAs(page, EMAILS.adaeze);
            await page.goto('/admin/applications/' + applicationId);
            await page.waitForTimeout(5_000);
            await approveAllDocuments(page);
            console.log('[Step 23] KYC documents approved by Adaeze');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 24 — Eniola uploads bank preapproval letter
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 24: Eniola uploads bank preapproval letter', async () => {
            await loginAs(page, EMAILS.eniola);
            await page.goto('/admin/applications/' + applicationId);
            await expect(page.getByText(applicationId)).toBeVisible({ timeout: 20_000 });

            await pollUntilVisible(page, /Upload.*Document/i, { timeout: 30_000, interval: 3_000 });

            const docTypeSelect = page.getByRole('combobox').last();
            await docTypeSelect.click();
            await page.getByRole('option', { name: /Preapproval/i }).click();
            await page.locator('input[type="file"]').last().setInputFiles(testPdf('bank-preapproval'));
            await page.getByRole('button', { name: /Upload Document/i }).click();
            await page.waitForTimeout(5_000);
            console.log('[Step 24] Bank preapproval uploaded by Eniola');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 25 — Emeka accepts bank preapproval
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 25: Emeka accepts bank preapproval', async () => {
            await loginAs(page, EMAILS.emeka);
            await page.goto('/applications/' + applicationId);
            await pollUntilVisible(page, /Action Required|Documents Requiring/i, { timeout: 60_000, interval: 5_000 });
            const acceptBtn = page.getByRole('button', { name: 'Accept' });
            await expect(acceptBtn.first()).toBeVisible({ timeout: 15_000 });
            await acceptBtn.first().click();
            await page.waitForTimeout(5_000);
            console.log('[Step 25] Bank preapproval accepted by Emeka');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 26 — Emeka creates wallet + generates installment
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 26: Emeka creates wallet', async () => {
            await page.goto('/applications/' + applicationId);
            await pollUntilVisible(page, /Create Wallet|wallet|Payment/i, { timeout: 60_000, interval: 5_000 });

            const createWalletBtn = page.getByRole('button', { name: /Create Wallet/i });
            if (await createWalletBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
                await createWalletBtn.click();
                await page.waitForTimeout(3_000);
            }
            const generateBtn = page.getByRole('button', { name: /Generate Installments/i });
            if (await generateBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
                await generateBtn.click();
                await page.waitForTimeout(3_000);
            }
            console.log('[Step 26] Wallet created');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 27 — Adaeze credits wallet
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 27: Adaeze credits wallet', async () => {
            await loginAs(page, EMAILS.adaeze);
            await page.goto('/admin/applications/' + applicationId);
            await page.waitForTimeout(5_000);

            await page.getByRole('button', { name: /Credit Wallet/i }).click();
            await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
            await page.getByRole('dialog').getByLabel(/Amount/i).fill('7500000');
            await page.getByRole('dialog').getByRole('button', { name: /^Credit/i }).click();
            await page.waitForTimeout(5_000);
            console.log('[Step 27] Wallet credited 7,500,000');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 28 — Emeka pays downpayment
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 28: Emeka pays downpayment', async () => {
            await loginAs(page, EMAILS.emeka);
            await page.goto('/applications/' + applicationId);
            await page.waitForTimeout(5_000);

            // Downpayment may have been auto-paid when wallet was credited
            const payBtn = page.getByRole('button', { name: /Pay Now/i }).first();
            if (await payBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
                await payBtn.click();
                await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
                await page.getByRole('dialog').getByRole('button', { name: /Fund Wallet.*Pay|Pay|Confirm/i }).click();
                await page.waitForTimeout(10_000);
                console.log('[Step 28] Downpayment paid');
            } else {
                console.log('[Step 28] Downpayment already completed (auto-paid from wallet credit)');
            }
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 29 — Eniola uploads mortgage offer letter
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 29: Eniola uploads mortgage offer letter', async () => {
            await loginAs(page, EMAILS.eniola);
            await page.goto('/admin/applications/' + applicationId);
            await pollUntilVisible(page, /Upload.*Document/i, { timeout: 60_000, interval: 5_000 });

            const docTypeSelect = page.getByRole('combobox').last();
            await docTypeSelect.click();
            await page.getByRole('option', { name: /Mortgage Offer/i }).click();
            await page.locator('input[type="file"]').last().setInputFiles(testPdf('mortgage-offer'));
            await page.getByRole('button', { name: /Upload Document/i }).click();
            await page.waitForTimeout(5_000);
            console.log('[Step 29] Mortgage offer uploaded by Eniola');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 30 — Emeka reviews and accepts the mortgage offer
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 30: Emeka accepts mortgage offer', async () => {
            await loginAs(page, EMAILS.emeka);
            await page.goto('/applications/' + applicationId);
            await pollUntilVisible(page, /Action Required|Documents Requiring/i, { timeout: 60_000, interval: 5_000 });

            // Customer page shows "Accept" button for each document requiring review
            const acceptBtn = page.getByRole('button', { name: 'Accept' });
            await expect(acceptBtn.first()).toBeVisible({ timeout: 15_000 });
            await acceptBtn.first().click();
            await page.waitForTimeout(5_000);
            console.log('[Step 30] Mortgage offer accepted by Emeka');
        });

        // ═══════════════════════════════════════════════════════════════
        // STEP 31 — Verify application is COMPLETED
        // ═══════════════════════════════════════════════════════════════
        await test.step('Step 31: Verify application COMPLETED', async () => {
            await page.goto('/applications/' + applicationId);
            await pollUntilVisible(page, /COMPLETED/i, { timeout: 60_000, interval: 5_000 });
            console.log('Application COMPLETED:', applicationId);
        });
    });
});

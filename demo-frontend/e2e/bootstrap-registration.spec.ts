import { test, expect } from '@playwright/test';

/**
 * E2E Test: Bootstrap and Registration Flow
 * 
 * Tests the complete flow:
 * 1. Bootstrap the platform (creates tenant + admin)
 * 2. Register a new user (Chidi)
 * 3. Verify the tenantId is properly stored and used
 */

// Get bootstrap secret from environment or use a default for local testing
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET || '';

test.describe('Bootstrap and Registration Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage before each test
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should bootstrap and then register a new user', async ({ page }) => {
        // Skip if no bootstrap secret provided
        test.skip(!BOOTSTRAP_SECRET, 'BOOTSTRAP_SECRET environment variable not set');

        // Step 1: Go to home page
        await page.goto('/');

        // Step 2: Open bootstrap dialog
        const bootstrapButton = page.locator('button:has-text("Bootstrap")');
        await expect(bootstrapButton).toBeVisible({ timeout: 10000 });
        await bootstrapButton.click();

        // Step 3: Fill bootstrap form
        await page.locator('input[id="bootstrapSecret"]').fill(BOOTSTRAP_SECRET);

        // Use unique subdomain for this test run
        const testId = Date.now().toString().slice(-8);
        await page.locator('input[id="tenantSubdomain"]').fill(`test-${testId}`);
        await page.locator('input[id="adminEmail"]').fill(`admin-${testId}@test.com`);

        // Step 4: Submit bootstrap
        await page.locator('button:has-text("Bootstrap Platform")').click();

        // Step 5: Wait for success
        await expect(page.locator('text=Bootstrap Successful')).toBeVisible({ timeout: 30000 });

        // Step 6: Verify tenantId is stored in localStorage
        const tenantId = await page.evaluate(() => localStorage.getItem('qshelter_tenant_id'));
        console.log('Stored tenantId:', tenantId);
        expect(tenantId).toBeTruthy();

        // Step 7: Navigate to registration page
        await page.goto('/register');

        // Step 8: Fill registration form for Chidi
        await page.locator('input[name="firstName"]').fill('Chidi');
        await page.locator('input[name="lastName"]').fill('Nnamdi');
        await page.locator('input[name="email"]').fill(`chidi-${testId}@gmail.com`);
        await page.locator('input[name="password"]').fill('CustomerPass123!');
        await page.locator('input[name="confirmPassword"]').fill('CustomerPass123!');

        // Step 9: Submit registration
        await page.locator('button[type="submit"]').click();

        // Step 10: Wait for response (either success redirect or error message)
        await page.waitForTimeout(5000);

        // Check for error - if "No tenant configured" appears, the test failed
        const noTenantError = page.locator('text=No tenant configured');
        if (await noTenantError.isVisible()) {
            // Log localStorage state for debugging
            const storageState = await page.evaluate(() => {
                const items: Record<string, string> = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) items[key] = localStorage.getItem(key) || '';
                }
                return items;
            });
            console.log('localStorage state:', storageState);
            throw new Error('Registration failed: tenantId not found in localStorage after bootstrap');
        }

        // Check for success - we should be on the login page now
        const currentUrl = page.url();
        console.log('Current URL after registration:', currentUrl);

        // Success means we're redirected to login page
        if (currentUrl.includes('/login')) {
            console.log('✅ Registration successful - redirected to login page');
            return; // Test passed!
        }

        // If not on login page, check for specific errors
        const errorAlert = page.locator('[role="alert"][class*="destructive"]').first();
        if (await errorAlert.isVisible()) {
            const errorText = await errorAlert.textContent();
            console.log('Registration error:', errorText);
            // If it's a "user already exists" error, that's actually fine for this test
            if (errorText && !errorText.includes('already exists')) {
                throw new Error(`Registration failed: ${errorText}`);
            }
        }
    });

    test('should show error when registering without bootstrap', async ({ page }) => {
        // Go directly to register without bootstrapping
        await page.goto('/register');

        // Fill registration form
        await page.locator('input[name="firstName"]').fill('Test');
        await page.locator('input[name="lastName"]').fill('User');
        await page.locator('input[name="email"]').fill('test@example.com');
        await page.locator('input[name="password"]').fill('TestPass123!');
        await page.locator('input[name="confirmPassword"]').fill('TestPass123!');

        // Submit registration
        await page.locator('button[type="submit"]').click();

        // Should show "No tenant configured" error (use .first() since it may appear in both form and toast)
        await expect(page.locator('text=No tenant configured').first()).toBeVisible({ timeout: 5000 });
    });

    test('should verify localStorage is set after bootstrap', async ({ page }) => {
        test.skip(!BOOTSTRAP_SECRET, 'BOOTSTRAP_SECRET environment variable not set');

        await page.goto('/');

        // Open bootstrap dialog
        await page.locator('button:has-text("Bootstrap")').click();

        // Fill bootstrap form with unique values
        const testId = Date.now().toString().slice(-8);
        await page.locator('input[id="bootstrapSecret"]').fill(BOOTSTRAP_SECRET);
        await page.locator('input[id="tenantSubdomain"]').fill(`ls-test-${testId}`);
        await page.locator('input[id="adminEmail"]').fill(`ls-admin-${testId}@test.com`);

        // Check localStorage before
        const beforeBootstrap = await page.evaluate(() => localStorage.getItem('qshelter_tenant_id'));
        expect(beforeBootstrap).toBeNull();

        // Submit bootstrap
        await page.locator('button:has-text("Bootstrap Platform")').click();

        // Wait for success
        await expect(page.locator('text=Bootstrap Successful')).toBeVisible({ timeout: 30000 });

        // Check localStorage after
        const afterBootstrap = await page.evaluate(() => localStorage.getItem('qshelter_tenant_id'));
        console.log('tenantId after bootstrap:', afterBootstrap);
        expect(afterBootstrap).toBeTruthy();
        expect(afterBootstrap!.length).toBeGreaterThan(10); // Should be a valid ID
    });
});

import { test, expect } from '@playwright/test';

/**
 * E2E Test: Email Login Flow
 * 
 * Uses the bootstrapped admin credentials:
 * - Email: adaeze@mailsac.com
 * - Password: SecureP@ssw0rd123!
 */

const TEST_CREDENTIALS = {
    email: 'adaeze@mailsac.com',
    password: 'SecureP@ssw0rd123!',
};

test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in valid credentials
    await page.locator('input[type="email"], input[name="email"]').fill(TEST_CREDENTIALS.email);
    await page.locator('input[type="password"], input[name="password"]').fill(TEST_CREDENTIALS.password);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Wait a bit for response
    await page.waitForTimeout(3000);

    // Check if there's an error alert (use first() to avoid strict mode error)
    const errorAlert = page.locator('[role="alert"][class*="destructive"]').first();
    if (await errorAlert.isVisible()) {
        const errorText = await errorAlert.textContent();
        console.log('Login error:', errorText);
        throw new Error(`Login failed with error: ${errorText}`);
    }

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
});

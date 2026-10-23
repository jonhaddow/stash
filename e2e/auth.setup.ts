import { expect, test as setup } from '@playwright/test';

// Signs in once with the dev-only "Sign in as" button; the other tests reuse it.
setup('sign in', async ({ page }) => {
	await page.goto('/login');
	await page.getByRole('button', { name: 'Sign in as Alex' }).click();
	// Longer than usual: the dev server builds the first page on demand, bits-ui included.
	await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible({ timeout: 30_000 });
	await page.context().storageState({ path: 'e2e/.auth/user.json' });
});

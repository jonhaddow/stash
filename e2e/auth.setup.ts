import { expect, test as setup } from '@playwright/test';

// Signs in once with the dev-only "Sign in as" button; the other tests reuse it.
setup('sign in', async ({ page }) => {
	await page.goto('/login');
	await page.getByRole('button', { name: 'Sign in as Alex' }).click();
	await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
	await page.context().storageState({ path: 'e2e/.auth/user.json' });
});

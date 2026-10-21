import { expect, test } from '@playwright/test';
import { open } from './helpers.ts';

test('an experimental look is chosen in Settings, and Classic turns it off', async ({ page }) => {
	await open(page, '/settings');
	await page.getByText('Magazine', { exact: true }).click();
	await expect(page.locator('body[data-look="magazine"]')).toHaveCount(1);
	await open(page, '/');
	await expect(page.locator('body[data-look="magazine"]')).toHaveCount(1);
	await open(page, '/settings');
	await page.getByText('Classic', { exact: true }).click();
	await expect(page.locator('body[data-look="classic"]')).toHaveCount(1);
});

import type { Page } from '@playwright/test';

/** Opens a page and waits until the app has loaded and taken over (hydrated). */
export async function open(page: Page, url: string) {
	await page.goto(url);
	await page.waitForLoadState('networkidle');
}

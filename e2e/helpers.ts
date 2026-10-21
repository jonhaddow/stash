import type { Locator, Page } from '@playwright/test';

/** Opens a page and waits until the app has loaded and taken over (hydrated). */
export async function open(page: Page, url: string) {
	await page.goto(url);
	await page.waitForLoadState('networkidle');
}

/** Drags a list row sideways by `dx` pixels, as a finger would (a mouse here). */
export async function swipe(page: Page, row: Locator, dx: number) {
	const box = (await row.boundingBox())!;
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx, y, { steps: 10 });
	await page.mouse.up();
}

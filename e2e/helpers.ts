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

/** Pulls down from the top of the page with a finger (touch events, which a mouse doesn't make). */
export async function pull(page: Page) {
	const cdp = await page.context().newCDPSession(page);
	const touch = (type: string, y?: number) =>
		cdp.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: y === undefined ? [] : [{ x: 200, y }]
		});
	await touch('touchStart', 100);
	for (let y = 120; y <= 260; y += 20) await touch('touchMove', y);
	await touch('touchEnd');
}

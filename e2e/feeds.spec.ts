import { expect, test } from '@playwright/test';
import { open, swipe } from './helpers.ts';

test('feed entries, unread only by default, and saving one for later', async ({ page }) => {
	await open(page, '/feeds');
	await expect(page.getByRole('link', { name: /^All about oolong/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /^Sourdough in a day/ })).toBeVisible();
	// No folder filters here: folders are for Settings.
	await expect(page.getByRole('navigation', { name: 'Folders' })).toHaveCount(0);

	// Unread ones only, unless the Unread chip is turned off.
	await expect(page.getByRole('link', { name: /^Bagels/ })).toBeHidden();
	await page.getByRole('link', { name: 'Unread', exact: true }).click();
	await expect(page.getByRole('link', { name: /^Bagels/ })).toBeVisible();
	await page.getByRole('link', { name: 'Unread', exact: true }).click();

	// Swiping left saves it and marks it read, so it leaves the list.
	const row = () => page.getByRole('listitem').filter({ hasText: 'Sourdough in a day' });
	await swipe(page, row(), -150);
	await expect(page.getByRole('status')).toContainText('In Later: Sourdough in a day');
	await expect(row()).toHaveCount(0);
	await open(page, '/?kind=video');
	await expect(page.getByRole('link', { name: /^Sourdough in a day/ })).toBeVisible();

	// With read ones shown it's there, read and in Later. Taking it out and
	// marking it unread leaves things as the other tests expect.
	await open(page, '/feeds?all=1');
	await expect(row()).toContainText('In Later');
	await expect(row().getByLabel('Unread')).toBeHidden();
	await swipe(page, row(), -150);
	await expect(row()).not.toContainText('In Later');
	const unread = page.waitForResponse((r) => r.url().includes('/read'));
	await swipe(page, row(), 150);
	await unread;
	await open(page, '/feeds');
	await expect(row().getByLabel('Unread')).toBeVisible();
});

test('swiping right marks an entry read and clears it, with Undo', async ({ page }) => {
	await open(page, '/feeds');
	const row = page.getByRole('listitem').filter({ hasText: 'Green tea, cold' });
	await expect(row.getByLabel('Unread')).toBeVisible();
	// A short swipe does nothing, and opens nothing.
	await swipe(page, row, 40);
	await expect(row.getByLabel('Unread')).toBeVisible();
	await swipe(page, row, 150);
	await expect(page.getByRole('status')).toContainText('Read: Green tea, cold');
	await expect(row).toHaveCount(0);
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(row.getByLabel('Unread')).toBeVisible();
	await open(page, '/feeds');
	await expect(row.getByLabel('Unread')).toBeVisible();
});

test('opening an entry marks it read', async ({ page, context }) => {
	await open(page, '/feeds');
	const row = page.getByRole('listitem').filter({ hasText: 'Green tea, cold' });
	await expect(row.getByLabel('Unread')).toBeVisible();
	const popup = context.waitForEvent('page');
	const read = page.waitForResponse((r) => r.url().includes('/read'));
	await row.getByRole('link').click();
	await (await popup).close();
	await read;
	await expect(row.getByLabel('Unread')).toBeHidden();
	await open(page, '/feeds?all=1');
	await expect(
		page.getByRole('listitem').filter({ hasText: 'Green tea, cold' }).getByLabel('Unread')
	).toBeHidden();
});

test('a feed’s page shows its sync log', async ({ page }) => {
	await open(page, '/settings/feeds');
	await page.getByRole('link', { name: /Tea Blog/ }).click();
	await expect(page.getByRole('heading', { name: 'Sync log' })).toBeVisible();
	const log = page.getByRole('list').last();
	await expect(log.getByRole('listitem').first()).toContainText(/Failed\s*· HTTP 503/);
	await expect(log.getByRole('listitem').last()).toContainText('OK, +2');
});

test('mark all read', async ({ page }) => {
	await open(page, '/feeds?kind=article');
	await page.getByRole('button', { name: 'Mark all read' }).click();
	await expect(page.getByLabel('Unread', { exact: true })).toHaveCount(0);
	await expect(page.getByText('All caught up.')).toBeVisible();
	// Only articles: it stays on them, and the video is still unread.
	await expect(page).toHaveURL(/kind=article/);
	await open(page, '/feeds');
	await expect(page.getByRole('link', { name: /^Sourdough in a day/ })).toBeVisible();
});

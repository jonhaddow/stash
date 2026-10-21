import { expect, test } from '@playwright/test';
import { open, swipe } from './helpers.ts';

test('feed entries by folder, unread in bold, and saving one for later', async ({ page }) => {
	await open(page, '/feeds');
	await expect(page.getByRole('link', { name: /^All about oolong/ })).toBeVisible();
	await page.getByRole('link', { name: /^YouTube/ }).click();
	await expect(page.getByRole('link', { name: /^Sourdough in a day/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /^All about oolong/ })).toBeHidden();

	// Unread ones only, unless the Unread chip is turned off.
	await expect(page.getByRole('link', { name: /^Bagels/ })).toBeHidden();
	await page.getByRole('link', { name: 'Unread', exact: true }).click();
	await expect(page.getByRole('link', { name: /^Bagels/ })).toBeVisible();
	await page.getByRole('link', { name: 'Unread', exact: true }).click();

	// Swiping left saves it; swiping again takes it back out (leaving Later as later.spec.ts expects).
	const row = () => page.getByRole('listitem').filter({ hasText: 'Sourdough in a day' });
	await swipe(page, row(), -150);
	await expect(row()).toContainText('In Later');
	await open(page, '/?kind=video');
	await expect(page.getByRole('link', { name: /^Sourdough in a day/ })).toBeVisible();

	await open(page, '/feeds?folder=1');
	await swipe(page, row(), -150);
	await expect(row()).not.toContainText('In Later');
});

test('swiping right marks an entry read, and again unread', async ({ page }) => {
	await open(page, '/feeds');
	const row = page.getByRole('listitem').filter({ hasText: 'Green tea, cold' });
	await expect(row.getByLabel('Unread')).toBeVisible();
	// A short swipe does nothing, and opens nothing.
	await swipe(page, row, 40);
	await expect(row.getByLabel('Unread')).toBeVisible();
	const read = page.waitForResponse((r) => r.url().includes('/read'));
	await swipe(page, row, 150);
	await read;
	await expect(row.getByLabel('Unread')).toBeHidden();
	const unread = page.waitForResponse((r) => r.url().includes('/read'));
	await swipe(page, row, 150);
	await unread;
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
	await open(page, '/feeds?folder=2');
	await page.getByRole('button', { name: 'Mark all read' }).click();
	await expect(page.getByRole('button', { name: 'Mark all read' })).toBeHidden();
	await expect(page.getByLabel('Unread', { exact: true })).toHaveCount(0);
	await expect(page.getByText('All caught up.')).toBeVisible();
	// Only this folder's: it stays put, and YouTube's entry is still unread.
	await expect(page).toHaveURL(/folder=2/);
	await expect(page.getByRole('link', { name: /^YouTube\s*1/ })).toBeVisible();
});

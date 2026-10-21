import { expect, test } from '@playwright/test';
import { open, swipe } from './helpers.ts';

test('lists saved links, filtered by articles and videos', async ({ page }) => {
	await open(page, '/');
	await expect(page.getByText('3 links')).toBeVisible();
	await expect(page.getByRole('link', { name: /^A long read about tea/ })).toHaveAttribute(
		'href',
		'https://blog.example/long-read'
	);
	await page.getByRole('link', { name: 'Videos' }).click();
	await expect(page.getByText('1 video')).toBeVisible();
	await expect(page.getByRole('link', { name: /^How to make bread/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /^A long read/ })).toBeHidden();
});

test('swiping right archives a link, and Undo brings it back', async ({ page }) => {
	await open(page, '/');
	await swipe(page, page.getByRole('listitem').filter({ hasText: 'A news story' }), 150);
	await expect(page.getByRole('status')).toContainText('Archived: A news story');
	await expect(page.getByRole('link', { name: /^A news story/ })).toBeHidden();
	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('link', { name: /^A news story/ })).toBeVisible();
});

test('the archive lists finished links', async ({ page }) => {
	await open(page, '/archive');
	await expect(page.getByRole('link', { name: /^Something finished/ })).toBeVisible();
});

test('a pasted link that isn’t one is refused', async ({ page }) => {
	await open(page, '/');
	// type=url would stop the form; the server's check is what's tested.
	await page.getByLabel('Link to save').evaluate((el) => el.setAttribute('type', 'text'));
	await page.getByLabel('Link to save').fill('not a link');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('alert')).toHaveText('That doesn’t look like a link');
});

test('a YouTube video plays in the app', async ({ page }) => {
	await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ body: '' }));
	await open(page, '/');
	await page.getByRole('link', { name: /^How to make bread/ }).click();
	const player = page.getByRole('dialog', { name: 'How to make bread' });
	await expect(player.locator('iframe')).toHaveAttribute(
		'src',
		/youtube-nocookie\.com\/embed\/abc\?/
	);
	await player.getByRole('button', { name: 'Close' }).click();
	await expect(player).toBeHidden();
});

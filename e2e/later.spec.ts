import { expect, test } from '@playwright/test';
import { open, swipe } from './helpers.ts';

test('lists saved links, filtered by articles and videos', async ({ page }) => {
	await open(page, '/later');
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
	await open(page, '/later');
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
	await open(page, '/later');
	// type=url would stop the form; the server's check is what's tested.
	await page.getByLabel('Link to save').evaluate((el) => el.setAttribute('type', 'text'));
	await page.getByLabel('Link to save').fill('not a link');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('alert')).toHaveText('That doesn’t look like a link');
});

test('a YouTube video plays in the app', async ({ page }) => {
	await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ body: '' }));
	await open(page, '/later');
	await page.getByRole('link', { name: /^How to make bread/ }).click();
	const player = page.getByRole('dialog', { name: 'How to make bread' });
	await expect(player.locator('iframe')).toHaveAttribute(
		'src',
		/youtube-nocookie\.com\/embed\/abc\?/
	);
	await player.getByRole('button', { name: 'Close' }).click();
	await expect(player).toBeHidden();
});

test('a video resumes where it was left', async ({ page }) => {
	// A stand-in for YouTube's embed: once the app's listening, it says it's 65 s into a 10-minute video.
	await page.route('https://www.youtube-nocookie.com/**', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: `<script>addEventListener('message', () => parent.postMessage(JSON.stringify({ event: 'infoDelivery', info: { currentTime: 65, duration: 600, playerState: 1 } }), '*'))</script>`
		})
	);
	await open(page, '/later');
	const row = page.getByRole('listitem').filter({ hasText: 'How to make bread' });
	await row.getByRole('link').click();
	const player = page.getByRole('dialog', { name: 'How to make bread' });
	await expect(player.locator('iframe')).not.toHaveAttribute('src', /start=/);
	await player.getByRole('button', { name: 'Close' }).click();
	await expect(row).toContainText('1:05 in');

	await open(page, '/later');
	await expect(row).toContainText('1:05 in');
	await row.getByRole('link').click();
	await expect(player.locator('iframe')).toHaveAttribute('src', /&start=65$/);
	await player.getByRole('button', { name: 'Close' }).click();
	// Finished: forgotten again, which also leaves the database as the other tests expect.
	await page.request.post('/api/position', { data: { video: 'abc', seconds: null } });
});

test('oldest first, remembered on the next visit', async ({ page }) => {
	await open(page, '/later');
	const titles = page.getByRole('listitem').locator('a').first();
	await expect(titles).toHaveText(/A long read about tea/);
	await page.getByRole('button', { name: /^Order/ }).click();
	await page.getByRole('menuitemradio', { name: 'Oldest first' }).click();
	await expect(titles).toHaveText(/A news story/);
	await open(page, '/later');
	await expect(titles).toHaveText(/A news story/);
	await expect(page.getByRole('button', { name: /^Order/ })).toHaveText(/Oldest first/);
});

test('the Shortcut saves to Later with a key from Settings', async ({ page, request }) => {
	await open(page, '/settings');
	await page.getByRole('button', { name: /Make a (new )?key/ }).click();
	const key = (await page.locator('code').first().textContent())!;

	const res = await request.post('/api/save', {
		data: { url: 'Look at this https://example.com/from-the-share-sheet', title: 'Shared on iOS' },
		headers: { authorization: `Bearer ${key}` }
	});
	expect(res.status()).toBe(201);
	expect(await res.text()).toBe('Saved: Shared on iOS');

	await open(page, '/later');
	await expect(page.getByText('Shared on iOS')).toBeVisible();
});

import { expect, test } from '@playwright/test';

// Signed out: only /login, /auth/*, /sync and /api/save are open, and the last two need a secret.
test.describe('signed out', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('pages send you to sign in, coming back after', async ({ page }) => {
		await page.goto('/settings/feeds?x=1');
		await expect(page).toHaveURL('/login?next=%2Fsettings%2Ffeeds%3Fx%3D1');
	});

	test('posts are refused', async ({ request }) => {
		expect((await request.post('/?/add', { form: { url: 'https://example.com' } })).status()).toBe(
			401
		);
		expect((await request.post('/items/1/read')).status()).toBe(401);
		expect(
			(await request.post('/api/position', { data: { video: 'x', seconds: 1 } })).status()
		).toBe(401);
	});

	test('the cron needs its secret, and the Shortcut its key', async ({ request }) => {
		expect((await request.post('/sync')).status()).toBe(403);
		expect((await request.post('/sync', { headers: { 'x-cron-secret': 'nope' } })).status()).toBe(
			403
		);
		const save = (auth?: string) =>
			request.post('/api/save', {
				data: { url: 'https://example.com/shortcut' },
				headers: auth ? { authorization: auth } : {}
			});
		expect((await save()).status()).toBe(401);
		expect((await save('Bearer not-a-key')).status()).toBe(401);
	});
});

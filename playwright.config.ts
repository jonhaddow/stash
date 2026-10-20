import { defineConfig, devices } from '@playwright/test';

// End-to-end tests drive the real app in a phone-sized Chromium. Each run
// starts a dev server on its own fresh database (e2e/reset-db.sh), signs in
// once with the dev-only sign-in, and runs the specs one at a time, because
// they share that database.
// Not 5180-5182: budget, energy and plants use those, and sessions run them at once.
const PORT = 5183;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	reporter: [['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		...devices['Pixel 7'],
		trace: 'retain-on-failure'
	},
	projects: [
		{ name: 'setup', testMatch: /auth\.setup\.ts/ },
		{
			name: 'app',
			dependencies: ['setup'],
			use: { storageState: 'e2e/.auth/user.json' }
		}
	],
	webServer: {
		command: `./e2e/reset-db.sh && E2E_DB=.wrangler/e2e/v3 npx vite dev --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}/login`,
		reuseExistingServer: !!process.env.E2E_REUSE,
		timeout: 120_000
	}
});

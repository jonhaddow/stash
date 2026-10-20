import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';

function commit() {
	try {
		return process.env.WORKERS_CI_COMMIT_SHA ?? execSync('git rev-parse HEAD').toString().trim();
	} catch {
		return undefined; // SvelteKit's default, a timestamp
	}
}

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// The commit as the version, so scripts/wait-deploy.sh can tell when it's live.
			version: { name: commit() },
			// End-to-end tests run against their own local database (see e2e/).
			adapter: adapter(
				process.env.E2E_DB ? { platformProxy: { persist: { path: process.env.E2E_DB } } } : {}
			),
			// SvelteKit adds nonces for its own inline scripts. Inline styles stay allowed:
			// components set sizes with style attributes. The font is served with the app.
			csp: {
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'font-src': ['self'],
					'img-src': ['self', 'data:', 'blob:'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					setupFiles: ['./src/node-shims.ts'],
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});

import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
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
					// Thumbnails come from the feeds' and pages' own sites.
					'img-src': ['self', 'data:', 'blob:', 'https:'],
					// YouTube videos play in the app.
					'frame-src': ['https://www.youtube-nocookie.com'],
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

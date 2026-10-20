// Runs after `vite build`: wraps SvelteKit's generated Cloudflare worker with
// worker/entry.js so the deployed Worker also has a scheduled() handler.
// (The adapter writes its worker to wrangler's `main`, so it can't point at our file.)
import { appendFileSync, copyFileSync, renameSync } from 'node:fs';

const dir = '.svelte-kit/cloudflare';
renameSync(`${dir}/_worker.js`, `${dir}/_sveltekit_worker.js`);
copyFileSync('worker/entry.js', `${dir}/_worker.js`);
// Both files sit in the assets directory; keep them from being served as files.
appendFileSync(`${dir}/.assetsignore`, '\n_sveltekit_worker.js\n');

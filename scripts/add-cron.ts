// Runs after `vite build`: wraps SvelteKit's generated Cloudflare worker with
// worker/entry.js so the deployed Worker also has a scheduled() handler.
// (The adapter sets the Worker entry itself, so wrangler's `main` can't point at our file.)
import { copyFileSync, renameSync } from 'node:fs';

const dir = '.svelte-kit/cloudflare/worker';
renameSync(`${dir}/index.js`, `${dir}/_sveltekit_worker.js`);
copyFileSync('worker/entry.js', `${dir}/index.js`);

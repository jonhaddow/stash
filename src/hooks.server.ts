import { error, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { dev } from '$app/env';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '#lib/server/db/schema.ts';
import { SESSION_COOKIE, setSessionCookie, validateSession } from '#lib/server/auth.ts';
import { configureReddit } from '#lib/server/reddit.ts';

// The dev server runs on Node, which lacks some of Workers' built-ins.
if (dev) await import('./node-shims.ts');

/** Pages anyone can reach without signing in. */
const PUBLIC = [
	/^\/login$/,
	/^\/auth\//,
	// Called by the cron, which sends a secret.
	/^\/sync$/,
	// The iOS Shortcut, which sends a token.
	/^\/api\/save$/
];

/** Sent with every page and endpoint (the CSP itself is configured in vite.config.ts). */
const SECURITY_HEADERS = {
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'same-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

export const handle: Handle = async ({ event, resolve }) => {
	configureReddit(env.REDDIT_CLIENT_ID, env.REDDIT_CLIENT_SECRET);
	const db = drizzle(env.DB, { schema });
	event.locals.db = db;
	event.locals.user = null;

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const result = await validateSession(db, token);
		if (result) {
			event.locals.user = result.user;
			if (result.renewed) setSessionCookie(event.cookies, token, result.expiresAt);
		} else {
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}

	const path = event.url.pathname;
	if (!event.locals.user && !PUBLIC.some((p) => p.test(path))) {
		if (event.request.method !== 'GET') error(401, 'Please sign in');
		redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
	}

	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
	// Pages name this build's files, which the next deploy deletes, so mustn't be saved
	// (worker/entry.js handles pages saved anyway).
	if (response.headers.get('content-type')?.startsWith('text/html'))
		response.headers.set('Cache-Control', 'no-store');
	return response;
};

import { redirect } from '@sveltejs/kit';
import { finishSignIn } from 'auth/google';
import { env } from 'cloudflare:workers';
import { createSession, findAllowedUser, setSessionCookie } from '#lib/server/auth.ts';
import { safeBack } from '#lib/server/forms.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const next = safeBack(cookies.get('oauth_next') ?? null);
	cookies.delete('oauth_next', { path: '/' });
	const result = await finishSignIn(cookies, url, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
	if (result.error) redirect(303, `/login?error=${result.error}`);

	const u = await findAllowedUser(locals.db, result.email);
	if (!u) {
		console.warn('Sign-in refused: not on the allowlist', result.email);
		redirect(303, '/login?error=not-allowed');
	}

	console.log('Signed in', u.email);
	const { token, expiresAt } = await createSession(locals.db, u.id);
	setSessionCookie(cookies, token, expiresAt);
	redirect(303, next);
};

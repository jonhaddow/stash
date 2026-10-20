import { redirect } from '@sveltejs/kit';
import { Google, generateCodeVerifier, generateState } from 'arctic';
import { env } from 'cloudflare:workers';
import { GOOGLE_REDIRECT_URI } from '#lib/server/auth.ts';
import { safeBack } from '#lib/server/forms.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies }) => {
	// The subdomain first, so the shared redirect knows where to send Google's reply.
	const state = `${url.hostname.split('.')[0]}.${generateState()}`;
	const verifier = generateCodeVerifier();
	const google = new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
	const authUrl = google.createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']);
	authUrl.searchParams.set('prompt', 'select_account');

	const opts = { path: '/', httpOnly: true, sameSite: 'lax' as const, maxAge: 600 };
	cookies.set('oauth_state', state, opts);
	cookies.set('oauth_verifier', verifier, opts);
	cookies.set('oauth_next', safeBack(url.searchParams.get('next')), opts);
	redirect(302, authUrl.toString(), { external: ['https://accounts.google.com'] });
};

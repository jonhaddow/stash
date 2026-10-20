import { redirect } from '@sveltejs/kit';
import { Google, decodeIdToken } from 'arctic';
import { env } from 'cloudflare:workers';
import {
	GOOGLE_REDIRECT_URI,
	createSession,
	findAllowedUser,
	setSessionCookie
} from '#lib/server/auth.ts';
import { safeBack } from '#lib/server/forms.ts';
import type { RequestHandler } from './$types';

type GoogleClaims = {
	iss: string;
	aud: string;
	exp: number;
	email?: string;
	email_verified?: boolean;
};

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const state = cookies.get('oauth_state');
	const verifier = cookies.get('oauth_verifier');
	const next = safeBack(cookies.get('oauth_next') ?? null);
	for (const name of ['oauth_state', 'oauth_verifier', 'oauth_next'])
		cookies.delete(name, { path: '/' });

	const code = url.searchParams.get('code');
	if (!code || !state || !verifier || url.searchParams.get('state') !== state) {
		// Also how a cancelled Google sign-in arrives (?error=access_denied, no code).
		console.warn('Sign-in failed: missing or mismatched state', {
			hasCode: !!code,
			hasStateCookie: !!state,
			googleError: url.searchParams.get('error')
		});
		redirect(303, '/login?error=expired');
	}

	let claims: GoogleClaims;
	try {
		const google = new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
		const tokens = await google.validateAuthorizationCode(code, verifier);
		// The ID token came straight from Google's token endpoint over TLS, so its
		// signature doesn't need re-checking; the claims still do.
		claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
	} catch (e) {
		// Google's error code and message only; never the code or tokens.
		const err = e as { code?: string; description?: string; message?: string };
		console.error(
			'Sign-in failed: Google token exchange',
			err.code,
			err.description ?? err.message
		);
		redirect(303, '/login?error=google');
	}

	const valid =
		['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) &&
		claims.aud === env.GOOGLE_CLIENT_ID &&
		claims.exp * 1000 > Date.now() &&
		claims.email_verified === true &&
		!!claims.email;
	if (!valid) {
		console.warn('Sign-in refused: ID token checks failed', {
			iss: claims.iss,
			audOk: claims.aud === env.GOOGLE_CLIENT_ID,
			expired: claims.exp * 1000 <= Date.now(),
			emailVerified: claims.email_verified,
			email: claims.email
		});
		redirect(303, '/login?error=google');
	}

	const u = await findAllowedUser(locals.db, claims.email!);
	if (!u) {
		console.warn('Sign-in refused: not on the allowlist', claims.email);
		redirect(303, '/login?error=not-allowed');
	}

	console.log('Signed in', u.email);
	const { token, expiresAt } = await createSession(locals.db, u.id);
	setSessionCookie(cookies, token, expiresAt);
	redirect(303, next);
};

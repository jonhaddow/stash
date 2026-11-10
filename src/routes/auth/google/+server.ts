import { redirect } from '@sveltejs/kit';
import { startSignIn } from 'auth/google';
import { env } from 'cloudflare:workers';
import { safeBack } from '#lib/server/forms.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const next = safeBack(url.searchParams.get('next'));
	cookies.set('oauth_next', next, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600 });
	const google = await startSignIn(cookies, env.GOOGLE_CLIENT_ID, url.hostname);
	redirect(302, google, { external: ['https://accounts.google.com'] });
};

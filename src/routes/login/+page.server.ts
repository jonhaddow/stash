import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/env';
import {
	allowedUsers,
	createSession,
	findAllowedUser,
	setSessionCookie
} from '#lib/server/auth.ts';
import { safeBack } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

const ERRORS: Record<string, string> = {
	'not-allowed': 'That Google account isn’t on the list for this app.',
	expired: 'Sign-in took too long or was interrupted. Please try again.',
	google: 'Google sign-in didn’t work. Please try again.'
};

export const load: PageServerLoad = async ({ url, locals }) => {
	const next = safeBack(url.searchParams.get('next'));
	if (locals.user) redirect(303, next);
	return {
		next,
		error: ERRORS[url.searchParams.get('error') ?? ''] ?? null,
		// Everyone on the list gets a button, in local development only.
		devUsers: dev ? await allowedUsers(locals.db) : []
	};
};

export const actions: Actions = {
	// Local development only: sign in without Google.
	dev: async ({ request, cookies, locals }) => {
		if (!dev) return fail(404);
		const form = await request.formData();
		const u = await findAllowedUser(locals.db, String(form.get('email')));
		if (!u) return fail(400);
		const { token, expiresAt } = await createSession(locals.db, u.id);
		setSessionCookie(cookies, token, expiresAt);
		redirect(303, safeBack(String(form.get('next'))));
	}
};

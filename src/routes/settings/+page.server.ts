import { apiTokenCreatedAt, createApiToken } from '#lib/server/auth.ts';
import { toLook } from '#lib/looks.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	tokenCreatedAt: await apiTokenCreatedAt(locals.db, locals.user!.id)
});

export const actions: Actions = {
	// Shown once; making another replaces it (and stops the old Shortcut).
	token: async ({ locals }) => ({ token: await createApiToken(locals.db, locals.user!.id) }),
	// Per device, so the phone and the laptop can try different ones.
	look: async ({ request, cookies }) => {
		const look = toLook((await request.formData()).get('look'));
		cookies.set('look', look, { path: '/', maxAge: 60 * 60 * 24 * 365 });
	}
};

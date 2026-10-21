import { env } from 'cloudflare:workers';
import { apiTokenCreatedAt, createApiToken } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	tokenCreatedAt: await apiTokenCreatedAt(locals.db, locals.user!.id),
	vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null
});

export const actions: Actions = {
	// Shown once; making another replaces it (and stops the old Shortcut).
	token: async ({ locals }) => ({ token: await createApiToken(locals.db, locals.user!.id) })
};

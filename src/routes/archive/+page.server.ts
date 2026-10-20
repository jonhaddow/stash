import { listSaved, setArchived } from '#lib/server/saved.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	links: await listSaved(locals.db, { archived: true })
});

export const actions: Actions = {
	restore: async ({ request, locals }) => {
		await setArchived(locals.db, Number((await request.formData()).get('id')), null);
	}
};

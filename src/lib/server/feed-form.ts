import { folderNamed } from './feeds.ts';
import type { DB } from './db/index.ts';

/**
 * The folder picked on a feed form: an existing one (`folder`, an id), a new
 * one by name (`newFolder`), or none.
 */
export async function folderFromForm(db: DB, form: FormData) {
	const name = String(form.get('newFolder') ?? '').trim();
	if (name) return folderNamed(db, name.slice(0, 40));
	const id = Number(form.get('folder'));
	return id > 0 ? id : null;
}

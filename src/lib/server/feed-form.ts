import { asSubreddit, subredditFeed, subredditFrom, withShorts } from '../feed-url.ts';
import { folderNamed } from './feeds.ts';
import { cleanUrl } from './saved.ts';
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

/**
 * What the add box asks for: a picked search result, a subreddit with its
 * options, a YouTube @handle, or a link. Null if it's none of those.
 */
export function feedFromForm(form: FormData) {
	const picked = form.get('pick');
	if (typeof picked === 'string' && picked) return picked;
	const typed = String(form.get('url') ?? '').trim();
	const sub = asSubreddit(typed);
	if (sub) return subredditFeed(subredditFrom(sub.sub, form));
	if (/^@[\w.-]+$/.test(typed)) return `https://www.youtube.com/${typed}`;
	return cleanUrl(typed);
}

/** A feed's URL with the options from its edit form (Reddit's sort and limit, YouTube's Shorts). */
export function urlWithOptions(url: string, form: FormData) {
	const sub = asSubreddit(url);
	if (sub) return subredditFeed(subredditFrom(sub.sub, form));
	return withShorts(url, form.get('shorts') === 'on');
}

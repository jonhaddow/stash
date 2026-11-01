import {
	asSubreddit,
	isHandle,
	subredditFeed,
	subredditFrom,
	subredditNamed,
	withShorts
} from '../feed-url.ts';
import { cleanUrl } from './saved.ts';

/**
 * What the add box asks for: a picked search result, a subreddit with its
 * options, a YouTube @handle, or a link. Null if it's none of those.
 */
export function feedFromForm(form: FormData) {
	const picked = form.get('pick');
	if (typeof picked === 'string' && picked) return picked;
	const typed = String(form.get('url') ?? '').trim();
	// A pasted Reddit link is a subreddit whatever's picked.
	const reddit = form.get('type') === 'reddit';
	const sub = reddit ? subredditNamed(typed) : asSubreddit(typed);
	if (reddit && !sub) return null;
	// The options are on the form only on the Reddit tab; else the link's own.
	if (sub) return subredditFeed(form.has('sort') ? subredditFrom(sub.sub, form) : sub);
	if (isHandle(typed)) return `https://www.youtube.com/${typed}`;
	return cleanUrl(typed);
}

/** A feed's URL with the options from its edit form (Reddit's sort and limit, YouTube's Shorts). */
export function urlWithOptions(url: string, form: FormData) {
	const sub = asSubreddit(url);
	if (sub) return subredditFeed(subredditFrom(sub.sub, form));
	return withShorts(url, form.get('shorts') === 'on');
}

import { asSubreddit, isHandle, subredditFeed, subredditFrom, withShorts } from '../feed-url.ts';
import { cleanUrl } from './saved.ts';

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
	if (isHandle(typed)) return `https://www.youtube.com/${typed}`;
	return cleanUrl(typed);
}

/** A feed's URL with the options from its edit form (Reddit's sort and limit, YouTube's Shorts). */
export function urlWithOptions(url: string, form: FormData) {
	const sub = asSubreddit(url);
	if (sub) return subredditFeed(subredditFrom(sub.sub, form));
	return withShorts(url, form.get('shorts') === 'on');
}

// Reddit's signed-in API, for subreddit feeds. Its public .rss is rate-limited
// per address, and Cloudflare's addresses are shared with every other Worker,
// so most requests got 429s; the API gives Stash's own Reddit app its own quota
// (1,000 requests per 10 minutes). Feeds stay stored as their .rss URLs: this
// wraps fetch so a request for one goes to the API instead, and the listing
// comes back as the Atom feed parse.ts already reads.
import type { Fetch } from './http.ts';

type Credentials = { id: string; secret: string };

let configured: Credentials | null = null;
let token: { value: string; expires: number } | null = null;

/** Set from the Worker's secrets on each request (hooks.server.ts); without them, .rss as before. */
export function configureReddit(id: string | undefined, secret: string | undefined) {
	configured = id && secret ? { id, secret } : null;
}

export const isReddit = (hostname: string) => /(^|\.)reddit\.com$/.test(hostname);

/** The API address for a subreddit's .rss feed, or null for anything else. */
export function apiUrl(url: string) {
	const u = new URL(url);
	if (!isReddit(u.hostname) || !/\.rss\/?$/.test(u.pathname)) return null;
	const path = u.pathname.replace(/\/?\.rss\/?$/, '');
	u.searchParams.set('raw_json', '1'); // titles without HTML escapes
	return `https://oauth.reddit.com${path}?${u.searchParams}`;
}

async function accessToken(fetcher: Fetch, c: Credentials, headers: Headers) {
	if (token && token.expires > Date.now()) return token.value;
	const res = await fetcher('https://www.reddit.com/api/v1/access_token', {
		method: 'POST',
		headers: {
			authorization: `Basic ${btoa(`${c.id}:${c.secret}`)}`,
			'content-type': 'application/x-www-form-urlencoded',
			'user-agent': headers.get('user-agent') ?? 'Stash/1.0'
		},
		body: 'grant_type=client_credentials',
		signal: AbortSignal.timeout(10_000)
	});
	if (!res.ok) return null;
	const body = (await res.json()) as { access_token: string; expires_in: number };
	// A minute early, so it never expires mid-request.
	token = { value: body.access_token, expires: Date.now() + (body.expires_in - 60) * 1000 };
	return token.value;
}

const escape = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Listing = {
	data: {
		children: {
			data: { name: string; title: string; permalink: string; created_utc: number };
		}[];
	};
};

/** A listing as Atom, with the ids and links Reddit's own .rss uses, so nothing is seen twice. */
export function listingToAtom(listing: Listing, apiPath: string) {
	const sub = /^\/r\/([\w-]+)/.exec(apiPath)?.[1];
	const entries = listing.data.children.map(
		({ data: p }) =>
			`<entry><id>${escape(p.name)}</id><title>${escape(p.title)}</title>` +
			`<link href="${escape(`https://www.reddit.com${p.permalink}`)}"/>` +
			`<published>${new Date(p.created_utc * 1000).toISOString()}</published></entry>`
	);
	return (
		`<feed xmlns="http://www.w3.org/2005/Atom"><title>${sub ? `r/${sub}` : 'Reddit'}</title>` +
		`<link rel="alternate" href="https://www.reddit.com${sub ? `/r/${sub}/` : '/'}"/>` +
		`${entries.join('')}</feed>`
	);
}

/** `fetcher`, but subreddit .rss requests go through the API when credentials are set. */
export function withReddit(fetcher: Fetch, credentials = () => configured): Fetch {
	return async (input, init) => {
		const api = typeof input === 'string' ? apiUrl(input) : null;
		const c = credentials();
		if (!api || !c) return fetcher(input, init);

		const headers = new Headers(init?.headers);
		const value = await accessToken(fetcher, c, headers);
		if (!value) return new Response('Reddit sign-in failed', { status: 401 });
		// The API doesn't do conditional requests.
		headers.delete('if-none-match');
		headers.delete('if-modified-since');
		headers.set('authorization', `Bearer ${value}`);
		headers.set('accept', 'application/json');
		const res = await fetcher(api, { ...init, headers });
		if (!res.ok) return res;
		const atom = listingToAtom((await res.json()) as Listing, new URL(api).pathname);
		return new Response(atom, { headers: { 'content-type': 'application/atom+xml' } });
	};
}

/** For tests: forget the cached token. */
export function resetRedditToken() {
	token = null;
}

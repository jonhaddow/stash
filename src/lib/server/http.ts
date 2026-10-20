// Fetching other sites: feeds, and pages for a saved link's title.

export type Fetch = typeof fetch;

/** Workers' fetch, called unbound (`this.fetch` throws "Illegal invocation"). */
export const workersFetch: Fetch = (input, init) => fetch(input, init);

/** Some sites (Reddit especially) refuse requests without a descriptive User-Agent. */
const USER_AGENT = 'Stash/1.0 (personal feed reader; +https://stash.app.haddow.me)';
const TIMEOUT_MS = 10_000;
/** Big enough for any sensible feed; a page's <head> is well within it. */
const MAX_BYTES = 3_000_000;

export async function get(fetcher: Fetch, url: string, headers: Record<string, string> = {}) {
	return fetcher(url, {
		headers: {
			'user-agent': USER_AGENT,
			accept:
				'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
			...headers
		},
		redirect: 'follow',
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
}

/** A response's text, cut off at MAX_BYTES (or `limit`). */
export async function readText(res: Response, limit = MAX_BYTES) {
	if (!res.body) return '';
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let out = '';
	let bytes = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		bytes += value.byteLength;
		out += decoder.decode(value, { stream: true });
		if (bytes >= limit) {
			await reader.cancel();
			break;
		}
	}
	return out + decoder.decode();
}

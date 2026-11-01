import { page } from '$app/state';

/** This page's URL with one filter changed (and paging reset). */
export function withParam(name: string, value: string | null) {
	const url = new URL(page.url.href);
	url.searchParams.delete('from');
	if (value) url.searchParams.set(name, value);
	else url.searchParams.delete(name);
	return url.pathname + url.search;
}

const HERE = 'https://app.invalid';

/**
 * Only follow links within the app. Parsed the way a browser would, so tricks
 * like `/\evil.example` (read as `//evil.example`) are refused.
 */
export function safeBack(value: FormDataEntryValue | string | null, fallback = '/'): string {
	// Paths only: `evil.example` would otherwise resolve as a relative path.
	if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
	try {
		const url = new URL(value, HERE);
		const path = url.pathname + url.search + url.hash;
		// Tidying `/.//evil.example` gives `//evil.example`, another site again.
		return url.origin === HERE && !path.startsWith('//') ? path : fallback;
	} catch {
		return fallback;
	}
}

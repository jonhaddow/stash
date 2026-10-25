// Service worker: makes Stash quick to open. It caches only the built app's
// code, CSS and font (their names change with every build, so they can't go
// stale); pages and data always come from the network, so lists are fresh.
import { version } from '$app/env';
import { immutable } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE = `app-${version}`;
const BUILT = new Set(immutable.map((f) => new URL(f.path, self.location.origin).pathname));

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
	event.waitUntil(
		(async () => {
			// Earlier builds' files are gone from the server too.
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await self.clients.claim();
		})()
	)
);

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
	if (!BUILT.has(url.pathname)) return;
	// Kept the first time each is used.
	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const hit = await cache.match(event.request);
			if (hit) return hit;
			const response = await fetch(event.request);
			if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
			return response;
		})()
	);
});

// The unread count, pushed by the cron after each sync (push.ts). iOS needs a
// notification for every push; one tag means each replaces the last.
self.addEventListener('push', (event) => {
	const { unread } = event.data!.json() as { unread: number };
	event.waitUntil(
		Promise.all([
			self.navigator.setAppBadge(unread),
			self.registration.showNotification(`${unread} unread in Stash`, {
				tag: 'unread',
				silent: true
			})
		])
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(self.clients.openWindow('/'));
});
